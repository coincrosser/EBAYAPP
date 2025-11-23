
import React, { useState, useEffect } from 'react';

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
    const newContent = `TITLE:\n${currentListing.title}\n\nDESCRIPTION HTML:\n${currentListing.description}\n\n-------------------\n\n${content}`;
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
      className={`fixed inset-y-0 right-0 w-full sm:w-[30rem] bg-gray-900 border-l border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[60] flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
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
            className={`text-xs font-semibold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1
                ${!currentListing 
                    ? 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed' 
                    : 'bg-gray-700 text-cyan-300 border-gray-600 hover:bg-gray-600 hover:text-cyan-200'}`}
            title="Append current scan results to note"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import Current
        </button>
        <button
            onClick={handleCopy}
            className={`text-xs font-semibold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1
                ${copyStatus === 'copied'
                    ? 'bg-green-900/30 border-green-500 text-green-400'
                    : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white'}`}
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
};
