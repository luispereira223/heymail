import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase } from '@/lib/database';

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