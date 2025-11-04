
import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultCard } from './components/ResultCard';
import { Spinner } from './components/Spinner';
import { extractPartNumberFromImage, generateListingContent, getCompatibilityData } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { CompatibilityCard } from './components/CompatibilityCard';

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
      
      setCurrentStep(`Part number "${partNumber}" found. Generating eBay listing with compatibility data (this may take a minute)...`);
      const generatedListing = await generateListingContent(partImage.base64, partNumber);

      setListing(generatedListing);
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
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                eBay Motors Listing Generator
            </h1>
            <p className="mt-4 text-lg text-gray-400">
                Generate professional eBay listings for used auto parts in seconds.
            </p>
        </header>

        <main>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl p-4 md:p-6 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
              <ImageUploader
                id="part-image"
                label="Step 1: Upload Part Photo"
                onImageUpload={(file) => handleImageUpload(file, 'part')}
                imagePreviewUrl={partImage?.file ? URL.createObjectURL(partImage.file) : null}
                onClearImage={() => setPartImage(null)}
              />
              <ImageUploader
                id="serial-image"
                label="Step 2: Upload Serial Number Photo"
                onImageUpload={(file) => handleImageUpload(file, 'serial')}
                imagePreviewUrl={serialImage?.file ? URL.createObjectURL(serialImage.file) : null}
                onClearImage={() => setSerialImage(null)}
              />
            </div>

            <div className="text-center">
              <button
                onClick={handleGenerateListing}
                disabled={isGenerateButtonDisabled}
                className={`w-full max-w-xs px-8 py-3 font-semibold rounded-lg text-white transition-all duration-300 ease-in-out
                  ${isGenerateButtonDisabled
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 transform hover:scale-105'
                  }`}
              >
                {isLoading ? 'Generating...' : 'Step 3: Generate Listing'}
              </button>
            </div>

            <div className="relative flex py-5 items-center my-2">
              <div className="flex-grow border-t border-gray-600"></div>
              <span className="flex-shrink mx-4 text-gray-400 font-semibold">OR</span>
              <div className="flex-grow border-t border-gray-600"></div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-center text-gray-300">
                    Look Up Part by Number
                </h3>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <input
                        type="text"
                        value={manualPartNumber}
                        onChange={(e) => setManualPartNumber(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLookupCompatibility(); }}
                        placeholder="Enter Part Number (e.g., 9F593)"
                        className="bg-gray-900/70 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg px-4 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        aria-label="Part Number Input"
                    />
                    <button
                        onClick={handleLookupCompatibility}
                        disabled={!manualPartNumber.trim() || isCompatibilityLoading}
                        className={`w-full sm:w-auto px-6 py-2 font-semibold rounded-lg text-white transition-all duration-300 ease-in-out flex items-center justify-center
                          ${!manualPartNumber.trim() || isCompatibilityLoading
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 transform hover:scale-105'
                          }`}
                    >
                      {isCompatibilityLoading ? (
                        <span className="flex items-center">
                          <Spinner className="h-5 w-5 text-white mr-2" />
                          Searching...
                        </span>
                      ) : (
                        'Look Up'
                      )}
                    </button>
                </div>
            </div>
          </div>
          
          {isLoading && (
            <div className="mt-8 text-center bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <Spinner />
              <p className="mt-4 text-lg text-blue-300 animate-pulse">{currentStep}</p>
            </div>
          )}

          {isCompatibilityLoading && (
            <div className="mt-8 text-center bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <Spinner />
              <p className="mt-4 text-lg text-blue-300 animate-pulse">Searching for compatibility data...</p>
            </div>
          )}

          {error && (
            <div className="mt-8 p-4 text-center bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {compatibilityError && (
            <div className="mt-8 p-4 text-center bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
              <p className="font-bold">Error</p>
              <p>{compatibilityError}</p>
            </div>
          )}

          {listing && !isLoading && (
            <div className="mt-8">
              <ResultCard title={listing.title} description={listing.description} />
            </div>
          )}

          {compatibilityData && !isCompatibilityLoading && (
            <div className="mt-8">
              <CompatibilityCard partNumber={manualPartNumber} compatibilityHtml={compatibilityData} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}