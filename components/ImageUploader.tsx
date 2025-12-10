import React, { useState, useEffect } from 'react';

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
      <p id={`${id}-label`} className="text-lg font-semibold text-gray-300 mb-2">{label}</p>
      <label 
        htmlFor={id}
        aria-labelledby={`${id}-label`}
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
              className={`w-full h-full object-contain rounded-lg p-1 transition-all duration-700 ease-out transform ${
                  isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-95'
              }`} 
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
};