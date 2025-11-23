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

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
);

// Static footer content for consistent branding and policies
const STATIC_FOOTER_HTML = `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />

<section style="margin-bottom: 1.5rem;">
  <h3>CRITICAL: Buyer Responsibility & Fitment</h3>
  <p>Please verify compatibility before purchasing. While we guarantee the quality of our OEM parts, it is the buyer's sole responsibility to ensure this specific part fits your exact vehicle year, make, model, and trim level. Please cross-reference part numbers, check your vehicle’s VIN, or consult your local dealer to confirm fitment before you commit to buy.</p>
</section>

<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> The buyer is responsible for all shipping costs associated with this item.</p>
  <p><strong>Returns:</strong> We stand behind the accuracy of our listings. If you receive an item that is not as described, returns are accepted within 15 days of receipt. Please review all listing photos and descriptions carefully prior to purchase.</p>
</section>

<section style="margin-bottom: 1.5rem;">
  <h3>About ChrisJayden Auto Repair: The Source for Genuine OEM Parts</h3>
  <p>At ChrisJayden Auto Repair, our business is built on hands-on automotive experience. Based physically in Oklahoma City, we specialize in the meticulous process of acquiring salvage vehicles and performing complete quality rebuilds.</p>
  <p>This specialized work gives us unique access to a massive assortment of pristine Original Equipment Manufacturer (OEM) parts that are far too good to go to waste. We harvest the best components—the very kind we trust in our own rebuild projects—and make them available to you. Skip the aftermarket guessing game and choose genuine OEM parts sourced by experienced rebuilders.</p>
</section>
`;

export const ResultCard: React.FC<ResultCardProps> = ({ title, description }) => {
  const [copied, setCopied] = useState(false);
  const [htmlCopied, setHtmlCopied] = useState(false);

  // Check if description already contains the branding to avoid duplication (for backward compatibility with old scans)
  const hasBranding = description.includes("ChrisJayden Auto Repair");
  const fullDescriptionHtml = hasBranding ? description : description + STATIC_FOOTER_HTML;

  // Strip HTML tags for the text-only copy
  const getTextContent = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.innerText;
  };

  const handleCopy = () => {
    const textBody = getTextContent(fullDescriptionHtml);
    navigator.clipboard.writeText(`Title:\n${title}\n\nDescription:\n${textBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(fullDescriptionHtml);
    setHtmlCopied(true);
    setTimeout(() => setHtmlCopied(false), 2000);
  };

  const handleDownload = () => {
    const textBody = getTextContent(fullDescriptionHtml);
    const fileContent = `Title:\n${title}\n\nDescription HTML:\n${fullDescriptionHtml}\n\nDescription Text:\n${textBody}`;
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
            onClick={handleCopyHtml}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-colors"
          >
            <span>{htmlCopied ? 'Copied!' : 'Copy HTML'}</span>
            <CodeIcon />
          </button>
          
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
          >
            <span>{copied ? 'Copied!' : 'Copy All'}</span>
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
          <p className="mt-1 p-3 bg-gray-900 rounded-md text-gray-200 shadow-inner border border-gray-700/50">{title}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Description Preview</h3>
          <div className="p-6 bg-gray-900 rounded-xl shadow-inner border border-gray-700/50">
            {/* 
              Tailwind Prose Configuration:
              - prose-invert: Colors for dark mode
              - prose-p:my-4: Adds explicit vertical spacing between paragraphs
              - prose-headings:mt-6: Adds space above headers
            */}
            <article 
              className="prose prose-invert prose-sm sm:prose-base max-w-none 
                         leading-loose 
                         prose-headings:text-gray-100 prose-headings:mt-8 prose-headings:mb-4 
                         prose-p:text-gray-300 prose-p:my-4 
                         prose-li:my-2 prose-ul:my-4
                         prose-strong:text-white prose-strong:font-bold
                         prose-a:text-blue-400
                         prose-table:w-full prose-table:my-6 prose-th:bg-gray-800 prose-th:p-3 prose-td:p-3"
              dangerouslySetInnerHTML={{ __html: description }}
            />
            
            {/* Render Footer Separately if not already in description */}
            {!hasBranding && (
                <div className="mt-8 pt-8 border-t border-gray-700">
                    <article 
                        className="prose prose-invert prose-sm sm:prose-base max-w-none 
                                   leading-loose 
                                   prose-headings:text-gray-100 prose-headings:mt-6 prose-headings:mb-4
                                   prose-p:text-gray-400 prose-p:my-4"
                        dangerouslySetInnerHTML={{ __html: STATIC_FOOTER_HTML }}
                    />
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};