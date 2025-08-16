"use client";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Home() {
  const [emails1, setEmails] = useState([]);
  const [showmodal, setShowModal] = useState(false);

  const emails = [
    {
      subject: "This is the email subject",
      sender: "John Doe",
      date: "Sep 10",
      content: "This is the email content description",
      attachment: true,
    },
    {
      subject: "Another subject line",
      sender: "Alice Johnson",
      date: "Sep 11",
      content: "This is another email content description",
      attachment: false,
    },
  ];

  const oldemails = [
    {
      subject: "This is the email subject",
      sender: "John Doe",
      date: "Sep 10",
      content: "This is the email content description",
      attachment: true,
    },
    {
      subject: "Another subject line",
      sender: "Alice Johnson",
      date: "Sep 11",
      content: "This is another email content description",
      attachment: false,
    },
  ];

  const { data: session } = useSession();

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch("/api/emails/get", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        console.log("Email data received:", data);

        // Now you can use the data to update your component state
        if (data.emails) {
          // Update your emails state here
          setEmails(data.emails); // You'll need to add useState for this
          console.log(
            `Loaded ${data.totalCount} emails out of ${data.totalAvailable} available`
          );
        }
      } catch (error) {
        console.error("Error fetching emails:", error);
      }
    };

    fetchEmails();
  }, []);

  return (
    <>
      {showmodal && <Addemailaccountform onClose={() => setShowModal(false)} />}

      {/* Top buttons */}
      <div className="flex flex-col items-center justify-between">
        <div className="flex flex-row items-center justify-between w-[90%] mt-10">
          <button className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl">
            Screen 5 first-time senders
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl ml-4"
          >
            Add accounts
          </button>
          <button className="cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl ml-4">
            + Write
          </button>
        </div>
      </div>

      {(session && (
        <div>
          {/* Add content to display when session exists */}
          <p>Welcome, {session.user.name}!</p>
          <button onClick={() => signOut("google")}>Sign out</button>
        </div>
      )) || (
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      )}

      {/* Single merged card for emails */}
      <div className="flex flex-col items-center justify-center mt-10 rounded-xl shadow-2xl w-[90%] mx-auto">
        {/* New emails section */}
        <div className="p-8 w-full rounded-xl">
          <h1 className="text-4xl font-bold text-center mt-15 text-blue-500">
            HeyMail
          </h1>

          <div className="flex items-center w-full mt-5">
            <div className="mr-2 whitespace-nowrap">New For You</div>
            <hr className="flex-grow border-t-2 border-gray-300 m-0" />
            <div className="ml-2 whitespace-nowrap">
              <a href="#" className="text-blue-500">
                Read Together
              </a>
            </div>
          </div>

          {emails.map((email, index) => {
            const initials = email.sender
              .split(" ")
              .map((word) => word[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={index}
                className="cursor-pointer flex flex-row items-center w-full mt-4 p-4 rounded-lg"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white font-bold text-lg">
                  {initials}
                </div>
                <div className="flex flex-col flex-grow ml-4">
                  <div className="flex flex-row">
                    <h1 className="font-bold">{email.subject}</h1>
                    <p className="ml-3">{email.attachment ? "true" : ""}</p>
                  </div>
                  <div className="flex flex-row justify-between text-sm text-gray-700 items-center">
                    <p>{email.content}</p>
                    <div className="flex relative bottom-2">
                      <p>{email.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Old emails section */}
        <div className="p-8 w-full bg-[#FBF9F7] rounded-xl">
          <h1 className="text-1xl font-bold text-start text-black">
            Seen Before
          </h1>

          {oldemails.map((email, index) => {
            const initials = email.sender
              .split(" ")
              .map((word) => word[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={index}
                className="cursor-pointer flex flex-row items-center w-full mt-4 p-4 rounded-lg"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white font-bold text-lg">
                  {initials}
                </div>
                <div className="flex flex-col flex-grow ml-4">
                  <div className="flex flex-row">
                    <h1 className="font-bold">{email.subject}</h1>
                    <p className="ml-3">{email.attachment ? "true" : ""}</p>
                  </div>
                  <div className="flex flex-row justify-between text-sm text-gray-700 items-center">
                    <p>{email.content}</p>
                    <div className="flex relative bottom-2">
                      <p>{email.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Addemailaccountform({ onClose }) {
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
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

    // Basic validation
    if (!email || !appPassword) {
      alert("Please fill in all required fields");
      return;
    }

    const accountData = {
      email,
      appPassword,
      imapSettings,
    };

    try {
      // Here you would typically send the data to your API
      const response = await fetch("/api/emails/add-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountData),
      });

      if (response.ok) {
        alert("Email account added successfully!");
        // Reset form
        setEmail("");
        setAppPassword("");
        onClose && onClose();
      } else {
        alert("Failed to add email account");
      }
    } catch (error) {
      console.error("Error adding email account:", error);
      alert("Error adding email account");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md p-8 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Add Email Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="appPassword"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              IMAP Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="imapServer"
                  className="block text-xs text-gray-600 mb-1"
                >
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
                  <label
                    htmlFor="imapPort"
                    className="block text-xs text-gray-600 mb-1"
                  >
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
                  <label
                    htmlFor="security"
                    className="block text-xs text-gray-600 mb-1"
                  >
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
