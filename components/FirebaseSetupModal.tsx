import React, { useState } from 'react';

// This component provides the necessary files to deploy to Firebase
// We update the files content to reflect the latest changes (Scan Type, Barcode logic, Settings)
const fileContents = {
  '.firebaserc': `{
  "projects": {
    "default": "rapidlistingtool"
  }
}`,
  'firebase.json': `{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}`,
  'package.json': `{
  "name": "rapid-listing-tool",
  "private": true,
  "version": "1.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^0.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
  }
}`,
  'vite.config.ts': `import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})`,
  '.env.local': `API_KEY=your_api_key_here`,
  'src/services/geminiService.ts': `import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card';
export type Platform = 'ebay' | 'facebook' | 'craigslist';
export type ScanType = 'auto-part' | 'general-item';

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

export async function extractIdentifierFromImage(imageDataUrl: string, type: ScanType): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  const autoPrompt = \`
    Analyze this image of a car part.
    Perform Optical Character Recognition (OCR) to identify and extract ONLY the most prominent part number or serial number.
    Return ONLY the alphanumeric string, with no extra text.
  \`;

  const generalPrompt = \`
    Analyze this image of a product.
    Look specifically for a BARCODE (UPC, EAN), ISBN, or a printed Model Number.
    Perform OCR to read the numbers below the barcode or the text on the label.
    Return ONLY the numeric UPC/EAN code or alphanumeric Model Number.
    If multiple are visible, prefer the UPC (12 digits) or EAN (13 digits).
    Do not add labels like "UPC:" or "Model:". Just return the code.
  \`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: type === 'auto-part' ? autoPrompt : generalPrompt }] },
    });
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI returned an empty response. Please try a clearer image of the barcode or part number.");
    }
    return text;
  } catch (error) {
    console.error("Error extracting identifier:", error);
    throw new Error(\`Failed to extract data from image. \${error instanceof Error ? error.message : 'An unknown AI error occurred.'}\`);
  }
}

export async function getProductData(identifier: string, type: ScanType): Promise<string> {
  const autoPrompt = \`
    You are an expert on automotive parts and ACES/PIES compatibility data.
    For the given auto part number "\${identifier}", perform a search to find its vehicle compatibility.
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \\\`\\\`\\\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes".
    If you cannot find any data, return: <p>No compatibility information found for part number \${identifier}.</p>
  \`;

  const generalPrompt = \`
    You are an expert product researcher.
    For the given product identifier (UPC, Barcode, or Model Name): "\${identifier}", perform a search to find its technical specifications.
    Your response must be ONLY a well-structured HTML table with a header row (<th>).
    Ensure the table is formatted for easy reading.
    Do not include any other text.
    The table should have columns for: "Brand", "Model/MPN", "Category", "Key Features", and "Dimensions/Weight" (if available).
    If you cannot find specific data, return: <p>No specific product details found for ID \${identifier}.</p>
  \`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: type === 'auto-part' ? autoPrompt : generalPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.trim().replace(/^\\\`\\\`\\\`html\\s*|\\\`\\\`\\\`$/g, '');
    if (!text) {
        throw new Error("The AI returned an empty response for data lookup.");
    }
    return text;
  } catch (error) {
    console.error("Error fetching product data:", error);
    throw new Error(\`Failed to look up data. \${error instanceof Error ? error.message : 'An unknown AI error occurred.'}\`);
  }
}

const getStyleInstruction = (style: ListingStyle, identifier: string, supplementalHtml: string, type: ScanType): string => {
    // Shared instructions
    const commonInstructions = \`
        *   Create a concise, SEO-friendly eBay title.
        *   Include: Brand, Model, Key Features, and ID "\${identifier}".
    \`;

    // Branding text logic is handled in ResultCard now, but we guide the structure here.
    const isAuto = type === 'auto-part';
    const specTitle = isAuto ? "Vehicle Fitment" : "Product Specifications";
    const condTitle = isAuto ? "Used OEM" : "Pre-Owned / Used";

    if (style === 'minimalist') {
        return \`
            \${commonInstructions}
            **Description Generation (Minimalist HTML):**
            *   Clean, mobile-friendly, bullet points.
            *   Structure:
                1.  <h2>Title</h2>
                2.  <h3>Quick Specs</h3>
                    <ul>
                        <li><strong>ID:</strong> \${identifier}</li>
                        <li><strong>Condition:</strong> \${condTitle} (See Photos)</li>
                    </ul>
                3.  <h3>\${specTitle}</h3>
                    \${supplementalHtml}
        \`;
    } else if (style === 'table-layout') {
        return \`
            \${commonInstructions}
            **Description Generation (Table Layout HTML):**
            *   Structured, technical look.
            *   Structure:
                1.  <h2>Title</h2>
                2.  HTML Table (width:100%):
                    *   <strong>ID/SKU</strong> | \${identifier}
                    *   <strong>Condition</strong> | \${condTitle}
                3.  <h3>Detailed Description</h3>
                    <p>[Analyze image and describe item]</p>
                4.  <h3>\${specTitle}</h3>
                    \${supplementalHtml}
        \`;
    } else if (style === 'bold-classic') {
        return \`
            \${commonInstructions}
            **Description Generation (Bold Classic HTML):**
            *   High-contrast, centered, horizontal rules.
            *   Structure:
                1.  <h1 style="text-align: center; border-bottom: 2px solid #000;">Title</h1>
                2.  <div style="text-align: center; font-weight: bold;">ID: \${identifier}</div>
                3.  <hr />
                4.  <h3>Item Description</h3>
                    <p>[Analyze image and describe item]</p>
                5.  <hr />
                6.  <h3>\${specTitle}</h3>
                    \${supplementalHtml}
        \`;
    } else if (style === 'modern-card') {
        return \`
            \${commonInstructions}
            **Description Generation (Modern Card HTML):**
            *   Boxed layout, gray headers.
            *   Structure:
                1.  <div style="background-color: #f3f4f6; padding: 20px;">
                        <h2>Title</h2>
                        <p>ID: <strong>\${identifier}</strong> | Condition: <strong>\${condTitle}</strong></p>
                    </div>
                2.  <div style="padding: 20px;">
                        <h3>Details</h3>
                        <p>[Analyze image and describe item]</p>
                        <h3>\${specTitle}</h3>
                        \${supplementalHtml}
                    </div>
        \`;
    } else {
        // Professional (Default)
        return \`
            \${commonInstructions}
            **Description Generation (Professional HTML):**
            *   Standard standard listing format.
            *   Structure:
                a. **Header:** <h2>Title</h2>, <p><strong>ID:</strong> \${identifier}</p>.
                b. **Details:** <h3>Product Details</h3>. Analyze image for condition.
                c. **Specs:** <h3>\${specTitle}</h3> \${supplementalHtml}
        \`;
    }
};

export async function generateListingContent(
  partImageDataUrl: string,
  identifier: string,
  supplementalHtml: string,
  style: ListingStyle = 'professional',
  platform: Platform = 'ebay',
  type: ScanType = 'auto-part',
  options?: ListingOptions
): Promise<{ title: string; description: string }> {
  const imagePart = imageDataUrlToGenerativePart(partImageDataUrl);
  
  let instructions = '';
  const specLabel = type === 'auto-part' ? 'Vehicle Fitment' : 'Product Specs';

  // Handle condition formatting for FB/Craigslist
  let conditionText = options?.condition || (type === 'auto-part' ? 'Used OEM' : 'Used');
  if ((platform === 'facebook' || platform === 'craigslist') && conditionText === 'Used - Fair') {
      conditionText += ' (As Is)';
  }

  if (platform === 'facebook') {
    instructions = \`
        *   Create a catchy, engaging title for Facebook Marketplace (use 1-2 emojis).
        *   **Description Generation (Facebook - Plain Text):**
        *   Use emojis (🔥, 📦, ✅). No HTML.
        *   Structure:
            1.  **Header:** Item Name & ID
            2.  **Price:** \${options?.price || '[Enter Price]'}
            3.  **Location:** \${options?.location || '[Enter Location]'}
            4.  **Condition:** \${conditionText}
            5.  **Description:** 2-3 short sentences.
            6.  **\${specLabel}:** Convert the HTML table below into a text list.
            7.  **Data:** \${supplementalHtml}
    \`;
  } else if (platform === 'craigslist') {
    instructions = \`
        *   Create a clear, professional title for Craigslist.
        *   **Description Generation (Craigslist - Plain Text):**
        *   Clean text. No HTML.
        *   Structure:
            1.  **Item:** Name & ID \${identifier}
            2.  **Price:** \${options?.price || '[Enter Price]'}
            3.  **Location:** \${options?.location || '[Enter Location]'}
            4.  **Condition:** \${conditionText}
            5.  **Description:** Detailed description.
            6.  **\${specLabel}:** Convert HTML table to text list.
            7.  **Data:** \${supplementalHtml}
    \`;
  } else {
    // eBay (HTML)
    instructions = getStyleInstruction(style, identifier, supplementalHtml, type);
  }

  const prompt = \`
    You are an expert reseller.
    Based on the provided identifier "\${identifier}" and the image of the item.
    Item Type: \${type === 'auto-part' ? 'Automotive Part' : 'General Merchandise (Electronics, Home, etc.)'}.
    
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
        throw new Error("Failed to generate listing due to invalid AI response format. Try again.");
    }
    throw new Error(\`Failed to generate listing. \${error instanceof Error ? error.message : "An unknown AI error occurred."}\`);
  }
}`,
  'src/components/SettingsModal.tsx': `import React, { useState, useEffect } from 'react';

export interface UserProfile {
  businessName: string;
  location: string;
  shippingPolicy: string;
  returnPolicy: string;
  aboutAuto: string;
  aboutGeneral: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  businessName: "ChrisJayden",
  location: "Oklahoma City",
  shippingPolicy: "The buyer is responsible for all shipping costs associated with this item.",
  returnPolicy: "We stand behind the accuracy of our listings. If you receive an item that is not as described, returns are accepted within 15 days of receipt.",
  aboutAuto: "At ChrisJayden Auto Repair, our business is built on hands-on automotive experience. Based physically in Oklahoma City, we specialize in the meticulous process of acquiring salvage vehicles and performing complete quality rebuilds. We harvest the best components—the very kind we trust in our own rebuild projects—and make them available to you.",
  aboutGeneral: "We are a trusted Oklahoma City based seller committed to providing quality pre-owned and surplus items. Buy with confidence."
};

interface SettingsModalProps {
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
  currentProfile: UserProfile;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave, currentProfile }) => {
  const [profile, setProfile] = useState<UserProfile>(currentProfile);

  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    if (window.confirm("Reset to default ChrisJayden profile?")) {
        setProfile(DEFAULT_PROFILE);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(profile);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[70] p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700">
        <header className="flex justify-between items-center p-5 border-b border-gray-700 bg-gray-800 rounded-t-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Business Profile Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-sm text-blue-200">
                This information will be automatically appended to the bottom of your listings and CSV exports.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Business Name</label>
                    <input 
                        type="text" 
                        value={profile.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. ChrisJayden"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                    <input 
                        type="text" 
                        value={profile.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. Oklahoma City"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Shipping Policy</label>
                <textarea 
                    value={profile.shippingPolicy}
                    onChange={(e) => handleChange('shippingPolicy', e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Return Policy</label>
                <textarea 
                    value={profile.returnPolicy}
                    onChange={(e) => handleChange('returnPolicy', e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                />
            </div>

            <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold text-white mb-3">About Us Text</h3>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-fuchsia-400 mb-1">Auto Parts Mode Bio</label>
                    <textarea 
                        value={profile.aboutAuto}
                        onChange={(e) => handleChange('aboutAuto', e.target.value)}
                        rows={3}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-fuchsia-500 focus:border-fuchsia-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-cyan-400 mb-1">General Items Mode Bio</label>
                    <textarea 
                        value={profile.aboutGeneral}
                        onChange={(e) => handleChange('aboutGeneral', e.target.value)}
                        rows={3}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>
            </div>
        </form>

        <footer className="p-5 border-t border-gray-700 bg-gray-800 rounded-b-xl flex justify-between items-center">
             <button 
                type="button" 
                onClick={handleReset}
                className="text-red-400 hover:text-red-300 text-sm font-medium"
            >
                Reset to Default
            </button>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-gray-300 hover:text-white font-medium"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg"
                >
                    Save Settings
                </button>
            </div>
        </footer>
      </div>
    </div>
  );
}`,
  'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  'README.md': `# RapidListingTool Deployment Guide

## Firebase Hosting

1. **Install Node.js** if you haven't already.
2. **Install Firebase CLI:**
   \`npm install -g firebase-tools\`
3. **Login to Firebase:**
   \`firebase login\`
4. **Initialize Project:**
   \`firebase init hosting\`
   - Select "Use an existing project" or "Create a new project".
   - **Public directory:** \`dist\`
   - **Configure as a single-page app?** \`Yes\`
   - **Set up automatic builds and deploys with GitHub?** \`No\` (optional)
   - **File Overwrites:** It is okay to overwrite index.html, but do NOT overwrite dist/index.html if manual.
5. **Install Dependencies:**
   \`npm install\`
6. **Build the Project:**
   \`npm run build\`
7. **Deploy:**
   \`firebase deploy\`

## Environment Variables
Create a \`.env\` file in the root directory and add your Google Gemini API Key:
\`API_KEY=your_actual_api_key_here\`
`
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
        <div className="relative bg-gray-900 rounded-lg mt-2 group">
            <button 
                onClick={handleCopy} 
                className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre className="p-4 overflow-auto text-sm text-gray-300 font-mono" style={{ maxHeight: '50vh' }}>
                <code>{content}</code>
            </pre>
        </div>
    );
};

export const FirebaseSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState(Object.keys(fileContents)[0]);
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
                <header className="flex justify-between items-center p-5 border-b border-gray-700 bg-gray-800 rounded-t-xl">
                    <div className="flex items-center gap-3">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.609 1.487l-6.38 12.023L0 12.023l2.844-5.358 1.944-3.663 3.663-1.944 3.158 1.429zM22.023 12.023l-3.329-6.364L12.391 1.487l6.38 12.023 3.252-1.487zM12 22.513l-4.755-9.155 4.755 4.391 4.755-4.391L12 22.513z"/>
                         </svg>
                         <div>
                             <h2 className="text-xl font-bold text-white">Deploy to Firebase</h2>
                             <p className="text-xs text-gray-400">Download configuration files for hosting</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                
                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    {/* Sidebar for Files */}
                    <div className="w-full md:w-64 bg-gray-900/50 border-r border-gray-700 overflow-y-auto">
                        <nav className="flex flex-col p-2 space-y-1">
                            {Object.keys(fileContents).map(filename => (
                                <button 
                                    key={filename} 
                                    onClick={() => setActiveTab(filename)} 
                                    className={`text-left py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === filename ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                                >
                                    <span className="opacity-70">📄</span>
                                    {filename}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-mono text-blue-300">{activeTab}</h3>
                        </div>
                        <FileContentDisplayer content={fileContents[activeTab as keyof typeof fileContents]} />
                    </div>
                </div>
            </div>
        </div>
    );
};