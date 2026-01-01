import React from 'react';
import { ListingStyle } from '../services/geminiService';

interface StylePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: ListingStyle;
  showImage: boolean;
}

export const StylePreviewModal: React.FC<StylePreviewModalProps> = ({ isOpen, onClose, style, showImage }) => {
  if (!isOpen) return null;

  const getPreviewHtml = (s: ListingStyle) => {
    const title = "Sample Item Title";
    const id = "12345-SAMPLE";
    const condition = "Used - Excellent";
    const description = "This is a sample description of the item to demonstrate the visual style of the listing template. It includes details about condition, features, and other relevant information.";
    const specs = "<ul><li><strong>Brand:</strong> Example Brand</li><li><strong>Model:</strong> EX-2000</li></ul>";
    
    // Placeholder image HTML to show where the "AI Photo Studio" image would go
    const imagePlaceholder = showImage ? `
        <div style="width: 100%; text-align: center; margin-bottom: 25px; padding: 20px; background-color: #f8f9fa; border: 1px dashed #ccc; border-radius: 8px;">
            <div style="color: #666; font-size: 0.9em; font-style: italic;">[AI Photo Studio Image Appears Here]</div>
            <div style="width: 120px; height: 80px; background-color: #ddd; margin: 10px auto; display: flex; align-items: center; justify-content: center; color: #888;">IMG</div>
        </div>
    ` : '';

    switch (s) {
      case 'minimalist':
        return `
            ${imagePlaceholder}
            <h2>${title}</h2>
            <h3>Quick Specs</h3>
            <ul>
                <li><strong>Model/ID:</strong> ${id}</li>
                <li><strong>Condition:</strong> ${condition}</li>
            </ul>
            <h3>Technical Specifications</h3>
            ${specs}
        `;
      case 'table-layout':
        return `
            ${imagePlaceholder}
            <h2>${title}</h2>
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="border-bottom: 1px solid #ccc;">
                    <td style="padding: 10px;"><strong>Model/SKU</strong></td>
                    <td style="padding: 10px;">${id}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ccc;">
                    <td style="padding: 10px;"><strong>Condition</strong></td>
                    <td style="padding: 10px;">${condition}</td>
                </tr>
            </table>
            <h3>Detailed Description</h3>
            <p>${description}</p>
        `;
      case 'bold-classic':
        return `
            ${imagePlaceholder}
            <h1 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">${title}</h1>
            <div style="text-align: center; font-weight: bold; margin: 10px 0;">ID: ${id}</div>
            <hr />
            <h3>Item Description</h3>
            <p>${description}</p>
            <hr />
            <h3>Specs</h3>
            ${specs}
        `;
      case 'modern-card':
        return `
            ${imagePlaceholder}
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px 8px 0 0; color: #1f2937;">
                <h2 style="margin:0;">${title}</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.8;">ID: <strong>${id}</strong> | Condition: <strong>${condition}</strong></p>
            </div>
            <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <h3 style="color: #374151;">Details</h3>
                <p style="color: #4b5563;">${description}</p>
                <h3 style="color: #374151;">Specs</h3>
                <div style="color: #4b5563;">${specs}</div>
            </div>
        `;
      case 'luxury':
        return `
            <div style="text-align: center; padding: 40px; border: 1px solid #e5e5e5; max-width: 800px; margin: 0 auto; font-family: Georgia, serif; color: #333; background: #fff;">
                ${imagePlaceholder}
                <h2 style="text-transform: uppercase; letter-spacing: 3px; font-size: 24px; margin-bottom: 10px; font-weight: normal;">${title}</h2>
                <div style="width: 40px; height: 1px; background: #000; margin: 20px auto;"></div>
                <p style="font-style: italic; color: #777; font-size: 0.9em;">ID: ${id} &bull; ${condition}</p>
                <div style="margin: 40px 0; line-height: 1.8; font-size: 1.1em;">
                    ${description}
                </div>
                <h3 style="text-transform: uppercase; letter-spacing: 2px; font-size: 14px; margin-top: 40px; font-weight: normal;">Specifications</h3>
                ${specs}
            </div>
        `;
      case 'vintage':
        return `
            <div style="background-color: #fdf6e3; padding: 40px; border: 4px double #d2b48c; font-family: 'Courier New', Courier, monospace; color: #5b4636;">
                ${imagePlaceholder}
                <h2 style="text-align: center; border-bottom: 1px dashed #d2b48c; padding-bottom: 20px; margin-bottom: 20px;">${title}</h2>
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 30px;">
                    <span>ITEM ID: ${id}</span>
                    <span>COND: ${condition}</span>
                </div>
                <div style="line-height: 1.6; text-align: justify;">
                     ${description}
                </div>
                <h3 style="margin-top: 30px; text-decoration: underline;">Specifications</h3>
                ${specs}
            </div>
        `;
      case 'handmade':
        return `
            <div style="font-family: 'Verdana', sans-serif; color: #555; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background: #fff;">
                ${imagePlaceholder}
                <h2 style="color: #6b8e23; font-weight: normal; font-size: 26px;">${title}</h2>
                <p style="color: #999; font-size: 0.85em; letter-spacing: 0.5px;">ID: ${id} | Artisan Quality</p>
                <div style="padding: 20px 0; line-height: 1.7;">
                    ${description}
                </div>
                <h3 style="color: #6b8e23; margin-top: 30px;">Specifications</h3>
                ${specs}
            </div>
        `;
      case 'collectible':
        return `
            <div style="border: 1px solid #333; background: #fff; font-family: Arial, sans-serif; color: #000;">
                <div style="background: #111; color: #fff; padding: 10px 20px; font-weight: bold; letter-spacing: 1px;">
                    COLLECTOR GRADE LISTING
                </div>
                <div style="padding: 30px;">
                    ${imagePlaceholder}
                    <h2 style="margin-top: 0;">${title}</h2>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                        <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Catalog ID</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${id}</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Condition Grade</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${condition}</td></tr>
                    </table>
                    <h3>Condition Report</h3>
                    <p>${description}</p>
                </div>
            </div>
        `;
      default: // professional
        return `
            ${imagePlaceholder}
            <h2>${title}</h2>
            <p><strong>ID:</strong> ${id}</p>
            <h3>Product Details</h3>
            <p>${description}</p>
            <h3>Specifications</h3>
            ${specs}
        `;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[80] p-4 animate-fade-in">
        <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-700">
            <header className="flex justify-between items-center p-5 border-b border-gray-700 bg-gray-800 rounded-t-xl">
                <h3 className="text-xl font-bold text-white">Style Preview: <span className="text-blue-400 capitalize">{style.replace('-', ' ')}</span></h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </header>
            <div className="p-6 overflow-y-auto bg-gray-900">
                <div className="bg-white rounded-lg p-4 text-black shadow-inner overflow-hidden">
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: getPreviewHtml(style) }} />
                </div>
            </div>
            <footer className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-xl text-right">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg"
                >
                    Close Preview
                </button>
            </footer>
        </div>
    </div>
  );
};