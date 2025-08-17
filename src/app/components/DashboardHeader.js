// src/app/dashboard/components/DashboardHeader.js
export default function DashboardHeader({ session, onAddAccount, onSignOut }) {
    return (
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-blue-600">HeyMail</h1>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={onAddAccount}
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
                  onClick={onSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }