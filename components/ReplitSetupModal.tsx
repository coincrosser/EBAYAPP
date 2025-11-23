import React, { useState } from 'react';

// NOTE: In a real production build system, this would be dynamic.
// For this demo, we are updating the file contents to match the new rebranding.
const fileContents = {
  'metadata.json': `{
  "name": "RapidListingTool.com",
  "description": "The ultimate AI-powered listing generator for auto parts. Rapidly create professional eBay listings with ACES/PIES data.",
  "requestFramePermissions": []
}`,
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RapidListingTool.com | AI Auto Parts Lister</title>
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <script src="env.js"></script>
    <style>
      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: #1a202c; }
      ::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #718096; }
      .glass-panel { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    </style>
  <script type="importmap">
{
  "imports": {
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.28.0",
    "react/": "https://aistudiocdn.com/react@^19.2.0/",
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/"
  }
}
</script>
</head>
  <body class="bg-gray-950 text-gray-100 selection:bg-fuchsia-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>`,
  'services/geminiService.ts': `import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout';

const imageDataUrlToGenerativePart = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    console.warn("Input was not a valid data URL. Falling back to image/jpeg.");
    return {
      inlineData: {
        data: dataUrl,
        mimeType: 'image/jpeg',
      },
    };
  }

  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
};

export async function extractPartNumberFromImage(imageDataUrl: string): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  const prompt = \`
    Analyze this image of a car part's serial number.
    Perform Optical Character Recognition (OCR) to identify and extract ONLY the most prominent and likely part number or serial number.
    Return ONLY the alphanumeric string of the part number, with no extra text, labels, or explanation.
    If multiple numbers are visible, return the one that is most clearly a serial/part number.
  \`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
    });
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI returned an empty response. Please try a clearer image.");
    }
    return text;
  } catch (error) {
    console.error("Error extracting part number:", error);
    throw new Error(\`Failed to extract part number from image. \${error instanceof Error ? error.message : 'An unknown AI error occurred.'}\`);
  }
}

export async function getCompatibilityData(partNumber: string): Promise<string> {
  const prompt = \`
    You are an expert on automotive parts and ACES/PIES compatibility data.
    For the given auto part number "\${partNumber}", perform a search to find its vehicle compatibility.
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes".
    If you cannot find any compatibility data, return a single HTML paragraph: <p>No compatibility information found for part number \${partNumber}.</p>
  \`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.trim().replace(/^\\\`\\\`\\\`html\\s*|\\\`\\\`\\\`$/g, '');
    if (!text) {
        throw new Error("The AI returned an empty response for compatibility data.");
    }
    return text;
  } catch (error) {
    console.error("Error fetching compatibility data:", error);
    throw new Error(\`Failed to look up compatibility data. \${error instanceof Error ? error.message : 'An unknown AI error occurred.'}\`);
  }
}

const getStyleInstruction = (style: ListingStyle, partNumber: string, compatibilityHtml: string): string => {
    // NOTE: Branding (ChrisJayden Auto Repair) is now handled in ResultCard.tsx to prevent duplication 
    // and ensure consistent formatting in the footer.
    
    const commonInstructions = \`
        *   Create a concise, SEO-friendly eBay title.
        *   Include: Year range, Make, Model, Part name, Part number "\${partNumber}", and key specifiers (e.g., AT/MT, Engine Size, OEM).
    \`;

    if (style === 'minimalist') {
        return \`
            \${commonInstructions}

            **Description Generation (Minimalist HTML Format):**
            *   The goal is a clean, mobile-friendly listing with short text and bullet points.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h2>Title</h2> (Same as generated title)
                2.  <h3>Quick Specs</h3>
                    <ul>
                        <li><strong>Part Number:</strong> \${partNumber}</li>
                        <li><strong>Condition:</strong> Used OEM (See Photos)</li>
                    </ul>
                3.  <h3>Vehicle Fitment</h3>
                    \${compatibilityHtml}
        \`;
    } else if (style === 'table-layout') {
        return \`
            \${commonInstructions}

            **Description Generation (Table Layout HTML Format):**
            *   The goal is a structured, technical look.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h2>Title</h2>
                2.  Create an HTML <table> with styling 'width:100%; border-collapse:collapse; margin-bottom:20px;'.
                    Rows should have a light gray background for headers.
                    Rows:
                    *   <strong>Part Number</strong> | \${partNumber}
                    *   <strong>Condition</strong> | Used OEM
                    *   <strong>Warranty</strong> | See Policy Below
                3.  <h3>Detailed Description</h3>
                    <p>[Analyze image and describe the item in 2-3 sentences]</p>
                    <p><strong>Stock Note:</strong> Item is a genuine OEM part harvested from our rebuild projects.</p>
                4.  <h3>Compatibility</h3>
                    \${compatibilityHtml}
        \`;
    } else {
        // Professional (Default / LKQ Style)
        return \`
            \${commonInstructions}

            **Description Generation (Professional HTML Format):**
            *   The entire description must be a single HTML string.
            *   The root element must be an <article> tag.
            *   Each major part MUST be wrapped in a <section> tag with style="margin-bottom: 1.5rem;".
            *   Structure:
                a. **Header:** <h2>Title</h2>, <p><strong>Part Number:</strong> \${partNumber}</p>.
                b. **Product Details:** <h3>Product Details</h3>. Analyze image for condition. State this is a Genuine OEM part.
                c. **Compatibility:** <h3>Vehicle Compatibility</h3> \${compatibilityHtml}
        \`;
    }
};

export async function generateListingContent(
  partImageDataUrl: string,
  partNumber: string,
  compatibilityHtml: string,
  style: ListingStyle = 'professional'
): Promise<{ title: string; description: string }> {
  const imagePart = imageDataUrlToGenerativePart(partImageDataUrl);
  
  const instructions = getStyleInstruction(style, partNumber, compatibilityHtml);

  const prompt = \`
    You are an expert copywriter for ChrisJayden Auto Repair, a professional auto parts seller.
    Based on the provided part number "\${partNumber}" and the attached image of a used auto part, generate a listing in JSON format.

    \${instructions}

    Your response MUST be a single, valid JSON object with two keys: "title" and "description".
  \`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
            },
            required: ['title', 'description'],
        },
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("The AI returned an empty response.");
    }
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating eBay listing:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to generate listing because the AI returned an invalid data format. Please try again.");
    }
    throw new Error(\`Failed to generate listing. \${error instanceof Error ? error.message : "An unknown AI error occurred."}\`);
  }
}`,
  'components/ResultCard.tsx': `import React, { useState } from 'react';

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
const STATIC_FOOTER_HTML = \`
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
\`;

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
    navigator.clipboard.writeText(\`Title:\n\${title}\n\nDescription:\n\${textBody}\`);
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
    const fileContent = \`Title:\n\${title}\n\nDescription HTML:\n\${fullDescriptionHtml}\n\nDescription Text:\n\${textBody}\`;
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
};`,
  'components/NotepadSidebar.tsx': `import React, { useState, useEffect } from 'react';

interface NotepadSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentListing: { title: string; description: string } | null;
}

export const NotepadSidebar: React.FC<NotepadSidebarProps> = ({ isOpen, onClose, currentListing }) => {
  const [content, setContent] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    const savedNote = localStorage.getItem('rapid_listing_notepad');
    if (savedNote) setContent(savedNote);
  }, []);

  useEffect(() => {
    localStorage.setItem('rapid_listing_notepad', content);
  }, [content]);

  const handleImport = () => {
    if (!currentListing) return;
    const newContent = \`TITLE:\n\${currentListing.title}\n\nDESCRIPTION HTML:\n\${currentListing.description}\n\n-------------------\n\n\${content}\`;
    setContent(newContent);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the notepad?")) setContent('');
  };

  return (
    <div className={\`fixed inset-y-0 right-0 w-full sm:w-[30rem] bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[60] flex flex-col \${isOpen ? 'translate-x-0' : 'translate-x-full'}\`}>
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/95 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white flex items-center">Notepad</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">Close</button>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2 bg-gray-800/50">
        <button onClick={handleImport} disabled={!currentListing} className={\`text-xs font-semibold py-2 px-2 rounded border transition-colors \${!currentListing ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' : 'bg-gray-700 text-cyan-300 border-gray-600 hover:bg-gray-600 hover:text-cyan-200'}\`}>Import Current</button>
        <button onClick={handleCopy} className={\`text-xs font-semibold py-2 px-2 rounded border transition-colors \${copyStatus === 'copied' ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'}\`}>{copyStatus === 'copied' ? 'Copied!' : 'Copy All'}</button>
        <button onClick={handleClear} className="text-xs font-semibold py-2 px-2 rounded border bg-gray-700 text-gray-400 border-gray-600 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/50 transition-colors">Clear</button>
      </div>
      <div className="flex-grow p-0 relative">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full bg-gray-950 text-gray-300 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-cyan-500/30" placeholder="Use this space to refine descriptions..." spellCheck={false} />
      </div>
    </div>
  );
};`,
  'components/HistorySidebar.tsx': `import React, { useState } from 'react';
import { downloadEbayCSV } from '../utils/csvExport';

export interface SavedScan {
  id: string;
  timestamp: number;
  partNumber: string;
  title: string;
  description: string;
  compatibilityHtml: string;
}

export interface SavedDraft {
  id: string;
  timestamp: number;
  partImageBase64?: string;
  serialImageBase64?: string;
  partNumber?: string;
}

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  scans: SavedScan[];
  drafts: SavedDraft[];
  onLoadScan: (scan: SavedScan) => void;
  onDeleteScan: (id: string) => void;
  onLoadDraft: (draft: SavedDraft) => void;
  onDeleteDraft: (id: string) => void;
}

interface HistoryItemProps {
  scan: SavedScan;
  onLoad: () => void;
  onDelete: () => void;
}

interface DraftItemProps {
  draft: SavedDraft;
  onLoad: () => void;
  onDelete: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ scan, onLoad, onDelete }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const handleCopyFitment = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(scan.compatibilityHtml);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-fuchsia-500/50 transition-colors group relative">
      <div className="flex justify-between items-start mb-2">
        <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-700 text-fuchsia-300 rounded">{scan.partNumber}</span>
        <span className="text-xs text-gray-500">{new Date(scan.timestamp).toLocaleDateString()}</span>
      </div>
      <h3 className="text-sm font-medium text-white line-clamp-2 mb-3">{scan.title}</h3>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={onLoad} className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded flex items-center justify-center transition-colors">View Scan</button>
        <button onClick={handleCopyFitment} className={\`text-xs py-2 px-3 rounded flex items-center justify-center transition-colors border \${copyStatus === 'copied' ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-300'}\`}>{copyStatus === 'copied' ? 'Copied!' : 'Copy Fitment'}</button>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">Delete</button>
    </div>
  );
};

const DraftItem: React.FC<DraftItemProps> = ({ draft, onLoad, onDelete }) => {
    const thumb = draft.partImageBase64 || draft.serialImageBase64;
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-cyan-500/50 transition-colors group relative flex gap-3 items-center">
        <div className="h-16 w-16 bg-gray-900 rounded overflow-hidden flex-shrink-0 border border-gray-600">
            {thumb ? ( <img src={thumb} alt="Draft" className="h-full w-full object-cover" /> ) : ( <div className="h-full w-full flex items-center justify-center text-gray-600">NO IMG</div> )}
        </div>
        <div className="flex-grow min-w-0">
            <p className="text-xs text-cyan-400 font-semibold mb-1">{draft.partNumber ? \`Draft: \${draft.partNumber}\` : 'Untitled Draft'}</p>
            <p className="text-[10px] text-gray-500 mb-2">{new Date(draft.timestamp).toLocaleDateString()} {new Date(draft.timestamp).toLocaleTimeString()}</p>
            <button onClick={onLoad} className="text-xs bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 px-3 py-1 rounded transition-colors">Resume</button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">Delete</button>
      </div>
    );
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, onClose, scans, drafts, onLoadScan, onDeleteScan, onLoadDraft, onDeleteDraft }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'drafts'>('history');
  return (
    <div className={\`fixed inset-y-0 right-0 w-full sm:w-96 bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col \${isOpen ? 'translate-x-0' : 'translate-x-full'}\`}>
      <div className="p-4 bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-white flex items-center">Activity</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">Close</button>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-1">
            <button onClick={() => setActiveTab('history')} className={\`flex-1 text-sm font-medium py-1.5 rounded-md transition-all \${activeTab === 'history' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}\`}>History</button>
            <button onClick={() => setActiveTab('drafts')} className={\`flex-1 text-sm font-medium py-1.5 rounded-md transition-all \${activeTab === 'drafts' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}\`}>Drafts</button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {activeTab === 'history' ? (
            scans.length === 0 ? <div className="text-center text-gray-500 mt-10"><p>No history yet.</p></div> : scans.map((scan) => <HistoryItem key={scan.id} scan={scan} onLoad={() => { onLoadScan(scan); onClose(); }} onDelete={() => onDeleteScan(scan.id)} />)
        ) : (
            drafts.length === 0 ? <div className="text-center text-gray-500 mt-10"><p>No saved drafts.</p></div> : drafts.map((draft) => <DraftItem key={draft.id} draft={draft} onLoad={() => { onLoadDraft(draft); }} onDelete={() => onDeleteDraft(draft.id)} />)
        )}
      </div>
      {activeTab === 'history' && scans.length > 0 && (
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
            <button onClick={() => downloadEbayCSV(scans)} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">Export to eBay CSV</button>
        </div>
      )}
    </div>
  );
};`,
  'utils/csvExport.ts': `import { SavedScan } from "../components/HistorySidebar";

// Static footer content to ensure exported CSVs include the branding and policies
// matching the UI presentation in ResultCard.
const STATIC_FOOTER_HTML = \`
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
\`;

export const downloadEbayCSV = (scans: SavedScan[]) => {
  if (!scans.length) return;

  // eBay Seller Hub Reports (Drafts) Template Headers
  // As provided by the user
  const infoRows = [
    "#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,",
    "#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html,,,,,,,,,,",
    \`"#INFO After you've successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",,,,,,,,,,\`,
    "#INFO,,,,,,,,,,"
  ];

  const headerRow = "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description,Format";

  const rows = scans.map(scan => {
    // CSV formatting: wrap in quotes, escape existing quotes with double quotes
    const escapeCsv = (str: string) => \`"\${(str || '').replace(/"/g, '""')}"\`;

    const action = "Draft";
    const sku = escapeCsv(scan.partNumber);
    const categoryId = ""; // Left blank for user input in eBay
    const title = escapeCsv(scan.title);
    const upc = "";
    const price = ""; // Left blank
    const quantity = "1";
    const photoUrl = ""; // Images are local, cannot be exported to CSV. User must upload in eBay.
    const conditionId = "3000"; // Used

    // Append branding if not present
    let descriptionHtml = scan.description;
    if (!descriptionHtml.includes("ChrisJayden Auto Repair")) {
        descriptionHtml += STATIC_FOOTER_HTML;
    }
    const description = escapeCsv(descriptionHtml);
    
    const format = "FixedPrice";

    return [
      action,
      sku,
      categoryId,
      title,
      upc,
      price,
      quantity,
      photoUrl,
      conditionId,
      description,
      format
    ].join(",");
  });

  const csvContent = [...infoRows, headerRow, ...rows].join("\\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", \`rapid_listing_drafts_\${new Date().toISOString().slice(0,10)}.csv\`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};`,
  'App.tsx': `import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Spinner } from './components/Spinner';
import { extractPartNumberFromImage, generateListingContent, getCompatibilityData, ListingStyle } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { CompatibilityCard } from './components/CompatibilityCard';
import { ReplitSetupModal } from './components/ReplitSetupModal';
import { Logo } from './components/Logo';
import { HistorySidebar, SavedScan, SavedDraft } from './components/HistorySidebar';
import { NotepadSidebar } from './components/NotepadSidebar';

const base64ToFile = async (base64: string, fileName: string): Promise<File> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
};

export default function App() {
  const [partImage, setPartImage] = useState<{ file: File; base64: string } | null>(null);
  const [serialImage, setSerialImage] = useState<{ file: File; base64: string } | null>(null);
  const [listing, setListing] = useState<{ title: string; description: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualPartNumber, setManualPartNumber] = useState('');
  const [compatibilityData, setCompatibilityData] = useState<string | null>(null);
  const [isCompatibilityLoading, setIsCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [isReplitModalOpen, setIsReplitModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [listingStyle, setListingStyle] = useState<ListingStyle>('professional');

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('rapid_listing_history');
      if (storedHistory) setSavedScans(JSON.parse(storedHistory));
      const storedDrafts = localStorage.getItem('rapid_listing_drafts');
      if (storedDrafts) setSavedDrafts(JSON.parse(storedDrafts));
    } catch (e) { console.error("Failed to load local storage", e); }
  }, []);

  const saveToHistory = (newScan: SavedScan) => {
    const updatedScans = [newScan, ...savedScans].slice(0, 50);
    setSavedScans(updatedScans);
    localStorage.setItem('rapid_listing_history', JSON.stringify(updatedScans));
  };
  const deleteScan = (id: string) => {
    const updated = savedScans.filter(s => s.id !== id);
    setSavedScans(updated);
    localStorage.setItem('rapid_listing_history', JSON.stringify(updated));
  };
  const handleSaveDraft = () => {
    if (!partImage && !serialImage && !manualPartNumber) { setError("Cannot save empty draft."); return; }
    try {
      const newDraft: SavedDraft = { id: crypto.randomUUID(), timestamp: Date.now(), partImageBase64: partImage?.base64, serialImageBase64: serialImage?.base64, partNumber: manualPartNumber };
      const updated = [newDraft, ...savedDrafts].slice(0, 10);
      setSavedDrafts(updated);
      localStorage.setItem('rapid_listing_drafts', JSON.stringify(updated));
      setIsHistoryOpen(true);
    } catch (e) { setError("Storage limit reached. Delete old items."); }
  };
  const deleteDraft = (id: string) => {
    const updated = savedDrafts.filter(d => d.id !== id);
    setSavedDrafts(updated);
    localStorage.setItem('rapid_listing_drafts', JSON.stringify(updated));
  };
  const loadScan = (scan: SavedScan) => {
    setListing({ title: scan.title, description: scan.description });
    setCompatibilityData(scan.compatibilityHtml);
    setManualPartNumber(scan.partNumber);
    setPartImage(null); setSerialImage(null); setError(null); setCompatibilityError(null);
    setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' }); }, 100);
  };
  const loadDraft = async (draft: SavedDraft) => {
    setIsLoading(true);
    try {
      setManualPartNumber(draft.partNumber || ''); setListing(null); setCompatibilityData(null); setError(null);
      if (draft.partImageBase64) setPartImage({ file: await base64ToFile(draft.partImageBase64, "draft_p.png"), base64: draft.partImageBase64 });
      else setPartImage(null);
      if (draft.serialImageBase64) setSerialImage({ file: await base64ToFile(draft.serialImageBase64, "draft_s.png"), base64: draft.serialImageBase64 });
      else setSerialImage(null);
      setIsHistoryOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError("Failed to restore draft."); } finally { setIsLoading(false); }
  };

  const handleImageUpload = useCallback(async (file: File, type: 'part' | 'serial') => {
    try {
      const base64 = await fileToBase64(file);
      if (type === 'part') setPartImage({ file, base64 }); else setSerialImage({ file, base64 });
    } catch (err) { setError('Failed to process image.'); }
  }, []);

  const handleGenerateListing = async () => {
    if (!partImage || !serialImage) { setError('Please upload both images.'); return; }
    setIsLoading(true); setError(null); setListing(null); setCompatibilityData(null);
    try {
      setCurrentStep('Extracting part number...');
      const partNumber = await extractPartNumberFromImage(serialImage.base64);
      setCurrentStep(\`Part "\${partNumber}" found. Checking fitment...\`);
      const compatibilityHtml = await getCompatibilityData(partNumber);
      setCurrentStep(\`Generating listing (\${listingStyle})...\`);
      const generatedListing = await generateListingContent(partImage.base64, partNumber, compatibilityHtml, listingStyle);
      setListing(generatedListing);
      setCompatibilityData(compatibilityHtml);
      saveToHistory({ id: crypto.randomUUID(), timestamp: Date.now(), partNumber, title: generatedListing.title, description: generatedListing.description, compatibilityHtml });
    } catch (err: unknown) { setError(\`Generation failed: \${err instanceof Error ? err.message : 'Unknown error'}\`); } finally { setIsLoading(false); setCurrentStep(''); }
  };

  const handleLookupCompatibility = async () => {
    if (!manualPartNumber.trim()) { setCompatibilityError('Enter part number.'); return; }
    setIsCompatibilityLoading(true); setCompatibilityError(null);
    try {
      const data = await getCompatibilityData(manualPartNumber);
      setCompatibilityData(data);
    } catch (err: unknown) { setCompatibilityError(\`Lookup failed: \${err instanceof Error ? err.message : 'Unknown'}\`); } finally { setIsCompatibilityLoading(false); }
  };

  return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center relative overflow-x-hidden">
          {/* Background omitted for brevity */}
          <nav className="w-full z-10 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                 <div className="flex items-center gap-3"><Logo className="h-10 w-10" /><span className="text-xl font-bold">RapidListingTool.com</span></div>
                 <div className="flex gap-2">
                    <button onClick={() => setIsNotepadOpen(true)} className="text-gray-300 hover:text-white">Notepad</button>
                    <button onClick={() => setIsHistoryOpen(true)} className="text-gray-300 hover:text-white">History ({savedScans.length})</button>
                 </div>
             </div>
          </nav>
          <div className="w-full max-w-5xl mx-auto flex flex-col flex-grow px-4 py-8 z-10">
             <main className="flex-grow w-full">
                <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50 mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6">
                        <ImageUploader id="part" label="Step 1: Part Photo" onImageUpload={(f)=>handleImageUpload(f,'part')} imagePreviewUrl={partImage ? URL.createObjectURL(partImage.file) : null} onClearImage={()=>setPartImage(null)} />
                        <ImageUploader id="serial" label="Step 2: Serial Photo" onImageUpload={(f)=>handleImageUpload(f,'serial')} imagePreviewUrl={serialImage ? URL.createObjectURL(serialImage.file) : null} onClearImage={()=>setSerialImage(null)} />
                    </div>
                    {error && <div className="mb-6 p-4 bg-red-900/30 text-red-200 rounded-lg text-center">{error}</div>}
                    {isLoading ? <Spinner /> : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-end gap-4 mb-2">
                                <label className="text-sm font-medium text-gray-400">Template:</label>
                                <select value={listingStyle} onChange={(e) => setListingStyle(e.target.value as ListingStyle)} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg p-2.5">
                                    <option value="professional">Professional (Standard)</option>
                                    <option value="minimalist">Minimalist (Mobile Friendly)</option>
                                    <option value="table-layout">Table Layout (Structured)</option>
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleSaveDraft} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold border border-gray-600">Save Draft</button>
                                <button onClick={handleGenerateListing} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold">GENERATE</button>
                            </div>
                        </div>
                    )}
                </div>
                {listing && <ResultCard title={listing.title} description={listing.description} />}
             </main>
             <footer className="w-full text-center py-8 mt-8 border-t border-gray-800">
                <p className="text-gray-500 text-sm">&copy; RapidListingTool.com</p>
                <button onClick={() => setIsReplitModalOpen(true)} className="mt-2 text-xs text-gray-700 hover:text-gray-500">Download Source Code</button>
             </footer>
          </div>
          <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} scans={savedScans} drafts={savedDrafts} onLoadScan={loadScan} onDeleteScan={deleteScan} onLoadDraft={loadDraft} onDeleteDraft={deleteDraft} />
          <NotepadSidebar isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} currentListing={listing} />
          {isReplitModalOpen && <ReplitSetupModal onClose={() => setIsReplitModalOpen(false)} />}
      </div>
  );
}`,
  'components/Logo.tsx': `import React from 'react';
export const Logo = ({ className = "h-12 w-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="mindBendingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d946ef" />
        <stop offset="50%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g filter="url(#glow)">
      <path d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 Z" stroke="url(#mindBendingGradient)" strokeWidth="4" className="origin-center animate-[spin_10s_linear_infinite]" strokeLinecap="round"/>
      <path d="M30 40 L70 40 M20 50 L80 50 M30 60 L70 60" stroke="url(#mindBendingGradient)" strokeWidth="3" strokeLinecap="round" className="opacity-80"/>
      <path d="M40 25 V75 M40 25 H60 C75 25 75 50 60 50 H40 M60 50 L75 75" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  </svg>
);`,
};

interface FileContentDisplayerProps {
    content: string;
}

const FileContentDisplayer: React.FC<FileContentDisplayerProps> = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative bg-gray-900 rounded-lg mt-2">
            <button onClick={handleCopy} className="absolute top-2 right-2 px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{copied ? 'Copied!' : 'Copy'}</button>
            <pre className="p-4 overflow-auto text-sm text-gray-300" style={{ maxHeight: '50vh' }}><code>{content}</code></pre>
        </div>
    );
};

export const ReplitSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState(Object.keys(fileContents)[0]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
                <header className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">Download Project Source</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">Close</button>
                </header>
                <div className="p-6 overflow-y-auto">
                    <div className="mb-4 bg-blue-900/30 border border-blue-700 text-blue-200 p-3 rounded-lg text-sm">
                        <p className="font-bold mb-1">Deployment Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>These files form a React + Vite application.</li>
                            <li>Copy/Paste files into your local environment or hosting provider.</li>
                        </ol>
                    </div>
                    <div className="border-b border-gray-600">
                        <nav className="flex flex-wrap -mb-px">
                            {Object.keys(fileContents).map(filename => (
                                <button key={filename} onClick={() => setActiveTab(filename)} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${activeTab === filename ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>{filename}</button>
                            ))}
                        </nav>
                    </div>
                    <FileContentDisplayer content={fileContents[activeTab]} />
                </div>
            </div>
        </div>
    );
};