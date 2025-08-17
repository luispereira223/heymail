// src/app/dashboard/components/FirstTimeUserSetup.js
import { useState } from 'react';
import AddEmailAccountForm from './AddEmailAccountForm';

export default function FirstTimeUserSetup({ onAccountAdded }) {
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