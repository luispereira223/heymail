import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase } from '@/lib/database';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's email accounts
    const accounts = db.prepare(`
      SELECT 
        id,
        email,
        provider,
        display_name,
        is_active,
        sync_status,
        sync_progress,
        total_emails,
        synced_emails,
        last_sync,
        sync_error,
        created_at
      FROM email_accounts 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(user.id);

    db.close();

    return NextResponse.json({ accounts }, { status: 200 });

  } catch (error) {
    console.error('Error fetching email accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}