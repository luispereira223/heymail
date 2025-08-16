import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase } from '@/lib/database';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const accountId = url.searchParams.get('accountId');

    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build query based on filters
    let emailQuery = `
      SELECT 
        e.*,
        ea.email as account_email,
        ea.display_name as account_name,
        ea.provider,
        (
          SELECT COUNT(*) 
          FROM attachments a 
          WHERE a.email_id = e.id
        ) as actual_attachment_count
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = ?
    `;

    const queryParams = [user.id];

    if (accountId) {
      emailQuery += ' AND e.account_id = ?';
      queryParams.push(parseInt(accountId));
    }

    emailQuery += ` 
      ORDER BY e.internal_date DESC 
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    const emails = db.prepare(emailQuery).all(...queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
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

    // Get attachments for emails if needed
    const emailsWithAttachments = emails.map(email => {
      if (email.has_attachments) {
        const attachments = db.prepare(`
          SELECT filename, content_type, size 
          FROM attachments 
          WHERE email_id = ?
        `).all(email.id);
        return { ...email, attachments };
      }
      return email;
    });

    db.close();

    return NextResponse.json({
      emails: emailsWithAttachments,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}