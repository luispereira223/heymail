import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase } from '@/lib/database';

export async function GET(request, { params }) {
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

    // Check if account belongs to user
    const account = db.prepare(`
      SELECT id FROM email_accounts 
      WHERE id = ? AND user_id = ?
    `).get(accountId, user.id);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get sync progress
    const progress = db.prepare(`
      SELECT 
        sp.*,
        ea.sync_status,
        ea.sync_error
      FROM sync_progress sp
      JOIN email_accounts ea ON sp.account_id = ea.id
      WHERE sp.account_id = ?
    `).get(accountId);

    db.close();

    if (!progress) {
      return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
    }

    // Calculate estimated time remaining
    let estimatedTimeRemaining = null;
    if (progress.started_at && progress.processed_emails > 0) {
      const startTime = new Date(progress.started_at);
      const now = new Date();
      const elapsedSeconds = (now - startTime) / 1000;
      const emailsPerSecond = progress.processed_emails / elapsedSeconds;
      const remainingEmails = progress.total_emails - progress.processed_emails;
      
      if (emailsPerSecond > 0) {
        estimatedTimeRemaining = Math.ceil(remainingEmails / emailsPerSecond);
      }
    }

    return NextResponse.json({
      progress: {
        ...progress,
        estimated_time_remaining: estimatedTimeRemaining,
        percentage: progress.total_emails > 0 
          ? Math.round((progress.processed_emails / progress.total_emails) * 100)
          : 0
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching sync progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}