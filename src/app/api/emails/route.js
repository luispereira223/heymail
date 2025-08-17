import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase } from '@/lib/database';

export async function GET(request) {
  const startTime = Date.now(); // Performance tracking
  
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 20; // Reduced default from 50
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const accountId = url.searchParams.get('accountId');

    const db = initializeDatabase();

    // Add performance indexes if they don't exist
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_emails_date ON emails (account_id, internal_date DESC)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_email ON attachments (email_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts (user_id, id)`);
    } catch (indexError) {
      // Indexes might already exist, that's fine
      console.log('Index creation note:', indexError.message);
    }

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      db.close();
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build optimized query with LEFT JOIN for attachments
    let emailQuery = `
      SELECT 
        e.id,
        e.account_id,
        e.uid,
        e.unique_id,
        e.subject,
        e.from_sender,
        e.date,
        e.internal_date,
        e.html,
        e.text_content,
        e.is_read,
        e.is_reply,
        e.is_first_in_thread,
        e.message_id,
        e.in_reply_to,
        e.thread_id,
        e.thread_position,
        e.reply_count,
        e.has_attachments,
        e.attachment_count,
        e.created_at,
        ea.email as account_email,
        ea.display_name as account_name,
        ea.provider,
        -- Aggregate attachments into JSON array
        CASE 
          WHEN COUNT(a.id) > 0 THEN
            '[' || GROUP_CONCAT(
              '{"id":' || a.id || 
              ',"filename":"' || COALESCE(a.filename, '') || 
              '","content_type":"' || COALESCE(a.content_type, '') || 
              '","size":' || COALESCE(a.size, 0) || '}'
            ) || ']'
          ELSE '[]'
        END as attachments_json
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      LEFT JOIN attachments a ON e.id = a.email_id
      WHERE ea.user_id = ?
    `;

    const queryParams = [user.id];

    // Add account filter if specified
    if (accountId) {
      emailQuery += ' AND e.account_id = ?';
      queryParams.push(parseInt(accountId));
    }

    // Group by email since we're aggregating attachments, then order and limit
    emailQuery += ` 
      GROUP BY e.id, e.account_id, e.uid, e.unique_id, e.subject, e.from_sender, 
               e.date, e.internal_date, e.html, e.text_content, e.is_read, e.is_reply,
               e.is_first_in_thread, e.message_id, e.in_reply_to, e.thread_id,
               e.thread_position, e.reply_count, e.has_attachments, e.attachment_count,
               e.created_at, ea.email, ea.display_name, ea.provider
      ORDER BY e.internal_date DESC 
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    console.log(`Starting email query for user ${user.id}...`);
    const queryStartTime = Date.now();

    // Execute the optimized query - this replaces the N+1 problem
    const emails = db.prepare(emailQuery).all(...queryParams);
    
    const queryEndTime = Date.now();
    console.log(`Email query completed in ${queryEndTime - queryStartTime}ms, found ${emails.length} emails`);

    // Build count query for pagination (optimized version)
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = ?
    `;

    const countParams = [user.id];
    if (accountId) {
      countQuery += ' AND e.account_id = ?';
      countParams.push(parseInt(accountId));
    }

    const totalResult = db.prepare(countQuery).get(...countParams);
    const total = totalResult.total;

    // Process emails and parse attachments JSON
    const processedEmails = emails.map(email => {
      try {
        // Parse the attachments JSON we built in the query
        const attachments = email.attachments_json ? JSON.parse(email.attachments_json) : [];
        
        // Remove the JSON field and add the parsed attachments
        const { attachments_json, ...emailWithoutJson } = email;
        
        return {
          ...emailWithoutJson,
          attachments: attachments
        };
      } catch (parseError) {
        console.error('Error parsing attachments for email', email.id, parseError);
        const { attachments_json, ...emailWithoutJson } = email;
        return {
          ...emailWithoutJson,
          attachments: []
        };
      }
    });

    db.close();

    const totalTime = Date.now() - startTime;
    console.log(`Total API response time: ${totalTime}ms`);

    return NextResponse.json({
      emails: processedEmails,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      performance: {
        totalTime: totalTime,
        emailCount: emails.length
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}