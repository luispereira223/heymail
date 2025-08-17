// src/app/dashboard/components/EmailAccountsSection.js
import EmailAccountCard from './EmailAccountCard';

export default function EmailAccountsSection({ 
  emailAccounts, 
  syncProgress, 
  onSync, 
  onDelete 
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Email Accounts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {emailAccounts.map((account) => (
          <EmailAccountCard
            key={account.id}
            account={account}
            progress={syncProgress[account.id]}
            onSync={() => onSync(account.id)}
            onDelete={() => onDelete(account.id)}
          />
        ))}
      </div>
    </div>
  );
}