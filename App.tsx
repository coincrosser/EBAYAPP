import React, { useState, useCallback, useEffect } from 'react';
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
      
      setCurrentStep(`Part number "${partNumber}" found. Researching vehicle compatibility...`);
      const compatibilityHtml = await getCompatibilityData(partNumber);
      
      setCurrentStep(`Generating eBay listing description (${listingStyle})...`);
      const generatedListing = await generateListingContent(partImage.base64, partNumber, compatibilityHtml, listingStyle);

      setListing(generatedListing);
      setCompatibilityData(compatibilityHtml);

      // Auto-save to history
      saveToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        partNumber: partNumber,
        title: generatedListing.title,
        description: generatedListing.description,
        compatibilityHtml: compatibilityHtml
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Generation failed: ${errorMessage}`);
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
      setCompatibilityError(`Lookup failed: ${errorMessage}`);
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
            Upload photos, extract ACES/PIES data, and generate professional eBay HTML listings in seconds.
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
                  {/* Settings Row */}
                  <div className="flex items-center justify-end gap-4 mb-2">
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
                        className={`flex-[2] py-3 px-6 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-900/20
                        ${isGenerateButtonDisabled 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                        }`}
                    >
                        GENERATE LISTING
                    </button>
                  </div>
              </div>
            )}
          </div>

          {listing && (
             <div className="mb-12 animate-fade-in-up">
               <ResultCard title={listing.title} description={listing.description} />
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
}