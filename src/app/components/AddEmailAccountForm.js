// src/app/dashboard/components/AddEmailAccountForm.js
import { useState, useEffect } from 'react';

export default function AddEmailAccountForm({ onClose, onAccountAdded, isFirstTime = false }) {
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

          {/* IMAP Settings */}
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