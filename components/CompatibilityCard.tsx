
import React, { useState } from 'react';

interface CompatibilityCardProps {
  partNumber: string;
  compatibilityHtml: string;
}

export const CompatibilityCard: React.FC<CompatibilityCardProps> = ({ partNumber, compatibilityHtml }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = compatibilityHtml;
    
    // A simple way to format table for plain text copy
    let textToCopy = `Compatibility for ${partNumber}:\n\n`;
    const table = tempDiv.querySelector('table');
    if (table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            textToCopy += cells.map(cell => cell.textContent?.trim()).join('\t|\t') + '\n';
        });
    } else {
        textToCopy = tempDiv.textContent || compatibilityHtml;
    }
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
          Compatibility for: <span className="text-white">{partNumber}</span>
        </h2>
        <div className="w-full sm:w-auto flex">
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
          >
            <span>{copied ? 'Copied!' : 'Copy Table'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-4">
        <div
          className="p-3 bg-gray-900 rounded-md text-gray-300 whitespace-normal prose prose-invert max-w-none prose-table:w-full prose-table:table-fixed prose-th:bg-gray-700 prose-th:p-2 prose-td:p-2"
          dangerouslySetInnerHTML={{ __html: compatibilityHtml }}
        />
      </div>
    </div>
  );
};