// src/app/dashboard/components/EmailAccountCard.js
export default function EmailAccountCard({ account, progress, onSync, onDelete }) {
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
                {account.synced_emails.toLocaleString()} / {account.total_emails.toLocaleString()} emails
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
              <span>{progress.processed_emails.toLocaleString()}/{progress.total_emails.toLocaleString()}</span>
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