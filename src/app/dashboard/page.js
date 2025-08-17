"use client";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState({});
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  const { data: session } = useSession();

  // Fetch user's email accounts
  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch("/api/emails/accounts", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data.accounts);
        setIsFirstTimeUser(data.accounts.length === 0);
      }
    } catch (error) {
      console.error("Error fetching email accounts:", error);
    }
  };

  // Fetch emails from all accounts
  const fetchEmails = async () => {
    try {
      const response = await fetch("/api/emails?limit=5000", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  // Start sync for an account
  const startSync = async (accountId) => {
    try {
      // Start the sync
      const response = await fetch(`/api/emails/sync/${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        // Start polling for progress
        pollSyncProgress(accountId);
        // Refresh accounts to show syncing status
        fetchEmailAccounts();
      } else {
        const error = await response.json();
        alert(`Sync failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Error starting sync:", error);
      alert("Failed to start sync");
    }
  };

  // Poll sync progress
  const pollSyncProgress = (accountId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/emails/progress/${accountId}`);
        
        if (response.ok) {
          const data = await response.json();
          setSyncProgress(prev => ({
            ...prev,
            [accountId]: data.progress
          }));

          // If sync is completed, stop polling and refresh data
          if (data.progress.sync_status === 'completed' || data.progress.sync_status === 'error') {
            clearInterval(interval);
            setSyncProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[accountId];
              return newProgress;
            });
            fetchEmailAccounts();
            fetchEmails();
          }
        } else {
          // Progress not found, sync might be completed
          clearInterval(interval);
          setSyncProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[accountId];
            return newProgress;
          });
          fetchEmailAccounts();
        }
      } catch (error) {
        console.error("Error polling sync progress:", error);
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup after 10 minutes (safety)
    setTimeout(() => clearInterval(interval), 600000);
  };

  // Delete account
  const deleteAccount = async (accountId) => {
    if (!confirm("Are you sure you want to delete this email account? All synced emails will be removed.")) {
      return;
    }

    try {
      const response = await fetch(`/api/emails/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchEmailAccounts();
        fetchEmails();
      } else {
        alert("Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchEmailAccounts();
      fetchEmails();
      setLoading(false);
    }
  }, [session]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <button onClick={() => signIn("credentials")}>Sign in</button>
      </div>
    );
  }

  // First-time user experience
  if (isFirstTimeUser) {
    return (
      <FirstTimeUserSetup 
        onAccountAdded={(accountId) => {
          setIsFirstTimeUser(false);
          fetchEmailAccounts();
          // Auto-start sync for first account
          setTimeout(() => startSync(accountId), 1000);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showAddAccountModal && (
        <AddEmailAccountForm 
          onClose={() => setShowAddAccountModal(false)}
          onAccountAdded={(accountId) => {
            fetchEmailAccounts();
            setShowAddAccountModal(false);
            startSync(accountId);
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-blue-600">HeyMail</h1>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Account
              </button>
              <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                + Write
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Welcome, {session.user.name}</span>
                <button 
                  onClick={() => signOut()}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Accounts Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Email Accounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emailAccounts.map((account) => (
              <EmailAccountCard
                key={account.id}
                account={account}
                progress={syncProgress[account.id]}
                onSync={() => startSync(account.id)}
                onDelete={() => deleteAccount(account.id)}
              />
            ))}
          </div>
        </div>

        {/* Emails Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Emails</h2>
              <span className="text-sm text-gray-500">{emails.length} emails</span>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No emails found. Sync your accounts to see emails here.
              </div>
            ) : (
              emails.map((email) => (
                <EmailItem key={email.unique_id} email={email} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Email Account Card Component
function EmailAccountCard({ account, progress, onSync, onDelete }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'syncing': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Synced';
      case 'syncing': return 'Syncing...';
      case 'error': return 'Error';
      case 'pending': return 'Not Synced';
      default: return status;
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{account.display_name}</h3>
          <p className="text-sm text-gray-500">{account.email}</p>
          <p className="text-xs text-gray-400 capitalize">{account.provider}</p>
          
          {account.total_emails > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {account.synced_emails} / {account.total_emails} emails
            </p>
          )}
        </div>

        <div className="flex flex-col items-end space-y-2">
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(account.sync_status)}`}>
            {getStatusText(account.sync_status)}
          </span>
          
          <div className="flex space-x-1">
            {account.sync_status !== 'syncing' && (
              <button
                onClick={onSync}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                Sync
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Syncing emails...</span>
            <span>{progress.processed_emails}/{progress.total_emails}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((progress.processed_emails / progress.total_emails) * 100)}%`
              }}
            />
          </div>
          {progress.current_email_subject && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              Processing: {progress.current_email_subject}
            </p>
          )}
          {progress.estimated_time_remaining && (
            <p className="text-xs text-gray-500">
              ETA: {Math.ceil(progress.estimated_time_remaining / 60)} minutes
            </p>
          )}
        </div>
      )}

      {account.sync_error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          Error: {account.sync_error}
        </div>
      )}
    </div>
  );
}

// Email Item Component
function EmailItem({ email }) {
  const getInitials = (fromSender) => {
    return fromSender
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-4 hover:bg-gray-50 cursor-pointer">
      <div className="flex items-center space-x-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
            {getInitials(email.from_sender)}
          </div>
        </div>

        {/* Email content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className={`text-sm font-medium ${email.is_read ? 'text-gray-600' : 'text-gray-900'}`}>
                {email.subject || '(No Subject)'}
              </h3>
              {email.has_attachments && (
                <span className="text-xs text-gray-500">📎</span>
              )}
              {email.reply_count > 0 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {email.reply_count + 1} messages
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="capitalize">{email.provider}</span>
              <span>•</span>
              <span>{formatDate(email.internal_date)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600">{email.from_sender}</p>
            {!email.is_read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
          
          {email.text_content && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {email.text_content.substring(0, 100)}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// First Time User Setup Component
function FirstTimeUserSetup({ onAccountAdded }) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-4">Welcome to HeyMail!</h1>
          <p className="text-gray-600 mb-6">
            To get started, you'll need to add your first email account. 
            We'll help you connect your Gmail, Outlook, or other email provider.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors"
            >
              Add Your First Email Account
            </button>
            
            <div className="text-sm text-gray-500">
              <p>✓ Your credentials are encrypted and stored securely</p>
              <p>✓ We only access your emails, never send emails</p>
              <p>✓ You can remove accounts anytime</p>
            </div>
          </div>
        </div>

        {showAddForm && (
          <AddEmailAccountForm 
            onClose={() => setShowAddForm(false)}
            onAccountAdded={onAccountAdded}
            isFirstTime={true}
          />
        )}
      </div>
    </div>
  );
}

// Updated Add Email Account Form (reuse the existing one from your code with minor modifications)
export function AddEmailAccountForm({ onClose, onAccountAdded, isFirstTime = false }) {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapSettings, setImapSettings] = useState({
    server: "",
    port: "",
    security: "SSL/TLS",
  });

  // Auto-detect email provider and set IMAP settings
  useEffect(() => {
    const emailDomain = email.split("@")[1]?.toLowerCase();

    if (emailDomain === "gmail.com") {
      setImapSettings({
        server: "imap.gmail.com",
        port: "993",
        security: "SSL/TLS",
      });
    } else if (
      emailDomain === "outlook.com" ||
      emailDomain === "hotmail.com" ||
      emailDomain === "live.com"
    ) {
      setImapSettings({
        server: "outlook.office365.com",
        port: "993",
        security: "SSL/TLS",
      });
    } else {
      setImapSettings({
        server: "",
        port: "",
        security: "SSL/TLS",
      });
    }
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !appPassword) {
      alert("Please fill in all required fields");
      return;
    }

    const accountData = {
      email,
      appPassword,
      imapSettings,
      displayName: displayName || email,
    };

    try {
      const response = await fetch("/api/emails/add-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });

      if (response.ok) {
        const result = await response.json();
        alert("Email account added successfully!");
        setEmail("");
        setAppPassword("");
        setDisplayName("");
        onAccountAdded && onAccountAdded(result.accountId);
        onClose && onClose();
      } else {
        const error = await response.json();
        alert(`Failed to add email account: ${error.error}`);
      }
    } catch (error) {
      console.error("Error adding email account:", error);
      alert("Error adding email account");
    }
  };

  const modalClasses = isFirstTime 
    ? "fixed inset-0 bg-white z-50 overflow-y-auto"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  const formClasses = isFirstTime
    ? "w-full max-w-md mx-auto p-8"
    : "bg-white rounded-xl shadow-2xl w-[90%] max-w-md p-8 relative";

  return (
    <div className={modalClasses}>
      <div className={formClasses}>
        {/* Close button (only for modal, not first-time setup) */}
        {!isFirstTime && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        )}

        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isFirstTime ? 'Add Your First Email Account' : 'Add Email Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Name Input */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name (Optional)
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Work Email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* App Password Input */}
          <div>
            <label htmlFor="appPassword" className="block text-sm font-medium text-gray-700 mb-1">
              App Password *
            </label>
            <input
              type="password"
              id="appPassword"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="Enter your app password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use an app password, not your regular password
            </p>
          </div>

          {/* IMAP Settings - keep the existing component */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">IMAP Settings</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="imapServer" className="block text-xs text-gray-600 mb-1">
                  IMAP Server
                </label>
                <input
                  type="text"
                  id="imapServer"
                  value={imapSettings.server}
                  onChange={(e) =>
                    setImapSettings((prev) => ({
                      ...prev,
                      server: e.target.value,
                    }))
                  }
                  placeholder="imap.gmail.com"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <div className="flex-1">
                  <label htmlFor="imapPort" className="block text-xs text-gray-600 mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    id="imapPort"
                    value={imapSettings.port}
                    onChange={(e) =>
                      setImapSettings((prev) => ({
                        ...prev,
                        port: e.target.value,
                      }))
                    }
                    placeholder="993"
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex-1">
                  <label htmlFor="security" className="block text-xs text-gray-600 mb-1">
                    Security
                  </label>
                  <select
                    id="security"
                    value={imapSettings.security}
                    onChange={(e) =>
                      setImapSettings((prev) => ({
                        ...prev,
                        security: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="SSL/TLS">SSL/TLS</option>
                    <option value="STARTTLS">STARTTLS</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
            </div>

            {email && !imapSettings.server && (
              <p className="text-xs text-orange-600 mt-2">
                Please enter IMAP settings manually for this email provider
              </p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-3 pt-4">
            {!isFirstTime && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={`${isFirstTime ? 'w-full' : 'flex-1'} px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors`}
            >
              Add Account
            </button>
          </div>
        </form>

        {/* Help text */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>Need help getting an app password?</strong>
            <br />
            • Gmail: Go to Google Account → Security → App passwords
            <br />• Outlook: Go to Microsoft Account → Security → App passwords
          </p>
        </div>
      </div>
    </div>
  );
}