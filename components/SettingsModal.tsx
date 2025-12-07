import React, { useState, useEffect } from 'react';

export interface UserProfile {
  businessName: string;
  location: string;
  shippingPolicy: string;
  returnPolicy: string;
  aboutAuto: string;
  aboutGeneral: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  businessName: "ChrisJayden",
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
  const [profile, setProfile] = useState<UserProfile>(currentProfile);

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
                This information will be automatically appended to the bottom of your listings and CSV exports.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Business Name</label>
                    <input 
                        type="text" 
                        value={profile.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. ChrisJayden"
                    />
                </div>
                <div>
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
};