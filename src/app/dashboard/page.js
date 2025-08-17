// src/app/dashboard/page.js
"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import DashboardHeader from "./components/DashboardHeader";
import EmailAccountsSection from "./components/EmailAccountsSection";
import EmailsSection from "./components/EmailsSection";
import FirstTimeUserSetup from "./components/FirstTimeUserSetup";
import AddEmailAccountForm from "./components/AddEmailAccountForm";

export default function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState({});
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [emailsPerPage] = useState(50);
  const [hasMore, setHasMore] = useState(false);
  
  // Filters
  const [selectedAccount, setSelectedAccount] = useState('all');

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

  // Fetch emails with pagination
  const fetchEmails = async (page = 1, accountFilter = 'all') => {
    setEmailsLoading(true);
    try {
      const offset = (page - 1) * emailsPerPage;
      let url = `/api/emails?limit=${emailsPerPage}&offset=${offset}`;
      
      if (accountFilter !== 'all') {
        url += `&accountId=${accountFilter}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
        setTotalEmails(data.pagination.total);
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    } finally {
      setEmailsLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    const totalPages = Math.ceil(totalEmails / emailsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchEmails(newPage, selectedAccount);
      document.getElementById('emails-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle account filter change
  const handleAccountFilterChange = (accountId) => {
    setSelectedAccount(accountId);
    setCurrentPage(1);
    fetchEmails(1, accountId);
  };

  // Start sync for an account
  const startSync = async (accountId) => {
    try {
      const response = await fetch(`/api/emails/sync/${accountId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        pollSyncProgress(accountId);
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

          if (data.progress.sync_status === 'completed' || data.progress.sync_status === 'error') {
            clearInterval(interval);
            setSyncProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[accountId];
              return newProgress;
            });
            fetchEmailAccounts();
            if (selectedAccount === 'all' || selectedAccount == accountId) {
              fetchEmails(currentPage, selectedAccount);
            }
          }
        } else {
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
    }, 2000);

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
        if (selectedAccount == accountId) {
          setSelectedAccount('all');
          setCurrentPage(1);
          fetchEmails(1, 'all');
        } else {
          fetchEmails(currentPage, selectedAccount);
        }
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
      fetchEmails(1, 'all');
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

  if (isFirstTimeUser) {
    return (
      <FirstTimeUserSetup 
        onAccountAdded={(accountId) => {
          setIsFirstTimeUser(false);
          fetchEmailAccounts();
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

      <DashboardHeader 
        session={session}
        onAddAccount={() => setShowAddAccountModal(true)}
        onSignOut={signOut}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EmailAccountsSection
          emailAccounts={emailAccounts}
          syncProgress={syncProgress}
          onSync={startSync}
          onDelete={deleteAccount}
        />

        <EmailsSection
          emails={emails}
          emailAccounts={emailAccounts}
          selectedAccount={selectedAccount}
          onAccountFilterChange={handleAccountFilterChange}
          totalEmails={totalEmails}
          currentPage={currentPage}
          emailsPerPage={emailsPerPage}
          emailsLoading={emailsLoading}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}