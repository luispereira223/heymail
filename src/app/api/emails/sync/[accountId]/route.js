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

// Helper function to save a batch of emails to database
async function saveBatchToDatabase(emailBatch, accountId) {
  const db = initializeDatabase();
  
  try {
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
    
    for (const email of emailBatch) {
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
    console.log(`✓ Saved batch of ${emailBatch.length} emails to database`);
    
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close(); // Always close the connection
  }
}

// Helper function to update sync progress
async function updateSyncProgress(accountId, processedCount, totalEmails, currentSubject) {
  const db = initializeDatabase();
  
  try {
    db.prepare(`
      UPDATE sync_progress 
      SET processed_emails = ?, current_email_subject = ?, last_update = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `).run(processedCount, currentSubject || 'No Subject', accountId);
    
    db.prepare(`
      UPDATE email_accounts 
      SET synced_emails = ?, sync_progress = ?
      WHERE id = ?
    `).run(processedCount, Math.round((processedCount / totalEmails) * 100), accountId);
    
  } finally {
    db.close();
  }
}

// MEMORY FIX: Threading analysis using database queries instead of in-memory processing
async function analyzeThreadingInDatabase(accountId) {
  const db = initializeDatabase();
  
  try {
    // Get all emails for this account, ordered by date
    const emails = db.prepare(`
      SELECT id, message_id, in_reply_to, thread_id, subject, internal_date
      FROM emails 
      WHERE account_id = ? 
      ORDER BY internal_date ASC
    `).all(accountId);

    // Build threading relationships
    const messageIdMap = new Map(); // message_id -> email
    const threadGroups = new Map(); // thread_key -> array of email IDs
    
    // First pass: build message ID index
    emails.forEach(email => {
      if (email.message_id) {
        messageIdMap.set(email.message_id, email);
      }
    });

    // Second pass: group emails by thread
    emails.forEach(email => {
      let threadKey;
      
      // Use Gmail thread ID if available
      if (email.thread_id) {
        threadKey = email.thread_id;
      }
      // Check if this is a reply to an existing message
      else if (email.in_reply_to && messageIdMap.has(email.in_reply_to)) {
        const parentEmail = messageIdMap.get(email.in_reply_to);
        threadKey = `reply:${parentEmail.message_id}`;
      }
      // Group by normalized subject
      else {
        const normalizedSubject = email.subject 
          ? email.subject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, "").trim()
          : "no-subject";
        threadKey = `subject:${normalizedSubject}`;
      }

      if (!threadGroups.has(threadKey)) {
        threadGroups.set(threadKey, []);
      }
      threadGroups.get(threadKey).push(email);
    });

    // Third pass: update threading information in database
    const updateThreadingStmt = db.prepare(`
      UPDATE emails 
      SET reply_count = ?, thread_position = ?, is_first_in_thread = ?
      WHERE id = ?
    `);

    db.exec('BEGIN TRANSACTION');
    
    threadGroups.forEach((threadEmails) => {
      const replyCount = threadEmails.length - 1;
      
      threadEmails.forEach((email, index) => {
        const threadPosition = index + 1;
        const isFirstInThread = threadPosition === 1;
        
        updateThreadingStmt.run(
          replyCount,
          threadPosition,
          isFirstInThread ? 1 : 0,
          email.id
        );
      });
    });

    db.exec('COMMIT');
    console.log(`✓ Threading analysis completed for ${emails.length} emails`);
    
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
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

// MEMORY OPTIMIZED Background sync function
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

    // MEMORY FIX: Process emails in batches instead of storing all in memory
    const BATCH_SIZE = 50;
    let emailBatch = [];
    let processedCount = 0;

    // Fetch emails and process in batches
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
          // Initialize threading fields - will be calculated later
          reply_count: 0,
          thread_position: 1,
          is_first_in_thread: true
        };

        emailBatch.push(emailData);

        // MEMORY FIX: Save batch to database when it reaches BATCH_SIZE
        if (emailBatch.length >= BATCH_SIZE) {
          await saveBatchToDatabase(emailBatch, account.id);
          emailBatch = []; // Clear the batch from memory!
          
          // Force garbage collection hint (Node.js with --expose-gc flag)
          if (global.gc) {
            global.gc();
          }
        }

        // Update progress every 10 emails
        if (processedCount % 10 === 0) {
          await updateSyncProgress(account.id, processedCount, mailbox.exists, parsed.subject);
          console.log(`Processed ${processedCount}/${mailbox.exists} emails`);
        }

      } catch (emailError) {
        console.error(`Error processing email UID ${message.uid}:`, emailError);
        // Continue with next email
      }
    }

    // MEMORY FIX: Process remaining emails in the final batch
    if (emailBatch.length > 0) {
      await saveBatchToDatabase(emailBatch, account.id);
      emailBatch = null; // Explicitly clear
    }

    // Close IMAP connection
    if (isClientConnected) {
      await client.logout();
      isClientConnected = false;
    }

    // MEMORY FIX: Now do threading analysis on database, not in memory
    console.log('Starting threading analysis...');
    await analyzeThreadingInDatabase(account.id);

    // Update final status
    db = initializeDatabase();
    db.prepare(`
      UPDATE email_accounts 
      SET sync_status = 'completed', synced_emails = ?, last_sync = CURRENT_TIMESTAMP, sync_error = NULL
      WHERE id = ?
    `).run(processedCount, account.id);

    // Clean up progress
    db.prepare('DELETE FROM sync_progress WHERE account_id = ?').run(account.id);
    db.close();

    console.log(`✓ Sync completed for ${account.email}: ${processedCount} emails processed`);

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

    // Clean up IMAP connection
    try {
      if (client && isClientConnected) {
        await client.logout();
      }
    } catch (logoutErr) {
      if (logoutErr.code !== 'NoConnection') {
        console.error('Error during logout:', logoutErr);
      }
    }
  }
}