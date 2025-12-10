import React, { useState } from 'react';
import { downloadEbayCSV } from '../utils/csvExport';
import { Platform, ListingStyle } from '../services/geminiService';
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
  listingStyle?: ListingStyle;
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
          className={`text-xs py-2 px-3 rounded flex items-center justify-center transition-colors border ${
            copyStatus === 'copied' 
              ? 'bg-green-900/30 border-green-500 text-green-400' 
              : 'bg-gray-700 border-transparent hover:bg-gray-600 text-gray-300'
          }`}
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
                {draft.partNumber ? `Draft: ${draft.partNumber}` : 'Untitled Draft'}
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
      className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
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
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${activeTab === 'history' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            >
                History
            </button>
            <button 
                onClick={() => setActiveTab('drafts')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${activeTab === 'drafts' ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
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
};