// src/app/dashboard/components/EmailsSection.js
import EmailItem from './EmailItem';
import PaginationControls from './PaginationControls';

export default function EmailsSection({
  emails,
  emailAccounts,
  selectedAccount,
  onAccountFilterChange,
  totalEmails,
  currentPage,
  emailsPerPage,
  emailsLoading,
  onPageChange
}) {
  const totalPages = Math.ceil(totalEmails / emailsPerPage);
  const currentOffset = (currentPage - 1) * emailsPerPage;

  return (
    <div id="emails-section" className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Emails</h2>
          
          {/* Account Filter */}
          <div className="flex items-center space-x-4">
            <select
              value={selectedAccount}
              onChange={(e) => onAccountFilterChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Accounts</option>
              {emailAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.display_name}
                </option>
              ))}
            </select>
            
            <span className="text-sm text-gray-500">
              {totalEmails.toLocaleString()} total emails
            </span>
          </div>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {currentOffset + 1} - {Math.min(currentOffset + emailsPerPage, totalEmails)} of {totalEmails.toLocaleString()} emails
          </div>
          <div>
            Page {currentPage} of {totalPages}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {emailsLoading && (
        <div className="p-8 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-600">Loading emails...</span>
          </div>
        </div>
      )}

      {/* Email List */}
      {!emailsLoading && (
        <div className="divide-y divide-gray-200">
          {emails.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {selectedAccount === 'all' 
                ? "No emails found. Sync your accounts to see emails here."
                : "No emails found for this account."
              }
            </div>
          ) : (
            emails.map((email) => (
              <EmailItem key={email.unique_id} email={email} />
            ))
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!emailsLoading && totalPages > 1 && (
        <div className="p-6 border-t border-gray-200">
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            emailsLoading={emailsLoading}
          />
        </div>
      )}
    </div>
  );
}