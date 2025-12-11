import React, { useState } from 'react';

// This component provides the necessary files to deploy to Firebase
const fileContents = {
  'package.json': `{
  "name": "rapid-listing-tool",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^1.28.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.2.0"
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
  '.firebaserc': `{
  "projects": {
    "default": "rapidlistingtool"
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
  '.env.example': `API_KEY=your_gemini_api_key_here`,
  'README.md': `# RapidListingTool Deployment Guide

## Deployment Instructions

### Option 1: Firebase Hosting

1. **Prerequisites:**
   - Install Node.js
   - Install Firebase CLI: \`npm install -g firebase-tools\`

2. **Project Setup:**
   - Create a new directory locally.
   - Copy all project files into it.
   - Create the config files (\`package.json\`, \`firebase.json\`, \`vite.config.ts\`) using the content in this modal.
   - Create a \`.env\` file with your API key: \`API_KEY=AIza...\`

3. **Install Dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

4. **Build the App:**
   \`\`\`bash
   npm run build
   \`\`\`
   *This creates a \`dist\` folder containing your production app.*

5. **Deploy:**
   \`\`\`bash
   firebase login
   firebase init hosting
   # Select "Use an existing project" -> rapidlistingtool (or create new)
   # What do you want to use as your public directory? -> dist
   # Configure as a single-page app (rewrite all urls to /index.html)? -> Yes
   # Set up automatic builds and deploys with GitHub? -> No (or Yes if you prefer)
   # File dist/index.html already exists. Overwrite? -> No
   
   firebase deploy
   \`\`\`

### Option 2: GitHub / Vercel / Netlify

1. Push your code to a GitHub repository.
2. Import the project in Vercel or Netlify.
3. Settings:
   - **Build Command:** \`npm run build\`
   - **Output Directory:** \`dist\`
   - **Environment Variables:** Add \`API_KEY\` with your Gemini API key value.
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "unusedLocals": false,
    "unusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`
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
                             <h2 className="text-xl font-bold text-white">Deploy to Firebase / GitHub</h2>
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
                                <li><strong>Upload</strong> these config files AND your source code to your project root.</li>
                                <li><strong>Build</strong> the project using <code>npm run build</code>.</li>
                                <li><strong>Deploy</strong> the <code>dist</code> folder using <code>firebase deploy</code>.</li>
                                <li><strong>Note:</strong> Ensure you have a <code>.env</code> file with <code>API_KEY</code>.</li>
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