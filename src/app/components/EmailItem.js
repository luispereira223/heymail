// src/app/dashboard/components/EmailItem.js
export default function EmailItem({ email }) {
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