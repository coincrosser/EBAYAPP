import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Spinner } from './components/Spinner';
import { extractIdentifierFromImage, generateListingContent, getProductData, performVisualSearch, ListingStyle, Platform, ScanType } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { CompatibilityCard } from './components/CompatibilityCard';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';
import { Logo } from './components/Logo';
import { HistorySidebar, SavedScan, SavedDraft } from './components/HistorySidebar';
import { NotepadSidebar } from './components/NotepadSidebar';
import { SettingsModal, UserProfile, DEFAULT_PROFILE } from './components/SettingsModal';

// Helper to convert base64 back to file for state restoration
const base64ToFile = async (base64: string, fileName: string): Promise<File> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type });
};

export default function App() {
  // State
  const [scanType, setScanType] = useState<ScanType>('auto-part');
  
  const [partImage, setPartImage] = useState<{ file: File; base64: string } | null>(null);
  const [serialImage, setSerialImage] = useState<{ file: File; base64: string } | null>(null);
  const [listing, setListing] = useState<{ title: string; description: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Lookup / Visual Search State
  const [lookupMethod, setLookupMethod] = useState<'text' | 'image'>('text');
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [visualLookupImage, setVisualLookupImage] = useState<{ file: File; base64: string } | null>(null);
  
  const [supplementalData, setSupplementalData] = useState<string | null>(null); // Fits both Auto Fitment and Product Specs
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);

  // History & Draft State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [savedScans, setSavedScans] = useState<SavedScan[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);

  // Notepad State
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  // Settings State
  const [listingStyle, setListingStyle] = useState<ListingStyle>('professional');
  const [platform, setPlatform] = useState<Platform>('ebay');

  // FB/Craigslist Options
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('Used - Good');

  // Auto Part Specifics (eBay Motors Requirements)
  const [donorVin, setDonorVin] = useState('');
  const [mileage, setMileage] = useState('');
  
  // ACES/PIES Data Input
  const [acesPiesData, setAcesPiesData] = useState('');
  const [showAdvancedData, setShowAdvancedData] = useState(false);

  // Load history, drafts, and profile from localStorage on mount
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
      const storedProfile = localStorage.getItem('rapid_listing_profile');
      if (storedProfile) {
        // Merge with default to ensure new fields (like headerTitle) exist
        setUserProfile({ ...DEFAULT_PROFILE, ...JSON.parse(storedProfile) });
      }
    } catch (e) {
      console.error("Failed to load local storage data", e);
    }
  }, []);

  const saveProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    localStorage.setItem('rapid_listing_profile', JSON.stringify(newProfile));
  };

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
    if (!partImage && !serialImage && !manualIdentifier) {
      setError("Cannot save an empty draft. Please upload images or enter a part number.");
      return;
    }

    try {
      const newDraft: SavedDraft = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        partNumber: manualIdentifier, // Storing identifier in partNumber field
        listingStyle: listingStyle
      };

      const updatedDrafts = [newDraft, ...savedDrafts].slice(0, 10);
      setSavedDrafts(updatedDrafts);
      localStorage.setItem('rapid_listing_drafts', JSON.stringify(updatedDrafts));
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
    setSupplementalData(scan.compatibilityHtml);
    setManualIdentifier(scan.partNumber);
    setPlatform(scan.platform || 'ebay');
    
    // Attempt to guess scan type from content or default to auto
    setScanType('auto-part'); 
    
    setPartImage(null);
    setSerialImage(null);
    setError(null);
    setLookupError(null);
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    }, 100);
  };

  const loadDraft = async (draft: SavedDraft) => {
    setIsLoading(true);
    try {
      setManualIdentifier(draft.partNumber || '');
      if (draft.listingStyle) {
        setListingStyle(draft.listingStyle);
      }
      setListing(null);
      setSupplementalData(null);
      setError(null);
      setPartImage(null);
      setSerialImage(null);
      setIsHistoryOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError("Draft loaded. Please re-upload your images.");
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

  const handleVisualImageUpload = useCallback(async (file: File) => {
    try {
        const base64 = await fileToBase64(file);
        setVisualLookupImage({ file, base64 });
        setLookupError(null);
    } catch (err) {
        setLookupError('Failed to process image. Please try another file.');
    }
  }, []);

  const handleGenerateListing = async () => {
    if (!partImage || !serialImage) {
      setError('Please upload both an Item photo and a Code/ID photo.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setListing(null);
    setSupplementalData(null);
    setLookupError(null);

    try {
      const step1Text = scanType === 'auto-part' ? 'Extracting OEM part number...' : 'Scanning barcode/UPC...';
      setCurrentStep(step1Text);
      const extractedId = await extractIdentifierFromImage(serialImage.base64, scanType);

      if (!extractedId || extractedId.trim() === '') {
        throw new Error("Could not extract an identifier. Please try a clearer picture.");
      }
      
      const step2Text = scanType === 'auto-part' 
        ? `Part #${extractedId} found. Checking ACES/Fitment data...` 
        : `ID ${extractedId} found. Looking up product specs...`;
      setCurrentStep(step2Text);
      
      const dataHtml = await getProductData(extractedId, scanType);
      
      setCurrentStep(acesPiesData ? `Parsing ACES/PIES data & generating ${platform} listing...` : `Generating ${platform} listing...`);
      
      const generatedListing = await generateListingContent(
          partImage.base64, 
          extractedId, 
          dataHtml, 
          listingStyle, 
          platform,
          scanType,
          { price, location, condition, donorVin, mileage, acesPiesData }
      );

      setListing(generatedListing);
      setSupplementalData(dataHtml);

      saveToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        partNumber: extractedId,
        title: generatedListing.title,
        description: generatedListing.description,
        compatibilityHtml: dataHtml,
        platform: platform
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Generation failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setCurrentStep('');
    }
  };

  const handleManualLookup = async () => {
    if (!manualIdentifier.trim()) {
      setLookupError('Please enter an ID or Part Number.');
      return;
    }
    setIsLookupLoading(true);
    setLookupError(null);
    setSupplementalData(null);
    setListing(null);
    setError(null);

    try {
      const data = await getProductData(manualIdentifier, scanType);
      setSupplementalData(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setLookupError(`Lookup failed: ${errorMessage}`);
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleVisualLookup = async () => {
    if (!visualLookupImage) {
        setLookupError('Please upload an image to search.');
        return;
    }
    setIsLookupLoading(true);
    setLookupError(null);
    setSupplementalData(null);
    setListing(null);
    setError(null);

    try {
        const data = await performVisualSearch(visualLookupImage.base64, scanType);
        setSupplementalData(data);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setLookupError(`Visual search failed: ${errorMessage}`);
    } finally {
        setIsLookupLoading(false);
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
                    <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
                        {userProfile.headerTitle && userProfile.headerTitle !== "RapidListingTool.com" ? (
                             <span className="text-white">{userProfile.headerTitle}</span>
                        ) : (
                            <>Rapid<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">Listing</span>Tool.com</>
                        )}
                    </span>
                    <span className="text-xl font-bold tracking-tight text-white sm:hidden">
                        {userProfile.headerTitle ? userProfile.headerTitle.substring(0, 10) + (userProfile.headerTitle.length > 10 ? '...' : '') : (
                            <>Rapid<span className="text-teal-400">List</span></>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-gray-300 hover:text-white transition-colors"
                        title="Business Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
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
                        <span className="hidden sm:inline">History</span>
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <div className="w-full max-w-5xl mx-auto flex flex-col flex-grow px-4 py-8 z-10">
        
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Universal <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-fuchsia-500">Reseller Tool</span>
          </h1>
          <p className="text-base text-gray-400 max-w-xl mx-auto">
            Generate professional listings for Auto Parts OR Everyday Items using AI.
            <br/>
            <span className="text-xs text-gray-500">Current Profile: {userProfile.businessName}</span>
          </p>
        </header>

        {/* Scan Type Toggle */}
        <div className="flex justify-center mb-8">
            <div className="bg-gray-800 p-1.5 rounded-xl inline-flex shadow-lg border border-gray-700">
                <button
                    onClick={() => setScanType('auto-part')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        scanType === 'auto-part'
                            ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    Auto Part Mode
                </button>
                <button
                    onClick={() => setScanType('general-item')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        scanType === 'general-item'
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1H5z" clipRule="evenodd" />
                        <path d="M7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
                    </svg>
                    General Item Mode
                </button>
            </div>
        </div>

        <main className="flex-grow w-full">
          <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50 mb-12 relative">
             {/* Indicator for current mode */}
             <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-xl border ${
                 scanType === 'auto-part' ? 'bg-fuchsia-900 text-fuchsia-200 border-fuchsia-700' : 'bg-cyan-900 text-cyan-200 border-cyan-700'
             }`}>
                 {scanType === 'auto-part' ? 'Auto Parts Scanner (eBay Motors)' : 'Barcode & Product Scanner'}
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 mt-4">
              <ImageUploader 
                id="part-image" 
                label={scanType === 'auto-part' ? "Step 1: Part Photo" : "Step 1: Item Photo"}
                onImageUpload={(file) => handleImageUpload(file, 'part')} 
                imagePreviewUrl={partImage ? URL.createObjectURL(partImage.file) : null}
                onClearImage={() => setPartImage(null)}
              />
              <ImageUploader 
                id="serial-image" 
                label={scanType === 'auto-part' ? "Step 2: Serial/Part # Photo" : "Step 2: Barcode / UPC Photo"}
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
                <Spinner className={`h-12 w-12 ${scanType === 'auto-part' ? 'text-fuchsia-500' : 'text-cyan-500'}`} />
                <p className="text-lg font-medium text-gray-300 animate-pulse">{currentStep}</p>
              </div>
            ) : (
              <div className="space-y-4">
                  {/* Platform Selector */}
                  <div className="flex justify-center mb-6">
                      <div className="bg-gray-800 p-1 rounded-lg inline-flex shadow-lg border border-gray-700">
                        {['ebay', 'facebook', 'craigslist'].map((p) => (
                            <button
                              key={p}
                              onClick={() => setPlatform(p as Platform)}
                              className={`px-6 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                                platform === p
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
                              }`}
                            >
                              {p} {p === 'ebay' && '(HTML)'}
                            </button>
                        ))}
                      </div>
                  </div>

                  {/* Settings Row */}
                  {platform === 'ebay' && (
                      <div className="flex items-center justify-end gap-4 mb-2 animate-fade-in">
                        <label htmlFor="listing-style" className="text-sm font-medium text-gray-400">Template:</label>
                        <select
                            id="listing-style"
                            value={listingStyle}
                            onChange={(e) => setListingStyle(e.target.value as ListingStyle)}
                            className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        >
                            <option value="professional">Professional</option>
                            <option value="minimalist">Minimalist</option>
                            <option value="table-layout">Table Layout</option>
                            <option value="bold-classic">Bold Classic</option>
                            <option value="modern-card">Modern Card</option>
                            <option value="luxury">Luxury / High-End</option>
                            <option value="vintage">Vintage / Retro</option>
                            <option value="handmade">Handmade / Artisan</option>
                            <option value="collectible">Collectible / Investment</option>
                        </select>
                      </div>
                  )}

                  {/* Auto Parts Specific Inputs (VIN/Mileage) - Critical for eBay Motors */}
                  {scanType === 'auto-part' && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2 animate-fade-in bg-fuchsia-900/10 p-4 rounded-xl border border-fuchsia-800/30">
                         <div>
                             <label className="block text-sm font-medium text-gray-300 mb-1">Donor VIN (Optional)</label>
                             <input 
                                 type="text" 
                                 value={donorVin} 
                                 onChange={(e) => setDonorVin(e.target.value)} 
                                 placeholder="17-Digit VIN" 
                                 maxLength={17}
                                 className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:outline-none placeholder-gray-600"
                             />
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-300 mb-1">Mileage (Optional)</label>
                             <input 
                                 type="text" 
                                 value={mileage} 
                                 onChange={(e) => setMileage(e.target.value)} 
                                 placeholder="e.g. 120,000" 
                                 className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:outline-none placeholder-gray-600"
                             />
                         </div>
                     </div>
                  )}
                  
                  {/* Advanced ACES/PIES Data Input */}
                  {scanType === 'auto-part' && (
                     <div className="mb-4">
                        <button 
                            type="button" 
                            onClick={() => setShowAdvancedData(!showAdvancedData)}
                            className="text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 mb-2 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${showAdvancedData ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            Advanced: ACES/PIES Data Import (XML/CSV)
                        </button>
                        
                        {showAdvancedData && (
                            <div className="bg-gray-900/80 border border-gray-700 p-3 rounded-lg animate-fade-in">
                                <label className="block text-xs text-gray-400 mb-2">
                                    Paste raw ACES (Vehicle Fitment) or PIES (Product Attribute) XML/JSON data here. 
                                    The AI will parse this standard data to generate precise compatibility tables and item specifics.
                                </label>
                                <textarea
                                    value={acesPiesData}
                                    onChange={(e) => setAcesPiesData(e.target.value)}
                                    placeholder="<App action='A' id='1'><BaseVehicle id='1234'/><EngineBase id='56'/></App>..."
                                    className="w-full h-32 bg-gray-950 border border-gray-700 rounded p-2 text-xs font-mono text-green-400 focus:ring-1 focus:ring-fuchsia-500 focus:outline-none"
                                />
                                {acesPiesData && (
                                    <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Data loaded. AI will prioritize this over visual analysis.
                                    </div>
                                )}
                            </div>
                        )}
                     </div>
                  )}

                  {/* Additional Fields */}
                  {platform !== 'ebay' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Price</label>
                            <input 
                                type="text" 
                                value={price} 
                                onChange={(e) => setPrice(e.target.value)} 
                                placeholder="$0.00" 
                                className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                            <input 
                                type="text" 
                                value={location} 
                                onChange={(e) => setLocation(e.target.value)} 
                                placeholder="City, Zip" 
                                className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                <option>As Is</option>
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
                        className={`flex-[2] py-3 px-6 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-95 shadow-lg
                        ${isGenerateButtonDisabled 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : scanType === 'auto-part' 
                                ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-fuchsia-900/20'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20'
                        }`}
                    >
                        {scanType === 'auto-part' ? 'GENERATE AUTO LISTING' : 'GENERATE PRODUCT LISTING'}
                    </button>
                  </div>
              </div>
            )}
          </div>

          {listing && (
             <div className="mb-12 animate-fade-in-up">
               <ResultCard 
                 title={listing.title} 
                 description={listing.description} 
                 platform={platform} 
                 scanType={scanType}
                 userProfile={userProfile}
               />
             </div>
          )}

          <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                 <div>
                    <h2 className={`text-2xl font-bold text-white mb-1 flex items-center gap-2`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${scanType === 'auto-part' ? 'text-green-400' : 'text-yellow-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {scanType === 'auto-part' ? 'Manual Fitment Check' : 'Manual Product Lookup'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {scanType === 'auto-part' 
                            ? "Check fitment without generating a full listing."
                            : "Check product specs without generating a full listing."}
                    </p>
                 </div>
                 
                 <div className="flex bg-gray-800 p-1 rounded-lg">
                     <button
                        onClick={() => setLookupMethod('text')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            lookupMethod === 'text' 
                                ? 'bg-gray-700 text-white shadow' 
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                     >
                        Text Lookup
                     </button>
                     <button
                        onClick={() => setLookupMethod('image')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                            lookupMethod === 'image' 
                                ? 'bg-blue-600 text-white shadow' 
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                     >
                        Visual Search
                     </button>
                 </div>
             </div>

             {lookupMethod === 'text' ? (
                <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
                    <input 
                      type="text" 
                      value={manualIdentifier}
                      onChange={(e) => setManualIdentifier(e.target.value)}
                      placeholder={scanType === 'auto-part' ? "e.g. 89661-02K30" : "e.g. 885909950805 or KD-55X85J"}
                      className="flex-grow bg-gray-900 border border-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                    />
                    <button 
                      onClick={handleManualLookup}
                      disabled={isLookupLoading}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors whitespace-nowrap border border-gray-600"
                    >
                      {isLookupLoading ? 'Searching...' : 'Lookup'}
                    </button>
                 </div>
             ) : (
                <div className="animate-fade-in space-y-4">
                     <div className="w-full max-w-md mx-auto">
                        <ImageUploader 
                            id="visual-search-upload" 
                            label="Upload Photo for Visual Search" 
                            onImageUpload={handleVisualImageUpload} 
                            imagePreviewUrl={visualLookupImage ? URL.createObjectURL(visualLookupImage.file) : null}
                            onClearImage={() => setVisualLookupImage(null)}
                        />
                     </div>
                     <div className="flex justify-center">
                        <button 
                            onClick={handleVisualLookup}
                            disabled={isLookupLoading || !visualLookupImage}
                            className={`font-semibold py-3 px-8 rounded-lg transition-colors whitespace-nowrap border ${
                                isLookupLoading || !visualLookupImage
                                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                            }`}
                        >
                            {isLookupLoading ? 'Analyzing Image...' : 'Identify & Search'}
                        </button>
                     </div>
                </div>
             )}

             {lookupError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800 text-red-300 rounded-md text-sm text-center">
                    {lookupError}
                </div>
             )}
             
             {supplementalData && (
                <div className="mt-6 animate-fade-in">
                    <CompatibilityCard 
                        partNumber={manualIdentifier || (visualLookupImage ? "Visual Identification" : "Unknown Item")} 
                        compatibilityHtml={supplementalData} 
                        titleOverride={lookupMethod === 'image' ? 'Visual Search Report' : (scanType === 'general-item' ? 'Product Specifications' : undefined)}
                    />
                </div>
             )}
          </div>

        </main>

        <footer className="w-full text-center py-8 mt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} {userProfile.businessName}. Powered by RapidListingTool.com.
            </p>
            <button 
                onClick={() => setIsFirebaseModalOpen(true)} 
                className="mt-2 text-xs text-gray-700 hover:text-gray-500 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Deploy to Firebase
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
        userProfile={userProfile}
      />
      
      <NotepadSidebar 
        isOpen={isNotepadOpen} 
        onClose={() => setIsNotepadOpen(false)} 
        currentListing={listing} 
      />

      {isFirebaseModalOpen && <FirebaseSetupModal onClose={() => setIsFirebaseModalOpen(false)} />}
      
      {isSettingsOpen && (
        <SettingsModal 
            onClose={() => setIsSettingsOpen(false)} 
            currentProfile={userProfile} 
            onSave={saveProfile} 
        />
      )}
    </div>
  );
}