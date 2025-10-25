import React, { useState } from 'react';

interface ShareLinkDisplayProps {
  shareLink: string;
}

export const ShareLinkDisplay: React.FC<ShareLinkDisplayProps> = ({ shareLink }) => {
  const [copied, setCopied] = useState(false);
  
  const fullShareUrl = `${window.location.origin}/share/${shareLink}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullShareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-blue-900 mb-3">Share Link</h3>
      <p className="text-blue-700 mb-3">
        Share this link with contributors so they can upload their videos to your project:
      </p>
      
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-white border border-blue-300 rounded-md px-3 py-2">
          <code className="text-sm text-gray-800 break-all">{fullShareUrl}</code>
        </div>
        
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {copied ? (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </div>
          )}
        </button>
      </div>
      
      <div className="mt-3 text-sm text-blue-600">
        <p>💡 <strong>Tip:</strong> Contributors don't need to create an account - they can upload videos directly using this link.</p>
      </div>
    </div>
  );
};