// src/app/api/emails/sync/[accountId]/route.js
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase, decryptPassword, createUniqueEmailId } from '@/lib/database';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Helper function to check if bodyStructure contains attachments
function checkForAttachments(bodyStructure) {
  if (!bodyStructure) return false;

  if (
    bodyStructure.disposition &&
    (bodyStructure.disposition.type === "attachment" ||
      bodyStructure.disposition.type === "inline")
  ) {
    return true;
  }

  if (bodyStructure.parameters && bodyStructure.parameters.name) {
    return true;
  }

  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    return bodyStructure.childNodes.some((child) => checkForAttachments(child));
  }

  return false;
}

// Helper function to count attachments
function countAttachments(bodyStructure) {
  if (!bodyStructure) return 0;

  let count = 0;

  if (
    (bodyStructure.disposition &&
      (bodyStructure.disposition.type === "attachment" ||
        bodyStructure.disposition.type === "inline")) ||
    (bodyStructure.parameters && bodyStructure.parameters.name)
  ) {
    count = 1;
  }

  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    count += bodyStructure.childNodes.reduce(
      (total, child) => total + countAttachments(child),
      0
    );
  }

  return count;
}

// Helper function to extract attachment metadata
function extractAttachmentInfo(bodyStructure) {
  if (!bodyStructure) return [];

  const attachments = [];

  if (
    (bodyStructure.disposition &&
      (bodyStructure.disposition.type === "attachment" ||
        bodyStructure.disposition.type === "inline")) ||
    (bodyStructure.parameters && bodyStructure.parameters.name)
  ) {
    const filename =
      (bodyStructure.disposition &&
        bodyStructure.disposition.parameters &&
        bodyStructure.disposition.parameters.filename) ||
      (bodyStructure.parameters && bodyStructure.parameters.name) ||
      "unnamed_attachment";

    const attachmentInfo = {
      part: bodyStructure.part,
      filename: filename,
      contentType: bodyStructure.type,
      size: bodyStructure.size,
      encoding: bodyStructure.encoding,
    };

    attachments.push(attachmentInfo);
  }

  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    for (const child of bodyStructure.childNodes) {
      const childAttachments = extractAttachmentInfo(child);
      attachments.push(...childAttachments);
    }
  }

  return attachments;
}

// Helper function to generate thread key
function getThreadKey(email) {
  if (email.references && email.references.length > 0) {
    return email.references[0];
  }

  if (email.inReplyTo) {
    return email.inReplyTo;
  }

  const normalizedSubject = email.subject
    ? email.subject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, "").trim()
    : "no-subject";

  return `subject:${normalizedSubject}`;
}

// Helper function to safely convert values for SQLite
function safeSqliteValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'object' && value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

// POST - Start email sync
export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = parseInt(params.accountId);
    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get email account details
    const account = db.prepare(`
      SELECT * FROM email_accounts 
      WHERE id = ? AND user_id = ?
    `).get(accountId, user.id);

    if (!account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }

    // Update sync status to 'syncing'
    db.prepare(`
      UPDATE email_accounts 
      SET sync_status = 'syncing', sync_progress = 0, sync_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(accountId);

    db.close();

    // Start sync in background (don't await)
    syncEmailsInBackground(account, user.id);

    return NextResponse.json({ 
      message: 'Sync started successfully',
      accountId: accountId
    }, { status: 200 });

  } catch (error) {
    console.error('Error starting email sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete email account
export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = parseInt(params.accountId);
    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify account ownership and delete
    const deleteResult = db.prepare(`
      DELETE FROM email_accounts 
      WHERE id = ? AND user_id = ?
    `).run(accountId, user.id);

    db.close();

    if (deleteResult.changes === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error deleting email account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update email account
export async function PATCH(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = parseInt(params.accountId);
    const { is_active, display_name } = await request.json();

    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update query
    const updates = [];
    const params_list = [];

    if (typeof is_active === 'boolean') {
      updates.push('is_active = ?');
      params_list.push(is_active ? 1 : 0);
    }

    if (display_name) {
      updates.push('display_name = ?');
      params_list.push(display_name);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params_list.push(accountId, user.id);

    const updateQuery = `
      UPDATE email_accounts 
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `;

    const updateResult = db.prepare(updateQuery).run(...params_list);

    db.close();

    if (updateResult.changes === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Account updated successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error updating email account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Background sync function
async function syncEmailsInBackground(account, userId) {
  let db;
  let client;
  let isClientConnected = false;

  try {
    console.log(`Starting sync for account: ${account.email}`);
    
    // Decrypt the app password
    const appPassword = decryptPassword(account.app_password);

    // Connect to IMAP
    client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_security === 'SSL/TLS',
      auth: {
        user: account.email,
        pass: appPassword,
      },
    });

    await client.connect();
    isClientConnected = true;
    
    const mailbox = await client.mailboxOpen('INBOX');

    if (mailbox.exists === 0) {
      console.log('No emails found in mailbox');
      
      // Update account status
      db = initializeDatabase();
      db.prepare(`
        UPDATE email_accounts 
        SET sync_status = 'completed', total_emails = 0, synced_emails = 0, last_sync = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(account.id);
      db.close();
      
      // Close connection properly
      if (isClientConnected) {
        await client.logout();
        isClientConnected = false;
      }
      return;
    }

    // Initialize progress tracking
    db = initializeDatabase();
    
    // Clear existing emails for this account
    db.prepare('DELETE FROM emails WHERE account_id = ?').run(account.id);
    db.prepare('DELETE FROM sync_progress WHERE account_id = ?').run(account.id);
    
    // Insert initial progress
    db.prepare(`
      INSERT INTO sync_progress (account_id, total_emails, processed_emails, started_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
    `).run(account.id, mailbox.exists);

    // Update account with total emails
    db.prepare(`
      UPDATE email_accounts 
      SET total_emails = ?, synced_emails = 0
      WHERE id = ?
    `).run(mailbox.exists, account.id);

    db.close();

    const emails = [];
    let processedCount = 0;

    // Fetch emails
    for await (let message of client.fetch("1:*", {
      source: true,
      envelope: true,
      flags: true,
      threadId: true,
      bodyStructure: true,
      internalDate: true,
    })) {
      try {
        processedCount++;

        // Parse the email
        const parsed = await simpleParser(message.source);
        
        // Update progress every 10 emails
        if (processedCount % 10 === 0) {
          db = initializeDatabase();
          db.prepare(`
            UPDATE sync_progress 
            SET processed_emails = ?, current_email_subject = ?, last_update = CURRENT_TIMESTAMP
            WHERE account_id = ?
          `).run(processedCount, parsed.subject || 'No Subject', account.id);
          
          db.prepare(`
            UPDATE email_accounts 
            SET synced_emails = ?, sync_progress = ?
            WHERE id = ?
          `).run(processedCount, Math.round((processedCount / mailbox.exists) * 100), account.id);
          
          db.close();
          
          console.log(`Processed ${processedCount}/${mailbox.exists} emails`);
        }

        // Check email properties
        const isRead = message.flags.has("\\Seen");
        const hasAttachments = checkForAttachments(message.bodyStructure);
        const attachmentCount = countAttachments(message.bodyStructure);
        const attachments = hasAttachments ? extractAttachmentInfo(message.bodyStructure) : [];
        const isReply = !!(parsed.inReplyTo || parsed.references);

        const emailData = {
          account_id: account.id,
          uid: message.uid,
          unique_id: createUniqueEmailId(account.id, message.uid),
          subject: parsed.subject || null,
          from_sender: parsed.from?.text || null,
          date: parsed.date ? parsed.date.toISOString() : null,
          internal_date: message.internalDate ? message.internalDate.toISOString() : null,
          html: parsed.html || null,
          text_content: parsed.text || null,
          is_read: isRead,
          is_reply: isReply,
          message_id: parsed.messageId || null,
          in_reply_to: parsed.inReplyTo || null,
          thread_id: message.threadId || null,
          has_attachments: hasAttachments,
          attachment_count: attachmentCount,
          attachments: attachments,
        };

        emails.push(emailData);
      } catch (emailError) {
        console.error(`Error processing email UID ${message.uid}:`, emailError);
        // Continue with next email
      }
    }

    // Close IMAP connection after fetching
    if (isClientConnected) {
      await client.logout();
      isClientConnected = false;
    }

    // Sort emails by date for proper thread processing
    emails.sort((a, b) => new Date(a.internal_date || 0) - new Date(b.internal_date || 0));

    // Process threading
    const threadsMap = new Map();
    const emailsWithThreadInfo = emails.map((email) => {
      const threadKey = email.thread_id || getThreadKey(email);

      if (!threadsMap.has(threadKey)) {
        threadsMap.set(threadKey, []);
      }
      threadsMap.get(threadKey).push(email);

      return email;
    });

    // Add thread information
    emailsWithThreadInfo.forEach((email) => {
      const threadKey = email.thread_id || getThreadKey(email);
      const threadEmails = threadsMap.get(threadKey);

      email.reply_count = threadEmails.length - 1;
      email.thread_position = threadEmails.findIndex((e) => e.uid === email.uid) + 1;
      email.is_first_in_thread = email.thread_position === 1;
    });

    // Save to database
    db = initializeDatabase();
    
    const insertEmailStmt = db.prepare(`
      INSERT INTO emails (
        account_id, uid, unique_id, subject, from_sender, date, internal_date,
        html, text_content, is_read, is_reply, is_first_in_thread,
        message_id, in_reply_to, thread_id, thread_position, reply_count,
        has_attachments, attachment_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAttachmentStmt = db.prepare(`
      INSERT INTO attachments (email_id, part, filename, content_type, size, encoding)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const email of emailsWithThreadInfo) {
        // Use safeSqliteValue to ensure all values are SQLite-compatible
        const result = insertEmailStmt.run(
          safeSqliteValue(email.account_id),
          safeSqliteValue(email.uid),
          safeSqliteValue(email.unique_id),
          safeSqliteValue(email.subject),
          safeSqliteValue(email.from_sender),
          safeSqliteValue(email.date),
          safeSqliteValue(email.internal_date),
          safeSqliteValue(email.html),
          safeSqliteValue(email.text_content),
          safeSqliteValue(email.is_read),
          safeSqliteValue(email.is_reply),
          safeSqliteValue(email.is_first_in_thread),
          safeSqliteValue(email.message_id),
          safeSqliteValue(email.in_reply_to),
          safeSqliteValue(email.thread_id),
          safeSqliteValue(email.thread_position),
          safeSqliteValue(email.reply_count),
          safeSqliteValue(email.has_attachments),
          safeSqliteValue(email.attachment_count)
        );

        // Insert attachments
        if (email.attachments && email.attachments.length > 0) {
          for (const attachment of email.attachments) {
            insertAttachmentStmt.run(
              result.lastInsertRowid,
              safeSqliteValue(attachment.part),
              safeSqliteValue(attachment.filename),
              safeSqliteValue(attachment.contentType),
              safeSqliteValue(attachment.size),
              safeSqliteValue(attachment.encoding)
            );
          }
        }
      }
      db.exec('COMMIT');
      console.log('✓ Database transaction completed successfully');
    } catch (dbError) {
      db.exec('ROLLBACK');
      throw dbError;
    }

    // Update final status
    db.prepare(`
      UPDATE email_accounts 
      SET sync_status = 'completed', synced_emails = ?, last_sync = CURRENT_TIMESTAMP, sync_error = NULL
      WHERE id = ?
    `).run(emails.length, account.id);

    // Clean up progress
    db.prepare('DELETE FROM sync_progress WHERE account_id = ?').run(account.id);

    db.close();

    console.log(`✓ Sync completed for ${account.email}: ${emails.length} emails processed`);

  } catch (error) {
    console.error('❌ Sync error:', error);

    // Update error status
    try {
      if (!db) db = initializeDatabase();
      db.prepare(`
        UPDATE email_accounts 
        SET sync_status = 'error', sync_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error.message, account.id);

      db.prepare('DELETE FROM sync_progress WHERE account_id = ?').run(account.id);
      db.close();
    } catch (dbError) {
      console.error('Error updating sync status:', dbError);
    }

    // Clean up IMAP connection only if it's still connected
    try {
      if (client && isClientConnected) {
        await client.logout();
      }
    } catch (logoutErr) {
      // Only log if it's not a "connection not available" error
      if (logoutErr.code !== 'NoConnection') {
        console.error('Error during logout:', logoutErr);
      }
    }
  }
}