// src/app/api/emails/add-account/route.js
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { initializeDatabase, EMAIL_PROVIDERS, encryptPassword } from '@/lib/database';
import { ImapFlow } from 'imapflow';

export async function POST(request) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, appPassword, imapSettings, displayName } = await request.json();

    // Validate input
    if (!email || !appPassword) {
      return NextResponse.json({ error: 'Email and app password are required' }, { status: 400 });
    }

    // Initialize database
    const db = initializeDatabase();

    // Get user ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Detect email provider
    const emailDomain = email.split('@')[1]?.toLowerCase();
    let provider = 'custom';
    
    if (emailDomain === 'gmail.com') provider = 'gmail';
    else if (['outlook.com', 'hotmail.com', 'live.com'].includes(emailDomain)) provider = 'outlook';
    else if (emailDomain === 'yahoo.com') provider = 'yahoo';

    // Use provider defaults or custom settings
    const providerConfig = EMAIL_PROVIDERS[provider];
    const finalImapSettings = provider !== 'custom' ? {
      server: providerConfig.imap_host,
      port: providerConfig.imap_port,
      security: providerConfig.imap_security
    } : imapSettings;

    // Test IMAP connection before saving
    console.log('Testing IMAP connection...');
    try {
      const testClient = new ImapFlow({
        host: finalImapSettings.server,
        port: parseInt(finalImapSettings.port, 10),
        secure: finalImapSettings.security === 'SSL/TLS',
        auth: {
          user: email,
          pass: appPassword,
        },
        logger: false // Disable logging for test
      });

      await testClient.connect();
      const mailbox = await testClient.mailboxOpen('INBOX');
      await testClient.logout();
      
      console.log(`✓ IMAP connection successful. Found ${mailbox.exists} emails.`);
    } catch (imapError) {
      console.error('IMAP connection failed:', imapError.message);
      return NextResponse.json({ 
        error: 'Failed to connect to email server. Please check your credentials and settings.',
        details: imapError.message
      }, { status: 400 });
    }

    // Check if account already exists
    const existingAccount = db.prepare('SELECT id FROM email_accounts WHERE user_id = ? AND email = ?')
      .get(user.id, email);

    if (existingAccount) {
      return NextResponse.json({ error: 'Email account already added' }, { status: 400 });
    }

    // Encrypt the app password
    const encryptedPassword = encryptPassword(appPassword);

    // Insert email account
    const insertAccount = db.prepare(`
      INSERT INTO email_accounts (
        user_id, email, provider, display_name,
        imap_host, imap_port, imap_security, app_password,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const result = insertAccount.run(
      user.id,
      email,
      provider,
      displayName || email,
      finalImapSettings.server,
      parseInt(finalImapSettings.port, 10),
      finalImapSettings.security,
      encryptedPassword
    );

    console.log(`✓ Email account added with ID: ${result.lastInsertRowid}`);

    // Close database
    db.close();

    return NextResponse.json({
      message: 'Email account added successfully',
      accountId: result.lastInsertRowid,
      provider: provider,
      canSync: true
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding email account:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}