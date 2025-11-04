
import React, { useState } from 'react';

interface ResultCardProps {
  title: string;
  description: string;
}

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

export const ResultCard: React.FC<ResultCardProps> = ({ title, description }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // To copy the HTML content correctly, we might need a more sophisticated approach,
    // but for plain text this is fine. For now, we'll copy the raw content.
    navigator.clipboard.writeText(`Title:\n${title}\n\nDescription:\n${description}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fileContent = `Title:\n${title}\n\nDescription:\n${description}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ebay-listing.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
          Generated eBay Listing
        </h2>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
          >
            <span>{copied ? 'Copied!' : 'Copy'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
           <button
            onClick={handleDownload}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition-colors"
          >
            <span>Download</span>
            <DownloadIcon />
          </button>
        </div>
      </div>

      <div className="space-y-6 mt-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-300">Title</h3>
          <p className="mt-1 p-3 bg-gray-900 rounded-md text-gray-200">{title}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-300">Description</h3>
          <div 
            className="mt-1 p-3 bg-gray-900 rounded-md text-gray-300 whitespace-pre-wrap prose prose-invert max-w-none prose-table:w-full prose-table:table-fixed prose-th:bg-gray-700 prose-th:p-2 prose-td:p-2"
            dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, '<br />') }}
          />
        </div>
      </div>
    </div>
  );
};