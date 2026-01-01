import React, { useState } from 'react';
import { Platform, ScanType } from '../services/geminiService';
import { UserProfile } from './SettingsModal';

interface ResultCardProps {
  title: string;
  description: string;
  platform?: Platform;
  scanType?: ScanType;
  userProfile: UserProfile;
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

// --- AUTO PARTS FOOTERS ---
const getAutoFooterHtml = (p: UserProfile) => `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />
<section style="margin-bottom: 1.5rem;">
  <h3>CRITICAL: Buyer Responsibility & Fitment</h3>
  <p>Please verify compatibility before purchasing. It is the buyer's sole responsibility to ensure this specific part fits your exact vehicle. Please cross-reference part numbers, check your vehicle’s VIN, or consult your local dealer to confirm fitment before you commit to buy.</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> ${p.shippingPolicy}</p>
  <p><strong>Returns:</strong> ${p.returnPolicy}</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>About ${p.businessName} ${p.businessName.toLowerCase().includes('auto') ? '' : 'Auto Parts'}</h3>
  <p>${p.aboutAuto}</p>
</section>
`;

const getAutoFooterText = (p: UserProfile) => `
--------------------------------------------------
CRITICAL: Buyer Responsibility & Fitment
Please verify compatibility. It is the buyer's responsibility to ensure this part fits your exact vehicle. Check part number or VIN.

Shipping & Return Policy
Shipping: ${p.shippingPolicy}
Returns: ${p.returnPolicy}

About ${p.businessName}
${p.aboutAuto}
`;

// --- ELECTRONICS FOOTERS ---
const getElectronicsFooterHtml = (p: UserProfile) => `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />
<section style="margin-bottom: 1.5rem;">
  <h3>Condition & Serial Numbers</h3>
  <p>All electronic devices are tested for power and key functionality unless sold as "For Parts". <strong>Serial numbers are recorded for every item shipped</strong> to prevent return fraud. Tamper-evident seals must be intact for returns.</p>
  <p>Battery life on used portable electronics is not guaranteed unless specified.</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> ${p.shippingPolicy}</p>
  <p><strong>Returns:</strong> ${p.returnPolicy}</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>About ${p.businessName}</h3>
  <p>${p.aboutElectronics || 'We specialize in quality pre-owned electronics.'}</p>
</section>
`;

const getElectronicsFooterText = (p: UserProfile) => `
--------------------------------------------------
Condition & Serial Numbers
All items tested unless marked "For Parts". Serial numbers recorded for fraud prevention. Battery life not guaranteed on used items.

Shipping & Return Policy
Shipping: ${p.shippingPolicy}
Returns: ${p.returnPolicy}

About ${p.businessName}
${p.aboutElectronics || 'We specialize in quality pre-owned electronics.'}
`;

// --- GENERAL ITEMS FOOTERS ---
const getGeneralFooterHtml = (p: UserProfile) => `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />
<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> ${p.shippingPolicy} Ships from ${p.location}.</p>
  <p><strong>Returns:</strong> ${p.returnPolicy} Please review all listing photos and descriptions carefully prior to purchase.</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>About ${p.businessName}</h3>
  <p>${p.aboutGeneral}</p>
</section>
`;

const getGeneralFooterText = (p: UserProfile) => `
--------------------------------------------------
Shipping & Return Policy
Shipping: ${p.shippingPolicy} Ships from ${p.location}.
Returns: ${p.returnPolicy}

About ${p.businessName}
${p.aboutGeneral}
`;

export const ResultCard: React.FC<ResultCardProps> = ({ title, description, platform = 'ebay', scanType = 'auto-part', userProfile }) => {
  const [copied, setCopied] = useState(false);
  const [htmlCopied, setHtmlCopied] = useState(false);

  // If description contains an image tag, treat as HTML regardless of platform
  const hasEmbeddedImage = description.includes('<img');
  const isHtml = platform === 'ebay' || hasEmbeddedImage;
  
  const hasBranding = description.includes(userProfile.businessName);

  // Determine which footer to use
  let footerToUse = '';
  if (scanType === 'auto-part') {
      footerToUse = isHtml ? getAutoFooterHtml(userProfile) : getAutoFooterText(userProfile);
  } else if (scanType === 'electronics') {
      footerToUse = isHtml ? getElectronicsFooterHtml(userProfile) : getElectronicsFooterText(userProfile);
  } else {
      footerToUse = isHtml ? getGeneralFooterHtml(userProfile) : getGeneralFooterText(userProfile);
  }

  const fullDescription = hasBranding ? description : description + footerToUse;

  // Strip HTML tags for the text-only copy
  const getTextContent = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.innerText;
  };

  const handleCopy = () => {
    const textBody = isHtml ? getTextContent(fullDescription) : fullDescription;
    navigator.clipboard.writeText(`Title:\n${title}\n\nDescription:\n${textBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHtml = () => {
    if (!isHtml) return;
    navigator.clipboard.writeText(fullDescription);
    setHtmlCopied(true);
    setTimeout(() => setHtmlCopied(false), 2000);
  };

  const handleDownload = () => {
    const textBody = isHtml ? getTextContent(fullDescription) : fullDescription;
    const fileContent = `Title:\n${title}\n\n${isHtml ? 'Description HTML:\n' + fullDescription + '\n\n' : ''}Description Text:\n${textBody}`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${platform}-listing.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
     if (!isHtml) return;
     const htmlContent = `<!DOCTYPE html><html><head><title>${title}</title><meta charset="UTF-8"></head><body>${fullDescription}</body></html>`;
     const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `ebay-listing-${Date.now()}.html`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300 capitalize">
          Generated {platform === 'ebay' ? 'eBay' : platform} Listing
        </h2>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          {isHtml && (
            <>
                <button
                    onClick={handleCopyHtml}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-colors"
                >
                    <span>{htmlCopied ? 'Copied!' : 'Copy HTML'}</span>
                    <CodeIcon />
                </button>
                <button
                    onClick={handleDownloadHtml}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 transition-colors"
                    title="Download as .html file (Best for embedded images)"
                >
                    <span>Download HTML</span>
                    <DownloadIcon />
                </button>
            </>
          )}
          
          <button
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
          >
            <span>{copied ? 'Copied!' : isHtml ? 'Copy All' : 'Copy Text'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          
           <button
            onClick={handleDownload}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition-colors"
            title="Download as .txt file"
          >
            <span>{isHtml ? 'Download Text' : 'Download'}</span>
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
            {isHtml ? (
                <>
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
                    {!hasBranding && (
                        <div className="mt-8 pt-8 border-t border-gray-700">
                            <article 
                                className="prose prose-invert prose-sm sm:prose-base max-w-none 
                                        leading-loose 
                                        prose-headings:text-gray-100 prose-headings:mt-6 prose-headings:mb-4
                                        prose-p:text-gray-400 prose-p:my-4"
                                dangerouslySetInnerHTML={{ __html: footerToUse }}
                            />
                        </div>
                    )}
                </>
            ) : (
                <div className="text-gray-300 font-sans text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {description}
                    {!hasBranding && (
                        <div className="mt-8 pt-8 border-t border-gray-700 text-gray-400">
                            {footerToUse}
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};