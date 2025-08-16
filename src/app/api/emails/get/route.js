import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { NextResponse } from "next/server";

// Helper function to check if bodyStructure contains attachments
function checkForAttachments(bodyStructure) {
  if (!bodyStructure) return false;

  // Check if current part is an attachment
  if (
    bodyStructure.disposition &&
    (bodyStructure.disposition.type === "attachment" ||
      bodyStructure.disposition.type === "inline")
  ) {
    return true;
  }

  // Check filename in parameters (some attachments don't have disposition)
  if (bodyStructure.parameters && bodyStructure.parameters.name) {
    return true;
  }

  // Recursively check child nodes for multipart messages
  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    return bodyStructure.childNodes.some((child) => checkForAttachments(child));
  }

  return false;
}

// Helper function to count attachments
function countAttachments(bodyStructure) {
  if (!bodyStructure) return 0;

  let count = 0;

  // Check if current part is an attachment
  if (
    (bodyStructure.disposition &&
      (bodyStructure.disposition.type === "attachment" ||
        bodyStructure.disposition.type === "inline")) ||
    (bodyStructure.parameters && bodyStructure.parameters.name)
  ) {
    count = 1;
  }

  // Recursively count child nodes
  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    count += bodyStructure.childNodes.reduce(
      (total, child) => total + countAttachments(child),
      0
    );
  }

  return count;
}

// Helper function to extract attachment metadata only (no downloading)
function extractAttachmentInfo(bodyStructure) {
  if (!bodyStructure) return [];

  const attachments = [];

  // Check if current part is an attachment
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

  // Recursively get attachments from child nodes
  if (bodyStructure.childNodes && bodyStructure.childNodes.length > 0) {
    for (const child of bodyStructure.childNodes) {
      const childAttachments = extractAttachmentInfo(child);
      attachments.push(...childAttachments);
    }
  }

  return attachments;
}

// Helper function to generate thread key for non-Gmail servers
function getThreadKey(email) {
  // Use References header first, then In-Reply-To, then normalized subject
  if (email.references && email.references.length > 0) {
    return email.references[0]; // Use the first message ID in the thread
  }

  if (email.inReplyTo) {
    return email.inReplyTo;
  }

  // Fallback: use normalized subject (remove Re:, Fwd:, etc.)
  const normalizedSubject = email.subject
    ? email.subject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, "").trim()
    : "no-subject";

  return `subject:${normalizedSubject}`;
}

export async function GET(request) {
  const client = new ImapFlow({
    host: process.env.GOOGLE_IMAP,
    port: parseInt(process.env.GOOGLE_PORT, 10),
    secure: true,
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_APP_PASSWORD,
    },
  });

  const emails = [];
  let db;



  db = require("better-sqlite3")("users.db");









  //start email syncing for gmail




  try {
    await client.connect();
    let mailbox = await client.mailboxOpen("INBOX");

    if (mailbox.exists === 0) {
      await client.logout();
      return NextResponse.json({ emails: [] });
    }

    // Setup database with attachments table
    db = require("better-sqlite3")("emails.db");

    // Create emails table
    db.exec(`CREATE TABLE IF NOT EXISTS emails (
      uid INTEGER PRIMARY KEY, 
      subject TEXT, 
      from_sender TEXT, 
      date TEXT, 
      internal_date TEXT,
      html TEXT, 
      isRead INTEGER,
      isReply INTEGER,
      messageId TEXT,
      inReplyTo TEXT,
      threadId TEXT,
      hasAttachments INTEGER,
      attachmentCount INTEGER,
      replyCount INTEGER,
      threadPosition INTEGER,
      isFirstInThread INTEGER
    )`);

    // Create attachments table (metadata only)
    db.exec(`CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_uid INTEGER,
      part TEXT,
      filename TEXT,
      content_type TEXT,
      size INTEGER,
      encoding TEXT,
      FOREIGN KEY (email_uid) REFERENCES emails (uid)
    )`);

    // Clear existing data
    db.exec("DELETE FROM emails");
    db.exec("DELETE FROM attachments");

    let count = 1;

    // Include threadId, bodyStructure, and envelope for reply/attachment detection
    for await (let message of client.fetch("1:*", {
      source: true,
      envelope: true,
      flags: true,
      threadId: true, // For Gmail thread support
      bodyStructure: true, // For attachment detection
      internalDate: true, // For proper sorting
    })) {
      console.log(`${count}: Processing email UID ${message.uid}`);
      count++;

      // Parse the raw email into structured data
      const parsed = await simpleParser(message.source);

      // Check if it has been read - flags is a Set, not an array
      const isRead = message.flags.has("\\Seen");

      // Check for attachments in bodyStructure
      const hasAttachments = checkForAttachments(message.bodyStructure);
      const attachmentCount = countAttachments(message.bodyStructure);

      // Extract attachment metadata only (no downloading)
      const attachments = hasAttachments
        ? extractAttachmentInfo(message.bodyStructure)
        : [];

      // Check if this is a reply (has In-Reply-To or References headers)
      const isReply = !!(parsed.inReplyTo || parsed.references);

      // Get thread information
      const threadId = message.threadId || null; // Gmail thread ID
      const messageId = parsed.messageId;
      const inReplyTo = parsed.inReplyTo;
      const references = parsed.references; // Array of Message-IDs this email references

      const emailData = {
        uid: message.uid,
        subject: parsed.subject,
        from: parsed.from?.text || "N/A",
        date: parsed.date,
        internalDate: message.internalDate, // IMAP server date for sorting
        html: parsed.html,
        isRead: isRead,

        // Reply information
        isReply: isReply,
        messageId: messageId,
        inReplyTo: inReplyTo,
        references: references,
        threadId: threadId,

        // Attachment information (metadata only)
        hasAttachments: hasAttachments,
        attachmentCount: attachmentCount,
        attachments: attachments, // Now only includes metadata
      };

      emails.push(emailData);
    }

    // Sort emails by date (oldest first) for proper thread order
    emails.sort((a, b) => new Date(a.internalDate) - new Date(b.internalDate));

    // Group emails by thread and count replies
    const threadsMap = new Map();
    const emailsWithReplyInfo = emails.map((email) => {
      // For Gmail, use threadId. For other servers, group by subject or references
      const threadKey = email.threadId || getThreadKey(email);

      if (!threadsMap.has(threadKey)) {
        threadsMap.set(threadKey, []);
      }
      threadsMap.get(threadKey).push(email);

      return email;
    });

    // Add reply count and thread position to each email
    emailsWithReplyInfo.forEach((email) => {
      const threadKey = email.threadId || getThreadKey(email);
      const threadEmails = threadsMap.get(threadKey);

      email.replyCount = threadEmails.length - 1; // Exclude the original email
      email.threadPosition =
        threadEmails.findIndex((e) => e.uid === email.uid) + 1;
      email.isFirstInThread = email.threadPosition === 1;

      // Instead of full threadEmails, just store UIDs to avoid circular reference
      email.threadEmailUids = threadEmails.map((e) => e.uid);
    });

    // Database operations with transaction for better performance
    const insertEmailStmt = db.prepare(
      `INSERT INTO emails VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertAttachmentStmt = db.prepare(`INSERT INTO attachments 
      (email_uid, part, filename, content_type, size, encoding) 
      VALUES (?, ?, ?, ?, ?, ?)`);

    db.exec("BEGIN TRANSACTION");
    try {
      for (const email of emailsWithReplyInfo) {
        // Insert email record
        insertEmailStmt.run(
          email.uid,
          email.subject || null,
          email.from || null,
          email.date ? email.date.toISOString() : null, // Convert Date to string
          email.internalDate ? email.internalDate.toISOString() : null, // Convert Date to string
          email.html || null,
          email.isRead ? 1 : 0,
          email.isReply ? 1 : 0,
          email.messageId || null,
          email.inReplyTo || null,
          email.threadId || null,
          email.hasAttachments ? 1 : 0,
          email.attachmentCount || 0,
          email.replyCount || 0,
          email.threadPosition || 0,
          email.isFirstInThread ? 1 : 0
        );

        // Insert attachment metadata records
        if (email.attachments && email.attachments.length > 0) {
          for (const attachment of email.attachments) {
            insertAttachmentStmt.run(
              email.uid,
              attachment.part,
              attachment.filename,
              attachment.contentType,
              attachment.size,
              attachment.encoding
            );
          }
        }
      }
      db.exec("COMMIT");
      console.log("✓ Database transaction completed successfully");
    } catch (dbError) {
      db.exec("ROLLBACK");
      throw dbError;
    }

    db.close(); // Always close the database connection

    await client.logout();

    // Summary statistics
    const totalAttachments = emails.reduce(
      (sum, email) => sum + email.attachmentCount,
      0
    );

    console.log(`\n📧 Processing completed:`);
    console.log(`   - ${emails.length} emails processed`);
    console.log(`   - ${totalAttachments} attachments found (metadata only)`);

    return NextResponse.json(
      {
        message: "Emails and attachment metadata processed successfully",
        stats: {
          emailCount: emails.length,
          emails: emails,

        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Error processing emails:", err);

    // Make sure to close connections on error
    try {
      await client.logout();
    } catch (logoutErr) {
      console.error("Error during logout:", logoutErr);
    }

    if (db) {
      try {
        db.close();
      } catch (dbErr) {
        console.error("Error closing database:", dbErr);
      }
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
