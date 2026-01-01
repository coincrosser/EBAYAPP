import React, { useState } from 'react';

// This component provides the necessary files to deploy to Firebase
const fileContents = {
  'package.json': `{
  "name": "rapid-listing-tool",
  "private": true,
  "version": "2.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^1.33.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.0",
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
  'deploy.yml': `name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: \${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: \${{ secrets.FIREBASE_SERVICE_ACCOUNT_RAPIDLISTINGTOOL }}
          channelId: live
          projectId: rapidlistingtool
`,
  'vite.config.ts': `import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
    filename: string;
    content: string;
}

const FileContentDisplayer: React.FC<FileContentDisplayerProps> = ({ filename, content }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="relative bg-gray-950 rounded-lg mt-2 group border border-gray-800">
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={handleCopy} 
                    className="px-3 py-1 text-[10px] font-bold uppercase text-white bg-blue-600 rounded-md hover:bg-blue-500 shadow-lg"
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
                <button 
                    onClick={handleDownload} 
                    className="px-3 py-1 text-[10px] font-bold uppercase text-white bg-green-600 rounded-md hover:bg-green-500 shadow-lg"
                >
                    Download
                </button>
            </div>
            <pre className="p-4 overflow-auto text-xs text-gray-400 font-mono" style={{ maxHeight: '40vh' }}>
                <code>{content}</code>
            </pre>
        </div>
    );
};

export const FirebaseSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState(Object.keys(fileContents)[0]);
    
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-gray-700">
                <header className="flex justify-between items-center p-6 border-b border-gray-800">
                    <div className="flex items-center gap-4">
                         <div className="bg-yellow-500/10 p-2 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.609 1.487l-6.38 12.023L0 12.023l2.844-5.358 1.944-3.663 3.663-1.944 3.158 1.429zM22.023 12.023l-3.329-6.364L12.391 1.487l6.38 12.023 3.252-1.487zM12 22.513l-4.755-9.155 4.755 4.391 4.755-4.391L12 22.513z"/>
                            </svg>
                         </div>
                         <div>
                             <h2 className="text-2xl font-black text-white tracking-tight">DEPLOYMENT HUB</h2>
                             <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Update Git & Firebase Hosting</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="p-6 overflow-y-auto flex-grow space-y-8">
                    {/* Instructions Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <span className="bg-blue-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">1</span>
                                UPDATE GIT REPOSITORY
                            </h3>
                            <div className="bg-black p-3 rounded-lg font-mono text-[11px] text-blue-400 space-y-1">
                                <div>git add .</div>
                                <div>git commit -m "update listing styles"</div>
                                <div>git push origin main</div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                <span className="bg-green-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">2</span>
                                UPDATE FIREBASE HOSTING
                            </h3>
                            <div className="bg-black p-3 rounded-lg font-mono text-[11px] text-green-400 space-y-1">
                                <div>npm run build</div>
                                <div>firebase deploy --only hosting</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-white">Project Config Files</h3>
                            <p className="text-xs text-gray-500">Download these files and place them in your project root folder.</p>
                        </div>
                        
                        {/* Tabs Container */}
                        <div className="flex flex-wrap gap-2">
                            {Object.keys(fileContents).map(filename => (
                                <button 
                                    key={filename} 
                                    onClick={() => setActiveTab(filename)} 
                                    className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                                        activeTab === filename 
                                            ? 'bg-white text-black border-white shadow-xl' 
                                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                                    }`}
                                >
                                    {filename}
                                </button>
                            ))}
                        </div>
                        
                        {/* File Content */}
                        <FileContentDisplayer 
                            filename={activeTab} 
                            content={fileContents[activeTab as keyof typeof fileContents]} 
                        />
                    </div>
                </div>
                
                <footer className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all text-sm"
                    >
                        DONE
                    </button>
                </footer>
            </div>
        </div>
    );
};