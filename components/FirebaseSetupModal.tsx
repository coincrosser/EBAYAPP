import React, { useState } from 'react';

// This component provides the necessary files to deploy to Firebase
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
  '.env.local': `API_KEY=your_actual_api_key_here`,
  'README.md': `# RapidListingTool Deployment Guide

## Firebase Hosting (CLI Method)

1. **Install Node.js** if you haven't already.
2. **Install Firebase CLI:**
   \`npm install -g firebase-tools\`
3. **Login to Firebase:**
   \`firebase login\`
4. **Initialize Project:**
   \`firebase init hosting\`
   - Select "Use an existing project" -> **rapidlistingtool**
   - **Public directory:** \`dist\`
   - **Configure as a single-page app?** \`Yes\`
   - **Set up automatic builds and deploys with GitHub?** \`No\` (or Yes for CI/CD)
5. **Install Dependencies:**
   \`npm install\`
6. **Build the Project:**
   \`npm run build\`
7. **Deploy:**
   \`firebase deploy\`

## Deployment Without Command Line

If you cannot use the command line, the recommended path is:

1. **Create a GitHub Repository** and upload these files.
2. **Connect to a Host:** Use a service like **StackBlitz**, **CodeSandbox**, or **Netlify**.
   - These services can import from GitHub and handle the build process automatically.
   - For Firebase specifically, you can configure **GitHub Actions** via the Firebase Console to auto-deploy whenever you push changes to GitHub.
`,
  'components/SettingsModal.tsx': `import React, { useState, useEffect } from 'react';

export interface UserProfile {
  businessName: string;
  headerTitle: string; // New field for App Header
  location: string;
  shippingPolicy: string;
  returnPolicy: string;
  aboutAuto: string;
  aboutGeneral: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  businessName: "ChrisJayden",
  headerTitle: "RapidListingTool.com",
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
  // Ensure headerTitle exists if migrating from an older profile version
  const [profile, setProfile] = useState<UserProfile>({
    ...DEFAULT_PROFILE,
    ...currentProfile
  });

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
                Customize your branding here. This info is used in your listings and the app header.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Business Name (for Listings)</label>
                    <input 
                        type="text" 
                        value={profile.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. ChrisJayden"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">App Header / Company Name</label>
                    <input 
                        type="text" 
                        value={profile.headerTitle}
                        onChange={(e) => handleChange('headerTitle', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. My Company Tool"
                    />
                    <p className="text-xs text-gray-500 mt-1">Replaces "RapidListingTool.com" in top bar</p>
                </div>
                <div className="md:col-span-2">
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
};`,
  'components/ImageUploader.tsx': `import React, { useState, useEffect } from 'react';

interface ImageUploaderProps {
  id: string;
  label: string;
  onImageUpload: (file: File) => void;
  imagePreviewUrl: string | null;
  onClearImage: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  id,
  label,
  onImageUpload,
  imagePreviewUrl,
  onClearImage,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Reset loading state when the image URL changes
    if (imagePreviewUrl) {
      setIsLoaded(false);
    }
  }, [imagePreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageUpload(event.target.files[0]);
    }
    // Reset file input to allow re-uploading the same file after clearing.
    event.target.value = '';
  };

  const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <p id={\`\${id}-label\`} className="text-lg font-semibold text-gray-300 mb-2">{label}</p>
      <label 
        htmlFor={id}
        aria-labelledby={\`\${id}-label\`}
        className="relative w-full h-48 md:h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-blue-400 transition-colors duration-300 bg-gray-800 overflow-hidden group"
      >
        {imagePreviewUrl ? (
          <>
            {/* Loading Skeleton/Placeholder */}
            {!isLoaded && (
               <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                  <div className="w-full h-full animate-pulse bg-gray-700/50 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
               </div>
            )}

            <img 
              src={imagePreviewUrl} 
              alt="Preview" 
              onLoad={() => setIsLoaded(true)}
              className={\`w-full h-full object-contain rounded-lg p-1 transition-all duration-700 ease-out transform \${
                  isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-95'
              }\`} 
            />
            
            <button
              onClick={(e) => {
                e.preventDefault();
                onClearImage();
              }}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-transform transform hover:scale-110 z-20 shadow-lg"
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <div className="text-center transform transition-transform duration-300 group-hover:scale-105">
            <ImageIcon />
            <p className="mt-2 text-sm text-gray-400">
              <span className="font-semibold text-blue-400">Tap to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
          </div>
        )}
        <input 
          id={id} 
          name={id} 
          type="file" 
          className="sr-only" 
          accept="image/*" 
          onChange={handleFileChange} 
        />
      </label>
    </div>
  );
};`,
 'components/HistorySidebar.tsx': `import React, { useState } from 'react';
import { downloadEbayCSV } from '../utils/csvExport';
import { Platform } from '../services/geminiService';
import { UserProfile } from './SettingsModal';

export interface SavedScan {
  id: string;
  timestamp: number;
  partNumber: string;
  title: string;
  description: string;
  compatibilityHtml: string;
  platform?: Platform; // New field to track platform type
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
  userProfile: UserProfile;
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

  const getPlatformBadge = (p?: Platform) => {
    if (p === 'facebook') return <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 text-[10px] border border-blue-800">FB</span>;
    if (p === 'craigslist') return <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 text-[10px] border border-purple-800">CL</span>;
    return <span className="ml-2 px-1.5 py-0.5 rounded bg-green-900/50 text-green-300 text-[10px] border border-green-800">eBay</span>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-fuchsia-500/50 transition-colors group relative">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
             <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-700 text-fuchsia-300 rounded">
            {scan.partNumber}
            </span>
            {getPlatformBadge(scan.platform)}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(scan.timestamp).toLocaleDateString()}
        </span>
      </div>
      <h3 className="text-sm font-medium text-white line-clamp-2 mb-3">
        {scan.title}
      </h3>
      
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={onLoad}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded flex items-center justify-center transition-colors"
        >
          View Scan
        </button>
        <button
          onClick={handleCopyFitment}
          className={\`text-xs py-2 px-3 rounded flex items-center justify-center transition-colors border \${
            copyStatus === 'copied' 
              ? 'bg-green-900/30 border-green-500 text-green-400' 
              : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-300'
          }\`}
        >
          {copyStatus === 'copied' ? 'Copied!' : 'Copy Fitment'}
        </button>
      </div>
      <button
        onClick={(e) => {
            e.stopPropagation();
            onDelete();
        }}
        className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        title="Delete Scan"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

const DraftItem: React.FC<DraftItemProps> = ({ draft, onLoad, onDelete }) => {
    // Use the part image or serial image as a thumbnail
    const thumb = draft.partImageBase64 || draft.serialImageBase64;
    
    return (
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-cyan-500/50 transition-colors group relative flex gap-3 items-center">
        <div className="h-16 w-16 bg-gray-900 rounded overflow-hidden flex-shrink-0 border border-gray-600">
            {thumb ? (
                <img src={thumb} alt="Draft" className="h-full w-full object-cover" />
            ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}
        </div>
        <div className="flex-grow min-w-0">
            <p className="text-xs text-cyan-400 font-semibold mb-1">
                {draft.partNumber ? \`Draft: \${draft.partNumber}\` : 'Untitled Draft'}
            </p>
            <p className="text-[10px] text-gray-500 mb-2">{new Date(draft.timestamp).toLocaleDateString()} {new Date(draft.timestamp).toLocaleTimeString()}</p>
            <button 
                onClick={onLoad}
                className="text-xs bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 px-3 py-1 rounded transition-colors"
            >
                Resume
            </button>
        </div>
        <button
          onClick={(e) => {
              e.stopPropagation();
              onDelete();
          }}
          className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          title="Delete Draft"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
};

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  scans,
  drafts,
  onLoadScan,
  onDeleteScan,
  onLoadDraft,
  onDeleteDraft,
  userProfile
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'drafts'>('history');
  
  const handleExport = () => {
    downloadEbayCSV(scans, userProfile);
  };

  return (
    <div
      className={\`fixed inset-y-0 right-0 w-full sm:w-96 bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col \${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }\`}
    >
      <div className="p-4 bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-fuchsia-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity
            </h2>
            <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white transition-colors"
                title="Close History"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-1">
            <button 
                onClick={() => setActiveTab('history')}
                className={\`flex-1 text-sm font-medium py-1.5 rounded-md transition-all \${activeTab === 'history' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}\`}
            >
                History
            </button>
            <button 
                onClick={() => setActiveTab('drafts')}
                className={\`flex-1 text-sm font-medium py-1.5 rounded-md transition-all \${activeTab === 'drafts' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}\`}
            >
                Drafts
            </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {activeTab === 'history' ? (
            scans.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                <p className="mb-2">No history yet.</p>
                <p className="text-sm">Generate a listing to save it here automatically.</p>
              </div>
            ) : (
              scans.map((scan) => (
                <HistoryItem 
                    key={scan.id} 
                    scan={scan} 
                    onLoad={() => { onLoadScan(scan); onClose(); }} 
                    onDelete={() => onDeleteScan(scan.id)} 
                />
              ))
            )
        ) : (
            drafts.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                    <p className="mb-2">No saved drafts.</p>
                    <p className="text-sm">Click "Save Draft" while working to save for later.</p>
                </div>
            ) : (
                drafts.map((draft) => (
                    <DraftItem 
                        key={draft.id}
                        draft={draft}
                        onLoad={() => { onLoadDraft(draft); }}
                        onDelete={() => onDeleteDraft(draft.id)}
                    />
                ))
            )
        )}
      </div>

      {activeTab === 'history' && scans.length > 0 && (
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
            <button 
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
                title="Download CSV for eBay Seller Hub"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export to eBay CSV
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
                Use via eBay Seller Hub &gt; Reports &gt; Upload
            </p>
        </div>
      )}
    </div>
  );
};`
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
                <div className="p-6 overflow-y-auto flex-grow">
                     {/* Instructions */}
                    <div className="mb-4 bg-yellow-900/30 border border-yellow-700 text-yellow-200 p-3 rounded-lg text-sm flex gap-3">
                         <div className="mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                         </div>
                        <div>
                            <p className="font-bold mb-1">Deployment Instructions:</p>
                            <ol className="list-decimal list-inside space-y-1 text-gray-300">
                                <li><strong>Download</strong> the files below.</li>
                                <li><strong>Upload</strong> to a GitHub repository.</li>
                                <li><strong>Connect</strong> to Firebase Hosting (or Netlify/Vercel) via their UI.</li>
                            </ol>
                        </div>
                    </div>
                    
                    {/* Tabs */}
                    <div className="border-b border-gray-600 sticky top-0 bg-gray-800 z-10 pt-2">
                        <nav className="flex flex-wrap -mb-px gap-2 pb-2">
                            {Object.keys(fileContents).map(filename => (
                                <button 
                                    key={filename} 
                                    onClick={() => setActiveTab(filename)} 
                                    className={`whitespace-nowrap py-2 px-3 rounded-lg font-medium text-xs transition-colors border ${
                                        activeTab === filename 
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg' 
                                            : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600 hover:text-gray-200'
                                    }`}
                                >
                                    {filename}
                                </button>
                            ))}
                        </nav>
                    </div>
                    
                    {/* Content */}
                    <FileContentDisplayer content={fileContents[activeTab as keyof typeof fileContents]} />
                </div>
            </div>
        </div>
    );
};