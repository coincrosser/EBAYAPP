import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Spinner } from './components/Spinner';
import { extractIdentifierFromImage, generateListingContent, getProductData, performVisualSearch, decodeVin, optimizeImageBackground, ListingStyle, Platform, ScanType, BackgroundStyle } from './services/geminiService';
import { fileToBase64, resizeImage } from './utils/fileUtils';
import { CompatibilityCard } from './components/CompatibilityCard';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';
import { Logo } from './components/Logo';
import { HistorySidebar, SavedScan, SavedDraft } from './components/HistorySidebar';
import { NotepadSidebar } from './components/NotepadSidebar';
import { SettingsModal, UserProfile, DEFAULT_PROFILE } from './components/SettingsModal';
import { StylePreviewModal } from './components/StylePreviewModal';

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

  // Photo Studio State
  const [bgStyle, setBgStyle] = useState<BackgroundStyle>('studio-white');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [embedPhoto, setEmbedPhoto] = useState(false); // Toggle for embedding photo in description

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
  const [isStylePreviewOpen, setIsStylePreviewOpen] = useState(false);
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
  const [donorVehicleDetails, setDonorVehicleDetails] = useState('');
  const [isVinLoading, setIsVinLoading] = useState(false);
  
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

  // Robust LocalStorage Saver
  const saveToHistory = (newScan: SavedScan) => {
    const trySave = (items: SavedScan[]) => {
      try {
        localStorage.setItem('rapid_listing_history', JSON.stringify(items));
        setSavedScans(items);
        return true;
      } catch (e: any) {
        // Check for QuotaExceededError
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
          return false;
        }
        throw e;
      }
    };

    // Strategy 1: Save normally with limit of 50
    let updatedScans = [newScan, ...savedScans].slice(0, 50);
    if (trySave(updatedScans)) return;

    console.warn("Storage quota exceeded. Attempting to trim history.");

    // Strategy 2: Reduce limit to 10
    updatedScans = [newScan, ...savedScans].slice(0, 10);
    if (trySave(updatedScans)) return;

    // Strategy 3: Strip embedded images from the NEW scan's description to save space
    console.warn("Storage still full. Stripping embedded image from history item.");
    // Regex to find src="data:image..." and replace it to save massive space
    const cleanDescription = newScan.description.replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="" alt="Image not saved in history"');
    const cleanScan = { ...newScan, description: cleanDescription };
    
    updatedScans = [cleanScan, ...savedScans].slice(0, 10);
    if (trySave(updatedScans)) return;

    // Strategy 4: Fallback - clear old history completely and just save new (clean) one
    updatedScans = [cleanScan];
    if (trySave(updatedScans)) return;

    setError("Browser storage is full. History item could not be saved.");
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

    const newDraft: SavedDraft = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      partNumber: manualIdentifier, 
      listingStyle: listingStyle,
      partImageBase64: partImage?.base64,
      serialImageBase64: serialImage?.base64
    };

    const trySaveDrafts = (items: SavedDraft[]) => {
        try {
            localStorage.setItem('rapid_listing_drafts', JSON.stringify(items));
            setSavedDrafts(items);
            setIsHistoryOpen(true);
            return true;
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                return false;
            }
            throw e;
        }
    };

    // 1. Try saving with limit of 10
    let updatedDrafts = [newDraft, ...savedDrafts].slice(0, 10);
    if (trySaveDrafts(updatedDrafts)) return;

    // 2. Try saving with limit of 3
    updatedDrafts = [newDraft, ...savedDrafts].slice(0, 3);
    if (trySaveDrafts(updatedDrafts)) return;

    // 3. Failed
    setError("Storage limit reached. Cannot save draft. Please delete old drafts or history items.");
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
      
      // Restore images if available in draft
      if (draft.partImageBase64) {
          const file = await base64ToFile(draft.partImageBase64, 'part-image.jpg');
          setPartImage({ file, base64: draft.partImageBase64 });
      }
      if (draft.serialImageBase64) {
          const file = await base64ToFile(draft.serialImageBase64, 'serial-image.jpg');
          setSerialImage({ file, base64: draft.serialImageBase64 });
      }

      setListing(null);
      setSupplementalData(null);
      setError(null);
      setIsHistoryOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError("Draft loaded.");
    } catch (e) {
      console.error(e);
      setError("Failed to restore draft images.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImageUpload = useCallback(async (file: File, type: 'part' | 'serial') => {
    setError(null); // Clear previous errors
    
    // Validation
    const MAX_SIZE_MB = 15; // Increased slightly as we resize client side
    if (!file.type.startsWith('image/')) {
        setError("Invalid file type. Please upload a PNG, JPG, or WEBP image.");
        return;
    }
    
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload an image smaller than ${MAX_SIZE_MB}MB.`);
        return;
    }

    try {
      // Use resizeImage instead of fileToBase64 to ensure API limits aren't hit
      // Resizing to max 1500px dimension and 0.85 quality JPEG
      const base64 = await resizeImage(file, 1500, 0.85);
      
      if (type === 'part') {
        setPartImage({ file, base64 });
        setProcessedImage(null); // Reset processed image when new original is uploaded
      } else {
        setSerialImage({ file, base64 });
      }
    } catch (err) {
      console.error("Image processing error:", err);
      setError('Failed to process image. The file might be corrupted or unreadable.');
    }
  }, []);

  const handleVisualImageUpload = useCallback(async (file: File) => {
    setLookupError(null);

    // Validation
    const MAX_SIZE_MB = 15;
    if (!file.type.startsWith('image/')) {
        setLookupError("Invalid file type. Please upload a PNG, JPG, or WEBP image.");
        return;
    }
    
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setLookupError(`File is too large. Please upload an image smaller than ${MAX_SIZE_MB}MB.`);
        return;
    }

    try {
        const base64 = await resizeImage(file, 1500, 0.85);
        setVisualLookupImage({ file, base64 });
        setLookupError(null);
    } catch (err) {
        console.error("Visual search image error:", err);
        setLookupError('Failed to process image. Please try another file.');
    }
  }, []);

  const handleProcessImage = async () => {
    if (!partImage) return;
    setIsProcessingImage(true);
    setError(null);
    try {
        const result = await optimizeImageBackground(partImage.base64, bgStyle);
        setProcessedImage(result);
    } catch (err: unknown) {
        console.error(err);
        setError("Failed to process background image. Please try a different style or image.");
    } finally {
        setIsProcessingImage(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!processedImage) return;
    
    try {
        // Use fetch to convert data URL to Blob (handles base64 decoding efficiently)
        const res = await fetch(processedImage);
        const blob = await res.blob();
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const ext = blob.type.split('/')[1] || 'png';
        link.download = `rapid-listing-studio-${bgStyle}-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (e) {
        console.error("Blob download failed", e);
        setError("Download failed. Opening image in new tab...");
        // Fallback: Open in new tab
        const win = window.open();
        if (win) {
            win.document.write(`<img src="${processedImage}" style="max-width:100%"/>`);
        }
    }
  };

  const handleVinDecode = async () => {
    if (donorVin.length < 17) return;
    setIsVinLoading(true);
    setDonorVehicleDetails('');
    try {
        const result = await decodeVin(donorVin);
        setDonorVehicleDetails(result);
    } catch (err) {
        console.error("VIN Decode Error", err);
        setDonorVehicleDetails("Could not decode VIN.");
    } finally {
        setIsVinLoading(false);
    }
  };

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
      let step1Text = '';
      if (scanType === 'auto-part') step1Text = 'Extracting OEM part number...';
      else if (scanType === 'electronics') step1Text = 'Extracting Model & Serial Number...';
      else step1Text = 'Scanning barcode/UPC...';
      
      setCurrentStep(step1Text);
      // partImage and serialImage base64 are already resized during upload
      const extractedId = await extractIdentifierFromImage(serialImage.base64, scanType);

      if (!extractedId || extractedId.trim() === '') {
        throw new Error("Could not extract an identifier. Please try a clearer picture.");
      }
      
      let step2Text = '';
      if (scanType === 'auto-part') step2Text = `Part #${extractedId} found. Checking Fitment...`;
      else if (scanType === 'electronics') step2Text = `Model ${extractedId} found. Fetching Tech Specs...`;
      else step2Text = `ID ${extractedId} found. Looking up details...`;
      
      setCurrentStep(step2Text);
      
      const dataHtml = await getProductData(extractedId, scanType);
      
      // Use processed image if available and selected, otherwise try to generate on fly if requested
      let finalImageToEmbed = undefined;
      
      // Allow embedding for all platforms if option is checked
      if (embedPhoto) {
          if (processedImage) {
              finalImageToEmbed = processedImage;
          } else {
               // Auto-process if they checked the box but didn't click "Process" manually
              setCurrentStep(`Optimizing product image (${bgStyle.replace('-', ' ')})...`);
              try {
                  finalImageToEmbed = await optimizeImageBackground(partImage.base64, bgStyle);
                  setProcessedImage(finalImageToEmbed); // Save it for them
              } catch (e) {
                  console.warn("Background removal failed, using original.", e);
                  finalImageToEmbed = partImage.base64;
              }
          }
      }
      
      setCurrentStep(acesPiesData ? `Parsing Data & generating ${platform} listing...` : `Generating ${platform} listing...`);
      
      const generatedListing = await generateListingContent(
          partImage.base64, 
          extractedId, 
          dataHtml, 
          listingStyle, 
          platform,
          scanType,
          { 
              price, 
              location, 
              condition, 
              donorVin, 
              mileage, 
              acesPiesData, 
              donorVehicleDetails,
              embeddedImageUrl: finalImageToEmbed 
          }
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
      console.error(err);
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

  // UI Helpers
  const getThemeColor = () => {
      if (scanType === 'auto-part') return 'fuchsia';
      if (scanType === 'electronics') return 'indigo';
      return 'cyan';
  };
  
  const themeColor = getThemeColor();
  
  const getImageLabel1 = () => {
      if (scanType === 'auto-part') return "Step 1: Part Photo";
      if (scanType === 'electronics') return "Step 1: Device Photo";
      return "Step 1: Item Photo";
  };
  
  const getImageLabel2 = () => {
      if (scanType === 'auto-part') return "Step 2: Serial/Part #";
      if (scanType === 'electronics') return "Step 2: Model # / Serial";
      return "Step 2: Barcode / UPC";
  };
  
  const getPlaceholder = () => {
      if (scanType === 'auto-part') return "e.g. 89661-02K30";
      if (scanType === 'electronics') return "e.g. WH-1000XM4 or A1706";
      return "e.g. 885909950805";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center relative overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-gray-900 to-gray-950 z-0"></div>
      <div className={`absolute top-[-10%] right-[-5%] w-96 h-96 bg-${themeColor}-600/20 rounded-full blur-3xl pointer-events-none transition-all duration-500`}></div>
      <div className={`absolute top-[10%] left-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none transition-all duration-500`}></div>

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
                            <>Rapid<span className={`text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-${themeColor}-400`}>Listing</span>Tool.com</>
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
            Universal <span className={`text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-${themeColor}-500`}>Reseller Tool</span>
          </h1>
          <p className="text-base text-gray-400 max-w-xl mx-auto">
            Generate professional listings for Electronics, Auto Parts, or Everyday Items using AI.
            <br/>
            <span className="text-xs text-gray-500">Current Profile: {userProfile.businessName}</span>
          </p>
        </header>

        {/* Scan Type Toggle */}
        <div className="flex justify-center mb-8">
            <div className="bg-gray-800 p-1.5 rounded-xl inline-flex shadow-lg border border-gray-700 flex-wrap justify-center gap-2 md:gap-0">
                <button
                    onClick={() => setScanType('auto-part')}
                    className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        scanType === 'auto-part'
                            ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    Auto Parts
                </button>
                <button
                    onClick={() => setScanType('electronics')}
                    className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        scanType === 'electronics'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 2a1 1 0 00-.707.293l-1 1A1 1 0 005 4v12a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-.293-.707l-1-1A1 1 0 0013 2H7zM7 4h6v2H7V4zm6 6H7v6h6v-6z" clipRule="evenodd" />
                    </svg>
                    Electronics
                </button>
                <button
                    onClick={() => setScanType('general-item')}
                    className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                        scanType === 'general-item'
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/20'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V7a1 1 0 00-1-1H5z" clipRule="evenodd" />
                        <path d="M7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" />
                    </svg>
                    General
                </button>
            </div>
        </div>

        <main className="flex-grow w-full">
          <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 border border-gray-700/50 mb-12 relative">
             {/* Indicator for current mode */}
             <div className={`absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-xl border ${
                 scanType === 'auto-part' ? 'bg-fuchsia-900 text-fuchsia-200 border-fuchsia-700' :
                 scanType === 'electronics' ? 'bg-indigo-900 text-indigo-200 border-indigo-700' : 
                 'bg-cyan-900 text-cyan-200 border-cyan-700'
             }`}>
                 {scanType === 'auto-part' ? 'Auto Parts Scanner' : scanType === 'electronics' ? 'Electronics & Tech Scanner' : 'Barcode & Product Scanner'}
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 mt-4">
              <ImageUploader 
                id="part-image" 
                label={getImageLabel1()}
                onImageUpload={(file) => handleImageUpload(file, 'part')} 
                imagePreviewUrl={partImage ? URL.createObjectURL(partImage.file) : null}
                onClearImage={() => setPartImage(null)}
              />
              <ImageUploader 
                id="serial-image" 
                label={getImageLabel2()}
                onImageUpload={(file) => handleImageUpload(file, 'serial')} 
                imagePreviewUrl={serialImage ? URL.createObjectURL(serialImage.file) : null}
                onClearImage={() => setSerialImage(null)}
              />
            </div>
            
             {/* --- AI PHOTO STUDIO SECTION --- */}
            {partImage && (
                <div className="mb-8 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 relative overflow-hidden group shadow-inner animate-fade-in">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">AI PHOTO STUDIO</div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        Professional Background Replacer
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Select Background Style</label>
                                <select 
                                    value={bgStyle} 
                                    onChange={(e) => setBgStyle(e.target.value as BackgroundStyle)}
                                    className="w-full bg-gray-950 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="studio-white">Studio White (E-commerce Standard)</option>
                                    <option value="industrial">Mechanic's Workbench (Auto)</option>
                                    <option value="lifestyle-wood">Modern Wood Table (Lifestyle)</option>
                                    <option value="sleek-dark">Sleek Dark Surface (Premium)</option>
                                    <option value="outdoor-natural">Outdoor / Natural (Tools/Sport)</option>
                                </select>
                            </div>

                            <button
                                onClick={handleProcessImage}
                                disabled={isProcessingImage}
                                className={`w-full py-2.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                    isProcessingImage 
                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                                }`}
                            >
                                {isProcessingImage ? (
                                    <>
                                        <Spinner className="h-4 w-4 text-white" />
                                        Processing...
                                    </>
                                ) : (
                                    'Generate Pro Photo'
                                )}
                            </button>
                        </div>

                        <div className="relative bg-black rounded-lg h-56 flex items-center justify-center border border-gray-700 overflow-hidden group-hover:border-gray-500 transition-colors">
                            {processedImage ? (
                                <>
                                    <img src={processedImage} alt="Processed" className="h-full w-full object-contain" />
                                    <button 
                                        type="button"
                                        onClick={handleDownloadImage}
                                        className="absolute bottom-3 right-3 bg-gray-900/90 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm border border-gray-600 flex items-center gap-1.5 transition-all hover:scale-105 shadow-xl"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Image
                                    </button>
                                </>
                            ) : (
                                <div className="text-gray-500 text-sm text-center p-6 flex flex-col items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p>Select a style and click 'Generate' to see preview.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* --- END PHOTO STUDIO --- */}

            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 text-red-200 rounded-lg text-sm text-center animate-bounce-in">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Spinner className={`h-12 w-12 text-${themeColor}-500`} />
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

                  {/* Settings Row (Embed Photo & Template) - AVAILABLE FOR ALL PLATFORMS */}
                  <div className="flex flex-col gap-4 mb-4 animate-fade-in">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={embedPhoto} 
                                    onChange={e => setEmbedPhoto(e.target.checked)} 
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </div>
                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                Embed Photo
                                <span className="block text-[10px] text-gray-500 font-normal">Auto-optimizes background</span>
                            </span>
                        </label>

                        {/* Template selector currently affects eBay mainly, but kept visible as requested */}
                        <div className="flex items-center gap-2">
                            <label htmlFor="listing-style" className="text-sm font-medium text-gray-400">Template:</label>
                            <div className="flex">
                                <select
                                    id="listing-style"
                                    value={listingStyle}
                                    onChange={(e) => setListingStyle(e.target.value as ListingStyle)}
                                    className="bg-gray-800 border border-gray-600 text-white text-sm rounded-l-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 border-r-0"
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
                                <button
                                    onClick={() => setIsStylePreviewOpen(true)}
                                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 rounded-r-lg border border-gray-600 border-l-0 transition-colors flex items-center justify-center"
                                    title="Preview Style"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                      </div>
                  </div>

                  {/* Auto Parts Specific Inputs (VIN/Mileage) */}
                  {scanType === 'auto-part' && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2 animate-fade-in bg-fuchsia-900/10 p-4 rounded-xl border border-fuchsia-800/30">
                         <div>
                             <label className="block text-sm font-medium text-gray-300 mb-1">Donor VIN (Optional)</label>
                             <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={donorVin} 
                                    onChange={(e) => setDonorVin(e.target.value)} 
                                    placeholder="17-Digit VIN" 
                                    maxLength={17}
                                    className="w-full bg-gray-900 border border-gray-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-fuchsia-500 focus:outline-none placeholder-gray-600 uppercase"
                                />
                                <button
                                    onClick={handleVinDecode}
                                    disabled={isVinLoading || donorVin.length < 17}
                                    className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                    {isVinLoading ? 'Decoding...' : 'Decode'}
                                </button>
                             </div>
                             {donorVehicleDetails && (
                                <div className="mt-2 text-xs text-green-400 bg-green-900/20 border border-green-800 p-2 rounded flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="flex-grow">{donorVehicleDetails}</span>
                                    <button onClick={() => setDonorVehicleDetails('')} className="ml-auto text-gray-500 hover:text-white">
                                        &times;
                                    </button>
                                </div>
                             )}
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
                                <textarea
                                    value={acesPiesData}
                                    onChange={(e) => setAcesPiesData(e.target.value)}
                                    placeholder="<App action='A' id='1'>..."
                                    className="w-full h-32 bg-gray-950 border border-gray-700 rounded p-2 text-xs font-mono text-green-400 focus:ring-1 focus:ring-fuchsia-500 focus:outline-none"
                                />
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
                                {scanType === 'electronics' ? (
                                    <>
                                        <option>Used - Tested & Working</option>
                                        <option>Used - Good Condition</option>
                                        <option>For Parts / Not Working</option>
                                        <option>Open Box</option>
                                    </>
                                ) : (
                                    <>
                                        <option>Used - Like New</option>
                                        <option>Used - Good</option>
                                        <option>Used - Fair</option>
                                        <option>For Parts / Salvage</option>
                                    </>
                                )}
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
                                : scanType === 'electronics'
                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-900/20'
                                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20'
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
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-${themeColor}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {scanType === 'auto-part' ? 'Manual Fitment Check' : scanType === 'electronics' ? 'Spec & Value Lookup' : 'Manual Product Lookup'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {scanType === 'auto-part' ? "Check fitment without generating a full listing." : "Check specs/value without generating a full listing."}
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
                      placeholder={getPlaceholder()}
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
                        titleOverride={lookupMethod === 'image' ? 'Visual Search Report' : (scanType === 'general-item' ? 'Product Specifications' : scanType === 'electronics' ? 'Technical Specifications' : undefined)}
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
      
      {isStylePreviewOpen && (
          <StylePreviewModal 
            isOpen={isStylePreviewOpen} 
            onClose={() => setIsStylePreviewOpen(false)} 
            style={listingStyle} 
            showImage={embedPhoto}
          />
      )}

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