// src/lib/database.js
import Database from 'better-sqlite3';

export function initializeDatabase() {
  const db = new Database('emails.db');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Users table (existing)
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Email accounts table - stores user's email account credentials
  db.exec(`CREATE TABLE IF NOT EXISTS email_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'gmail', 'outlook', 'yahoo', 'custom'
    display_name TEXT,
    
    -- IMAP credentials (encrypted)
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_security TEXT NOT NULL, -- 'SSL/TLS', 'STARTTLS', 'None'
    app_password TEXT NOT NULL, -- encrypted
    
    -- Sync status
    is_active BOOLEAN DEFAULT 1,
    last_sync DATETIME,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'error'
    sync_progress INTEGER DEFAULT 0, -- 0-100
    total_emails INTEGER DEFAULT 0,
    synced_emails INTEGER DEFAULT 0,
    sync_error TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, email)
  )`);
  
  // Updated emails table with account_id
  db.exec(`CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    uid INTEGER NOT NULL, -- Original UID from email server
    unique_id TEXT UNIQUE NOT NULL, -- account_id:uid for global uniqueness
    
    subject TEXT,
    from_sender TEXT,
    date TEXT,
    internal_date TEXT,
    html TEXT,
    text_content TEXT,
    
    -- Email status
    is_read BOOLEAN DEFAULT 0,
    is_reply BOOLEAN DEFAULT 0,
    is_first_in_thread BOOLEAN DEFAULT 0,
    
    -- Threading
    message_id TEXT,
    in_reply_to TEXT,
    thread_id TEXT,
    thread_position INTEGER DEFAULT 1,
    reply_count INTEGER DEFAULT 0,
    
    -- Attachments
    has_attachments BOOLEAN DEFAULT 0,
    attachment_count INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES email_accounts (id) ON DELETE CASCADE,
    INDEX idx_account_uid (account_id, uid),
    INDEX idx_account_date (account_id, internal_date),
    INDEX idx_thread (account_id, thread_id)
  )`);
  
  // Updated attachments table
  db.exec(`CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    part TEXT,
    filename TEXT,
    content_type TEXT,
    size INTEGER,
    encoding TEXT,
    
    FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
  )`);
  
  // Sync progress table for real-time updates
  db.exec(`CREATE TABLE IF NOT EXISTS sync_progress (
    account_id INTEGER PRIMARY KEY,
    total_emails INTEGER DEFAULT 0,
    processed_emails INTEGER DEFAULT 0,
    current_email_subject TEXT,
    estimated_time_remaining INTEGER, -- seconds
    started_at DATETIME,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES email_accounts (id) ON DELETE CASCADE
  )`);
  
  return db;
}

// Helper function to create unique email ID
export function createUniqueEmailId(accountId, uid) {
  return `${accountId}:${uid}`;
}

// Email provider configurations
export const EMAIL_PROVIDERS = {
  gmail: {
    name: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_security: 'SSL/TLS',
    requires_app_password: true,
    app_password_url: 'https://myaccount.google.com/apppasswords'
  },
  outlook: {
    name: 'Outlook/Hotmail',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_security: 'SSL/TLS',
    requires_app_password: true,
    app_password_url: 'https://account.microsoft.com/security'
  },
  yahoo: {
    name: 'Yahoo Mail',
    imap_host: 'imap.mail.yahoo.com',
    imap_port: 993,
    imap_security: 'SSL/TLS',
    requires_app_password: true,
    app_password_url: 'https://login.yahoo.com/account/security'
  },
  custom: {
    name: 'Custom IMAP',
    requires_app_password: false
  }
};

// Simple encryption helpers (in production, use proper encryption)
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export function encryptPassword(password) {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptPassword(encryptedPassword) {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}