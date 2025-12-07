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

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card';
export type Platform = 'ebay' | 'facebook' | 'craigslist';

export interface ListingOptions {
    price?: string;
    location?: string;
    condition?: string;
}

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
    // eBay HTML Template Logic
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
    } else if (style === 'bold-classic') {
        return \`
            \${commonInstructions}

            **Description Generation (Bold Classic HTML Format):**
            *   Use a structured, high-contrast layout with horizontal rules.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h1 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">Title</h1>
                2.  <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 1.2em; font-weight: bold;">Part Number: \${partNumber}</span>
                    </div>
                3.  <hr />
                4.  <h3>Item Description</h3>
                    <p>[Analyze image and describe the item]</p>
                5.  <hr />
                6.  <h3>Vehicle Fitment</h3>
                    \${compatibilityHtml}
        \`;
    } else if (style === 'modern-card') {
        return \`
            \${commonInstructions}

            **Description Generation (Modern Card HTML Format):**
            *   Create a contained, card-style look.
            *   Wrap content in an <article style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; font-family: sans-serif;">.
            *   Structure:
                1.  <div style="background-color: #f3f4f6; padding: 20px; border-bottom: 1px solid #e5e7eb;">
                        <h2 style="margin: 0; color: #111827;">Title</h2>
                        <p style="margin: 10px 0 0; color: #4b5563;">Part #: <strong>\${partNumber}</strong> | Condition: <strong>Used OEM</strong></p>
                    </div>
                2.  <div style="padding: 20px;">
                        <h3 style="color: #374151;">Details</h3>
                        <p>[Analyze image and describe the item]</p>
                        <h3 style="color: #374151; margin-top: 20px;">Fitment Data</h3>
                        \${compatibilityHtml}
                    </div>
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
  style: ListingStyle = 'professional',
  platform: Platform = 'ebay',
  options?: ListingOptions
): Promise<{ title: string; description: string }> {
  const imagePart = imageDataUrlToGenerativePart(partImageDataUrl);
  
  let instructions = '';

  if (platform === 'facebook') {
    instructions = \`
        *   Create a catchy, engaging title for Facebook Marketplace (use 1-2 emojis in title).
        *   Include: Year range, Make, Model, Part name, Part number "\${partNumber}".
        *   **Description Generation (Facebook Format - Plain Text):**
        *   Use emojis (🔥, 🚗, ✅, ⚙️, 📦) to make it engaging and easy to read.
        *   Do NOT use HTML tags. Return plain text with line breaks (\\n).
        *   Structure:
            1.  **Header:** Part Name & Number
            2.  **Price:** \${options?.price ? options.price : '[Enter Price]'}
            3.  **Location:** \${options?.location ? options.location : '[Enter Location]'}
            4.  **Condition:** \${options?.condition || 'Used OEM (Good Condition)'}
            5.  **Description:** 2-3 short sentences about the part.
            6.  **Fitment:** Convert the following HTML compatibility table into a CLEAN text list (Year Make Model) with bullet points.
            7.  **Compatibility Data Source:** \${compatibilityHtml}
    \`;
  } else if (platform === 'craigslist') {
    instructions = \`
        *   Create a clear, descriptive, professional title for Craigslist.
        *   **Description Generation (Craigslist Format - Plain Text):**
        *   Clean, professional text. Minimal or no emojis.
        *   Do NOT use HTML tags. Return plain text with line breaks (\\n).
        *   Structure:
            1.  **Part:** Part Name & Number \${partNumber}
            2.  **Price:** \${options?.price ? options.price : '[Enter Price]'}
            3.  **Location:** \${options?.location ? options.location : '[Enter Location]'}
            4.  **Condition:** \${options?.condition || 'Used OEM'}
            5.  **Description:** Detailed description of the item.
            6.  **Fitment:** Convert the following HTML compatibility table into a structured text list.
            7.  **Compatibility Data Source:** \${compatibilityHtml}
    \`;
  } else {
    // eBay (HTML)
    instructions = getStyleInstruction(style, partNumber, compatibilityHtml);
  }

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
    console.error("Error generating listing:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to generate listing because the AI returned an invalid data format. Please try again.");
    }
    throw new Error(\`Failed to generate listing. \${error instanceof Error ? error.message : "An unknown AI error occurred."}\`);
  }
}`,
  'components/ResultCard.tsx': `import React, { useState } from 'react';
import { Platform } from '../services/geminiService';

interface ResultCardProps {
  title: string;
  description: string;
  platform?: Platform;
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

const STATIC_FOOTER_TEXT = \`
--------------------------------------------------
CRITICAL: Buyer Responsibility & Fitment
Please verify compatibility before purchasing. It is the buyer's sole responsibility to ensure this specific part fits your exact vehicle. Please check your part number or VIN.

Shipping & Return Policy
Shipping: Buyer pays shipping.
Returns: Accepted within 15 days if not as described.

About ChrisJayden Auto Repair
We are an Oklahoma City based rebuilder specializing in genuine OEM parts harvested from our quality rebuild projects. Buy with confidence.
\`;

export const ResultCard: React.FC<ResultCardProps> = ({ title, description, platform = 'ebay' }) => {
  const [copied, setCopied] = useState(false);
  const [htmlCopied, setHtmlCopied] = useState(false);

  const isHtml = platform === 'ebay';

  // Check if description already contains the branding to avoid duplication (for backward compatibility with old scans)
  const hasBranding = description.includes("ChrisJayden Auto Repair");
  const fullDescription = hasBranding 
    ? description 
    : description + (isHtml ? STATIC_FOOTER_HTML : STATIC_FOOTER_TEXT);

  // Strip HTML tags for the text-only copy
  const getTextContent = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.innerText;
  };

  const handleCopy = () => {
    const textBody = isHtml ? getTextContent(fullDescription) : fullDescription;
    navigator.clipboard.writeText(\`Title:\n\${title}\n\nDescription:\n\${textBody}\`);
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
    const fileContent = \`Title:\n\${title}\n\n\${isHtml ? 'Description HTML:\n' + fullDescription + '\\n\\n' : ''}Description Text:\n\${textBody}\`;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = \`\${platform}-listing.txt\`;
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
            <button
                onClick={handleCopyHtml}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-colors"
            >
                <span>{htmlCopied ? 'Copied!' : 'Copy HTML'}</span>
                <CodeIcon />
            </button>
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
                                dangerouslySetInnerHTML={{ __html: STATIC_FOOTER_HTML }}
                            />
                        </div>
                    )}
                </>
            ) : (
                <div className="text-gray-300 font-sans text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {description}
                    {!hasBranding && (
                        <div className="mt-8 pt-8 border-t border-gray-700 text-gray-400">
                            {STATIC_FOOTER_TEXT}
                        </div>
                    )}
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

  // Load from localStorage on mount
  useEffect(() => {
    const savedNote = localStorage.getItem('rapid_listing_notepad');
    if (savedNote) {
      setContent(savedNote);
    }
  }, []);

  // Save to localStorage whenever content changes
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
    if (window.confirm("Are you sure you want to clear the notepad?")) {
      setContent('');
    }
  };

  return (
    <div
      className={\`fixed inset-y-0 right-0 w-full sm:w-[30rem] bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[60] flex flex-col \${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }\`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/95 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Notepad
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 grid grid-cols-3 gap-2 bg-gray-800/50">
        <button
            onClick={handleImport}
            disabled={!currentListing}
            className={\`text-xs font-semibold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1
                \${!currentListing 
                    ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' 
                    : 'bg-gray-700 text-cyan-300 border-gray-600 hover:bg-gray-600 hover:text-cyan-200'}\`}
            title="Append current scan results to note"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import Current
        </button>
        <button
            onClick={handleCopy}
            className={\`text-xs font-semibold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1
                \${copyStatus === 'copied'
                    ? 'bg-green-900/30 border-green-500 text-green-400'
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'}\`}
        >
            {copyStatus === 'copied' ? 'Copied!' : 'Copy All'}
        </button>
        <button
            onClick={handleClear}
            className="text-xs font-semibold py-2 px-2 rounded border bg-gray-700 text-gray-400 border-gray-600 hover:bg-red-900/30 hover:text-red-400 hover:border-red-900/50 transition-colors"
        >
            Clear
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-grow p-0 relative">
        <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-gray-950 text-gray-300 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-cyan-500/30"
            placeholder="Use this space to refine descriptions, store HTML snippets, or keep notes. Your text is saved automatically."
            spellCheck={false}
        />
      </div>
      
      <div className="p-2 bg-gray-900 border-t border-gray-800 text-center">
         <p className="text-[10px] text-gray-600 uppercase tracking-wider">Auto-Save Enabled</p>
      </div>
    </div>
  );
};`,
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
  'App.tsx': `import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Spinner } from './components/Spinner';
import { extractPartNumberFromImage, generateListingContent, getCompatibilityData, ListingStyle, Platform } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { CompatibilityCard } from './components/CompatibilityCard';
import { ReplitSetupModal } from './components/ReplitSetupModal';
import { Logo } from './components/Logo';
import { HistorySidebar, SavedScan, SavedDraft } from './components/HistorySidebar';
import { NotepadSidebar } from './components/NotepadSidebar';

// Helper to convert base64 back to file for state restoration
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

  // History & Draft State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);

  // Notepad State
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  
  // Settings State
  const [listingStyle, setListingStyle] = useState<ListingStyle>('professional');
  const [platform, setPlatform] = useState<Platform>('ebay');

  // FB/Craigslist Options
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('Used - Good');

  // Load history and drafts from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('rapid_listing_history');
      if (storedHistory) {
        setSavedScans(JSON.parse(storedHistory));
      }
      const storedDrafts = localStorage.getItem('rapid_listing_drafts');
      if (storedDrafts) {
        setSavedDrafts(JSON.parse(storedDrafts));
      }
    } catch (e) {
      console.error("Failed to load local storage data", e);
    }
  }, []);

  const saveToHistory = (newScan: SavedScan) => {
    const updatedScans = [newScan, ...savedScans].slice(0, 50); // Keep last 50
    setSavedScans(updatedScans);
    localStorage.setItem('rapid_listing_history', JSON.stringify(updatedScans));
  };

  const deleteScan = (id: string) => {
    const updatedScans = savedScans.filter(s => s.id !== id);
    setSavedScans(updatedScans);
    localStorage.setItem('rapid_listing_history', JSON.stringify(updatedScans));
  };

  const handleSaveDraft = () => {
    if (!partImage && !serialImage && !manualPartNumber) {
      setError("Cannot save an empty draft. Please upload images or enter a part number.");
      return;
    }

    try {
      const newDraft: SavedDraft = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        // partImageBase64: partImage?.base64, // Images removed to save storage space
        // serialImageBase64: serialImage?.base64,
        partNumber: manualPartNumber,
      };

      const updatedDrafts = [newDraft, ...savedDrafts].slice(0, 10); // Limit to 10 drafts to save space
      setSavedDrafts(updatedDrafts);
      localStorage.setItem('rapid_listing_drafts', JSON.stringify(updatedDrafts));
      
      // Visual feedback
      setIsHistoryOpen(true);
    } catch (e) {
      setError("Storage limit reached. Please delete old drafts or history items.");
    }
  };

  const deleteDraft = (id: string) => {
    const updatedDrafts = savedDrafts.filter(d => d.id !== id);
    setSavedDrafts(updatedDrafts);
    localStorage.setItem('rapid_listing_drafts', JSON.stringify(updatedDrafts));
  };

  const loadScan = (scan: SavedScan) => {
    setListing({ title: scan.title, description: scan.description });
    setCompatibilityData(scan.compatibilityHtml);
    setManualPartNumber(scan.partNumber);
    // Set platform if available in history, otherwise default to ebay
    setPlatform(scan.platform || 'ebay');
    
    // Reset images/errors when loading from history
    setPartImage(null);
    setSerialImage(null);
    setError(null);
    setCompatibilityError(null);
    // Scroll to results
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    }, 100);
  };

  const loadDraft = async (draft: SavedDraft) => {
    setIsLoading(true); // Show loading state while processing images
    try {
      setManualPartNumber(draft.partNumber || '');
      setListing(null);
      setCompatibilityData(null);
      setError(null);

      // Drafts now only store text, so we clear images and prompt user
      setPartImage(null);
      setSerialImage(null);
      
      setIsHistoryOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError("Draft loaded. Please re-upload your images (images are not saved to save space).");
    } catch (e) {
      setError("Failed to restore draft.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImageUpload = useCallback(async (file: File, type: 'part' | 'serial') => {
    try {
      const base64 = await fileToBase64(file);
      if (type === 'part') {
        setPartImage({ file, base64 });
      } else {
        setSerialImage({ file, base64 });
      }
    } catch (err) {
      setError('Failed to process image. Please try another file.');
    }
  }, []);

  const handleGenerateListing = async () => {
    if (!partImage || !serialImage) {
      setError('Please upload both a part image and a serial number image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setListing(null);
    setCompatibilityData(null);
    setCompatibilityError(null);

    try {
      setCurrentStep('Extracting part number from image...');
      const partNumber = await extractPartNumberFromImage(serialImage.base64);

      if (!partNumber || partNumber.trim() === '') {
        throw new Error("Could not extract a part number from the image. Please try a clearer picture.");
      }
      
      setCurrentStep(\`Part number "\${partNumber}" found. Researching vehicle compatibility...\`);
      const compatibilityHtml = await getCompatibilityData(partNumber);
      
      setCurrentStep(\`Generating \${platform === 'ebay' ? 'eBay HTML' : platform === 'facebook' ? 'Facebook' : 'Craigslist'} listing...\`);
      
      const generatedListing = await generateListingContent(
          partImage.base64, 
          partNumber, 
          compatibilityHtml, 
          listingStyle, 
          platform,
          { price, location, condition }
      );

      setListing(generatedListing);
      setCompatibilityData(compatibilityHtml);

      // Auto-save to history
      saveToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        partNumber: partNumber,
        title: generatedListing.title,
        description: generatedListing.description,
        compatibilityHtml: compatibilityHtml,
        platform: platform
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(\`Generation failed: \${errorMessage}\`);
    } finally {
      setIsLoading(false);
      setCurrentStep('');
    }
  };

  const handleLookupCompatibility = async () => {
    if (!manualPartNumber.trim()) {
      setCompatibilityError('Please enter a part number.');
      return;
    }
    setIsCompatibilityLoading(true);
    setCompatibilityError(null);
    setCompatibilityData(null);
    setListing(null);
    setError(null);

    try {
      const data = await getCompatibilityData(manualPartNumber);
      setCompatibilityData(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setCompatibilityError(\`Lookup failed: \${errorMessage}\`);
    } finally {
      setIsCompatibilityLoading(false);
    }
  };


  const isGenerateButtonDisabled = !partImage || !serialImage || isLoading;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center relative overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-gray-900 to-gray-950 z-0"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[10%] left-[-10%] w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navigation Bar */}
      <nav className="w-full z-10 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                    <Logo className="h-10 w-10" />
                    <span className="text-xl font-bold tracking-tight text-white">
                        Rapid<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">Listing</span>Tool.com
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsNotepadOpen(true)}
                        className="text-gray-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span className="hidden sm:inline">Notepad</span>
                    </button>
                    <button 
                        onClick={() => setIsHistoryOpen(true)}
                        className="text-gray-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">History ({savedScans.length})</span>
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <div className="w-full max-w-5xl mx-auto flex flex-col flex-grow px-4 py-8 z-10">
        
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
            Automate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-fuchsia-500 animate-pulse">Auto Parts</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Upload photos, extract ACES/PIES data, and generate listings for eBay, Facebook Marketplace, or Craigslist in seconds.
          </p>
        </header>

        <main className="flex-grow w-full">
          <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50 mb-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6">
              <ImageUploader 
                id="part-image" 
                label="Step 1: Part Photo" 
                onImageUpload={(file) => handleImageUpload(file, 'part')} 
                imagePreviewUrl={partImage ? URL.createObjectURL(partImage.file) : null}
                onClearImage={() => setPartImage(null)}
              />
              <ImageUploader 
                id="serial-image" 
                label="Step 2: Serial # Photo" 
                onImageUpload={(file) => handleImageUpload(file, 'serial')} 
                imagePreviewUrl={serialImage ? URL.createObjectURL(serialImage.file) : null}
                onClearImage={() => setSerialImage(null)}
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm text-center animate-bounce-in">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Spinner className="h-12 w-12 text-fuchsia-500" />
                <p className="text-lg font-medium text-gray-300 animate-pulse">{currentStep}</p>
              </div>
            ) : (
              <div className="space-y-4">
                  {/* Platform Selector */}
                  <div className="flex justify-center mb-6">
                      <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-lg border border-gray-700">
                        <button
                          onClick={() => setPlatform('ebay')}
                          className={\`px-6 py-2 rounded-md text-sm font-medium transition-all \${
                            platform === 'ebay'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }\`}
                        >
                          eBay (HTML)
                        </button>
                        <button
                          onClick={() => setPlatform('facebook')}
                          className={\`px-6 py-2 rounded-md text-sm font-medium transition-all \${
                            platform === 'facebook'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }\`}
                        >
                          Facebook
                        </button>
                        <button
                          onClick={() => setPlatform('craigslist')}
                          className={\`px-6 py-2 rounded-md text-sm font-medium transition-all \${
                            platform === 'craigslist'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }\`}
                        >
                          Craigslist
                        </button>
                      </div>
                  </div>

                  {/* Settings Row - Only show Templates for eBay */}
                  {platform === 'ebay' && (
                      <div className="flex items-center justify-end gap-4 mb-2 animate-fade-in">
                        <label htmlFor="listing-style" className="text-sm font-medium text-gray-400">Template:</label>
                        <select
                            id="listing-style"
                            value={listingStyle}
                            onChange={(e) => setListingStyle(e.target.value as ListingStyle)}
                            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        >
                            <option value="professional">Professional (Standard)</option>
                            <option value="minimalist">Minimalist (Mobile Friendly)</option>
                            <option value="table-layout">Table Layout (Structured)</option>
                            <option value="bold-classic">Bold Classic (High Contrast)</option>
                            <option value="modern-card">Modern Card (Boxed Layout)</option>
                        </select>
                      </div>
                  )}

                  {/* Additional Fields for Facebook / Craigslist */}
                  {platform !== 'ebay' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Price</label>
                            <input 
                                type="text" 
                                value={price} 
                                onChange={(e) => setPrice(e.target.value)} 
                                placeholder="$0.00" 
                                className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                            <input 
                                type="text" 
                                value={location} 
                                onChange={(e) => setLocation(e.target.value)} 
                                placeholder="City, Zip" 
                                className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Condition</label>
                            <select 
                                value={condition} 
                                onChange={(e) => setCondition(e.target.value)} 
                                className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option>Used - Like New</option>
                                <option>Used - Good</option>
                                <option>Used - Fair</option>
                                <option>For Parts / Salvage</option>
                            </select>
                        </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                        onClick={handleSaveDraft}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-all duration-200 border border-gray-600 transform hover:scale-[1.02] active:scale-95"
                    >
                        Save Draft
                    </button>
                    <button
                        onClick={handleGenerateListing}
                        disabled={isGenerateButtonDisabled}
                        className={\`flex-[2] py-3 px-6 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-900/20
                        \${isGenerateButtonDisabled 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                        }\`}
                    >
                        GENERATE LISTING
                    </button>
                  </div>
              </div>
            )}
          </div>

          {listing && (
             <div className="mb-12 animate-fade-in-up">
               <ResultCard title={listing.title} description={listing.description} platform={platform} />
             </div>
          )}

          <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50">
             <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Manual Fitment Check
             </h2>
             <p className="text-gray-400 mb-4 text-sm">
                Enter a part number manually to check vehicle compatibility without generating a full listing.
             </p>
             <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="text" 
                  value={manualPartNumber}
                  onChange={(e) => setManualPartNumber(e.target.value)}
                  placeholder="Enter Part Number (e.g. 89661-02K30)"
                  className="flex-grow bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                />
                <button 
                  onClick={handleLookupCompatibility}
                  disabled={isCompatibilityLoading}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors whitespace-nowrap border border-gray-600"
                >
                  {isCompatibilityLoading ? 'Searching...' : 'Check Fitment'}
                </button>
             </div>
             {compatibilityError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-300 rounded-md text-sm">
                    {compatibilityError}
                </div>
             )}
             {compatibilityData && (
                <div className="mt-6 animate-fade-in">
                    <CompatibilityCard partNumber={manualPartNumber} compatibilityHtml={compatibilityData} />
                </div>
             )}
          </div>

        </main>

        <footer className="w-full text-center py-8 mt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} RapidListingTool.com. All rights reserved.
            </p>
            <button 
                onClick={() => setIsReplitModalOpen(true)} 
                className="mt-2 text-xs text-gray-700 hover:text-gray-500 transition-colors"
            >
                Download Source Code
            </button>
        </footer>
      </div>

      {/* Sidebars & Modals */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        scans={savedScans} 
        drafts={savedDrafts}
        onLoadScan={loadScan} 
        onDeleteScan={deleteScan} 
        onLoadDraft={loadDraft}
        onDeleteDraft={deleteDraft}
      />
      
      <NotepadSidebar 
        isOpen={isNotepadOpen} 
        onClose={() => setIsNotepadOpen(false)} 
        currentListing={listing} 
      />

      {isReplitModalOpen && <ReplitSetupModal onClose={() => setIsReplitModalOpen(false)} />}
    </div>
  );
}`,
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