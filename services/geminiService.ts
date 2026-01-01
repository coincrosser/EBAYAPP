// ... existing imports
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card' | 'luxury' | 'vintage' | 'handmade' | 'collectible';
export type Platform = 'ebay' | 'facebook' | 'craigslist';
export type ScanType = 'auto-part' | 'general-item' | 'electronics';
export type BackgroundStyle = 'studio-white' | 'industrial' | 'lifestyle-wood' | 'sleek-dark' | 'outdoor-natural';

export interface ListingOptions {
    price?: string;
    location?: string;
    condition?: string;
    donorVin?: string;
    mileage?: string;
    acesPiesData?: string; // Raw XML or CSV content
    donorVehicleDetails?: string; // Decoded VIN details
    embeddedImageUrl?: string; // The base64 image to embed in the description
}

// ... existing helper functions (imageDataUrlToGenerativePart, decodeVin, extractIdentifierFromImage, optimizeImageBackground, getProductData, performVisualSearch, getStyleInstruction)

const imageDataUrlToGenerativePart = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    console.warn("Input was not a valid data URL. Falling back to image/jpeg.");
    return {
      inlineData: {
        data: dataUrl,
        mimeType: 'image/jpeg',
      },
    };
  }

  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
};

export async function decodeVin(vin: string): Promise<string> {
  const prompt = `
    You are an expert VIN decoder.
    Decode the VIN: "${vin}".
    Use Google Search to verify the Year, Make, Model, Trim, and Engine.
    Return ONLY a single string summary.
    Format: "Year Make Model Trim Engine"
    Example: "2018 Ford F-150 Lariat 3.5L V6"
    If you cannot find specific details, return "Vehicle Details Not Found".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error decoding VIN:", error);
    throw new Error("Could not decode VIN.");
  }
}

export async function extractIdentifierFromImage(imageDataUrl: string, type: ScanType): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  const autoPrompt = `
    Analyze this image of a used car part.
    Perform Optical Character Recognition (OCR).
    Identify the PRIMARY Part Number. 
    Distinguish between:
    1. OEM Part Number (Target) - usually printed on a label or stamped clearly (e.g. Toyota 12345-67890).
    2. Engineering/Casting Number - often cast into metal, slightly different from part number.
    3. Date Codes/Lot Numbers (Ignore).
    Return ONLY the alphanumeric string of the most likely OEM Part Number.
  `;

  const electronicsPrompt = `
    Analyze this image of an electronic device or label.
    Identify the MODEL NUMBER (e.g., "WH-1000XM4", "A1706", "CUH-7215B").
    Often found on the back, bottom, or under the battery.
    If a Serial Number (S/N) is prominent, you may ignore it and focus on the Model Number for identification.
    Return ONLY the alphanumeric Model Number string.
  `;

  const generalPrompt = `
    Analyze this image of a product.
    Look specifically for a BARCODE (UPC, EAN), ISBN, or a printed Model Number.
    Perform OCR to read the numbers below the barcode or the text on the label.
    Return ONLY the numeric UPC/EAN code or alphanumeric Model Number.
    If multiple are visible, prefer the UPC (12 digits) or EAN (13 digits).
    Do not add labels like "UPC:" or "Model:". Just return the code.
  `;

  let selectedPrompt = generalPrompt;
  if (type === 'auto-part') selectedPrompt = autoPrompt;
  if (type === 'electronics') selectedPrompt = electronicsPrompt;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: selectedPrompt }] },
    });
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI returned an empty response. Please try a clearer picture.");
    }
    return text;
  } catch (error) {
    console.error("Error extracting identifier:", error);
    throw new Error(`Failed to extract data from image. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

export async function optimizeImageBackground(imageDataUrl: string, style: BackgroundStyle = 'studio-white'): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  let prompt = "Isolate the main object in this image and place it on a clean, pure white professional studio background. Improve lighting slightly for product photography.";

  if (style === 'industrial') {
      prompt = "Isolate the main object (auto part or tool) and place it on a clean, professional mechanic's workbench surface. The background should be a blurred, high-end workshop environment. Professional lighting.";
  } else if (style === 'lifestyle-wood') {
      prompt = "Isolate the main object and place it on a clean, modern wooden tabletop. The background should be a soft, blurred modern interior. Bright, natural lighting.";
  } else if (style === 'sleek-dark') {
      prompt = "Isolate the main object and place it on a sleek, dark, slightly reflective surface with dramatic rim lighting. High-contrast, premium look.";
  } else if (style === 'outdoor-natural') {
      prompt = "Isolate the main object and place it in a blurred, natural outdoor setting with soft sunlight. Professional depth of field.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          imagePart,
          { text: prompt },
        ],
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Error optimizing image:", error);
    throw new Error("Failed to process image background.");
  }
}

export async function getProductData(identifier: string, type: ScanType): Promise<string> {
    // ... existing implementation ...
    const autoPrompt = `
    You are an expert on automotive parts, ACES (Aftermarket Catalog Exchange Standard), and PIES (Product Information Exchange Standard).
    For the given auto part number "${identifier}", perform a search to find its vehicle compatibility (Year, Make, Model, Trim).
    
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes/Attributes".
    If you cannot find any data, return: <p>No compatibility information found for part number ${identifier}.</p>
  `;

  const electronicsPrompt = `
    You are an expert consumer electronics specialist.
    For the device model "${identifier}", find its key technical specifications.
    
    Your response must be ONLY a well-structured HTML table with a header row (<th>).
    Do not include markdown blocks.
    The table should include columns for: "Spec Category", "Detail".
    Rows should cover:
    - Processor / Chipset
    - RAM / Storage (if applicable)
    - Screen Size / Resolution (if applicable)
    - Battery / Power Info
    - Connectivity (Ports, Wifi, BT)
    - Release Year
    
    If specific specs aren't found, return: <p>No detailed specs found for model ${identifier}.</p>
  `;

  const generalPrompt = `
    You are an expert product researcher.
    For the given product identifier (UPC, Barcode, or Model Name): "${identifier}", perform a search to find its technical specifications.
    Your response must be ONLY a well-structured HTML table with a header row (<th>).
    Ensure the table is formatted for easy reading.
    Do not include any other text.
    The table should have columns for: "Brand", "Model/MPN", "Category", "Key Features", and "Dimensions/Weight" (if available).
    If you cannot find specific data, return: <p>No specific product details found for ID ${identifier}.</p>
  `;

  let selectedPrompt = generalPrompt;
  if (type === 'auto-part') selectedPrompt = autoPrompt;
  if (type === 'electronics') selectedPrompt = electronicsPrompt;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: selectedPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.trim().replace(/^```html\s*|```$/g, '');
    if (!text) {
        throw new Error("The AI returned an empty response for data lookup.");
    }
    return text;
  } catch (error) {
    console.error("Error fetching product data:", error);
    throw new Error(`Failed to look up data. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

export async function performVisualSearch(imageDataUrl: string, type: ScanType): Promise<string> {
    // ... existing implementation ...
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  let typeContext = 'product';
  if (type === 'auto-part') typeContext = 'auto part';
  if (type === 'electronics') typeContext = 'electronic device';

  const prompt = `
    You are an expert visual search assistant.
    Analyze the provided image of a ${typeContext}.
    Use your visual recognition capabilities and Google Search grounding to identify the item.
    
    Return a structured HTML report (do not use Markdown code blocks) with the following sections:
    1. <h3>Visual Identification</h3>
       <ul>
         <li><strong>Identified Item:</strong> [Name/Title]</li>
         <li><strong>Brand/Manufacturer:</strong> [Brand]</li>
         <li><strong>Model/Series:</strong> [Model]</li>
       </ul>
    2. <h3>Market Findings</h3>
       <p>Search online and list 3-5 similar items currently listed on eBay/Amazon. Include approximate price ranges.</p>
    3. <h3>Key Details</h3>
       <p>List visible features, inputs/outputs, condition notes (scratches, wear), or specific part details.</p>
    
    If you cannot identify it, state that clearly in the HTML.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.trim().replace(/^```html\s*|```$/g, '');
    if (!text) {
        throw new Error("The AI returned an empty response for visual search.");
    }
    return text;
  } catch (error) {
    console.error("Error performing visual search:", error);
    throw new Error(`Failed to perform visual search. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

const getStyleInstruction = (style: ListingStyle, identifier: string, supplementalHtml: string, type: ScanType, statsHtml: string, hasImage: boolean): string => {
    // ... existing implementation with updated signature from previous turn ...
    // Note: Re-stating here for completeness if needed, but only generateListingContent needs the logic update.
    // I'll skip re-writing this large function unless logic inside changed.
    // It seems logic inside is fine, just passed 'hasImage' boolean.
    // The previous implementation already handles 'hasImage' in getStyleInstruction.
    
    // Shared instructions
    const commonInstructions = `
        *   Create a concise, SEO-friendly title optimized for search.
        *   Include: Brand, Model, Key Features, and ID "${identifier}".
        *   For Auto Parts: STRICTLY follow the format "Year Make Model PartName Position MPN". Max 80 characters.
        *   For Electronics: Include Brand, Model, Processor/Spec (if known), and Condition (e.g. "Tested", "Parts Only").
        ${hasImage ? '*   Include the marker "{{IMAGE_PLACEHOLDER}}" in the HTML where the product image should appear. Place it prominently at the top or inside the main visual container.' : ''}
    `;
    
    // ... rest of getStyleInstruction ...
    const isAuto = type === 'auto-part';
    const isElec = type === 'electronics';
    
    let specTitle = "Product Specifications";
    if (isAuto) specTitle = "Vehicle Fitment (ACES)";
    if (isElec) specTitle = "Technical Specifications";

    let condTitle = "Pre-Owned / Used";
    if (isAuto) condTitle = "Used OEM";
    if (isElec) condTitle = "Used - Tested & Working";

    const imgMarker = hasImage ? '{{IMAGE_PLACEHOLDER}}' : '';

    if (style === 'minimalist') {
        return `
            ${commonInstructions}
            **Description Generation (Minimalist HTML):**
            *   Clean, mobile-friendly, bullet points.
            *   Structure:
                1.  ${imgMarker}
                2.  <h2>Title</h2>
                3.  <h3>Quick Specs</h3>
                    <ul>
                        <li><strong>Model/ID:</strong> ${identifier}</li>
                        <li><strong>Condition:</strong> ${condTitle} (See Photos)</li>
                        ${statsHtml}
                    </ul>
                4.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'table-layout') {
        return `
            ${commonInstructions}
            **Description Generation (Table Layout HTML):**
            *   Structured, technical look.
            *   Structure:
                1.  ${imgMarker}
                2.  <h2>Title</h2>
                3.  HTML Table (width:100%):
                    *   <strong>Model/SKU</strong> | ${identifier}
                    *   <strong>Condition</strong> | ${condTitle}
                4.  <h3>Detailed Description</h3>
                    <p>[Analyze image and describe item]</p>
                    ${statsHtml ? `<h3>Additional Info</h3>${statsHtml}` : ''}
                5.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'bold-classic') {
        return `
            ${commonInstructions}
            **Description Generation (Bold Classic HTML):**
            *   High-contrast, centered, horizontal rules.
            *   Structure:
                1.  ${imgMarker}
                2.  <h1 style="text-align: center; border-bottom: 2px solid #000;">Title</h1>
                3.  <div style="text-align: center; font-weight: bold;">ID: ${identifier}</div>
                4.  <hr />
                5.  <h3>Item Description</h3>
                    <p>[Analyze image and describe item]</p>
                    ${statsHtml ? `<div style="background:#eee; padding:10px; margin:10px 0;"><strong>Stats:</strong> ${statsHtml}</div>` : ''}
                6.  <hr />
                7.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'modern-card') {
        return `
            ${commonInstructions}
            **Description Generation (Modern Card HTML):**
            *   Boxed layout, gray headers.
            *   Structure:
                1.  <div style="background-color: #f3f4f6; padding: 20px;">
                        ${imgMarker}
                        <h2>Title</h2>
                        <p>ID: <strong>${identifier}</strong> | Condition: <strong>${condTitle}</strong></p>
                    </div>
                2.  <div style="padding: 20px;">
                        <h3>Details</h3>
                        <p>[Analyze image and describe item]</p>
                        ${statsHtml ? `<p><strong>Note:</strong> ${statsHtml}</p>` : ''}
                        <h3>${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else if (style === 'luxury') {
        return `
            ${commonInstructions}
            **Description Generation (Luxury / High-End HTML):**
            *   Elegant, minimalist, serif fonts, high-end feel.
            *   Structure:
                1.  <div style="text-align: center; padding: 40px; border: 1px solid #e5e5e5; max-width: 800px; margin: 0 auto; font-family: Georgia, serif; color: #333;">
                        ${imgMarker}
                        <h2 style="text-transform: uppercase; letter-spacing: 3px; font-size: 24px; margin-bottom: 10px; font-weight: normal;">Title</h2>
                        <div style="width: 40px; height: 1px; background: #000; margin: 20px auto;"></div>
                        <p style="font-style: italic; color: #777; font-size: 0.9em;">ID: ${identifier} &bull; ${condTitle}</p>
                        <div style="margin: 40px 0; line-height: 1.8; font-size: 1.1em;">
                            [Description emphasizing quality, authenticity, and condition]
                        </div>
                        ${statsHtml ? `<div style="border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 15px 0; margin: 30px 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">${statsHtml}</div>` : ''}
                        <h3 style="text-transform: uppercase; letter-spacing: 2px; font-size: 14px; margin-top: 40px; font-weight: normal;">${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else if (style === 'vintage') {
        return `
            ${commonInstructions}
            **Description Generation (Vintage / Retro HTML):**
            *   Warm tones, typewriter font, nostalgic.
            *   Structure:
                1.  <div style="background-color: #fdf6e3; padding: 40px; border: 4px double #d2b48c; font-family: 'Courier New', Courier, monospace; color: #5b4636;">
                        ${imgMarker}
                        <h2 style="text-align: center; border-bottom: 1px dashed #d2b48c; padding-bottom: 20px; margin-bottom: 20px;">Title</h2>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 30px;">
                            <span>ITEM ID: ${identifier}</span>
                            <span>COND: ${condTitle}</span>
                        </div>
                        <div style="line-height: 1.6; text-align: justify;">
                             [Description highlighting the era, patina, and vintage character]
                        </div>
                        ${statsHtml ? `<div style="background: #eee8d5; padding: 15px; margin: 25px 0; border: 1px solid #d2b48c;"><strong>SPECIFICATIONS:</strong> ${statsHtml}</div>` : ''}
                        <h3 style="margin-top: 30px; text-decoration: underline;">${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else if (style === 'handmade') {
        return `
            ${commonInstructions}
            **Description Generation (Handmade / Artisan HTML):**
            *   Clean, earthy, personal, maker-focused.
            *   Structure:
                1.  <div style="font-family: 'Verdana', sans-serif; color: #555; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                        ${imgMarker}
                        <h2 style="color: #6b8e23; font-weight: normal; font-size: 26px;">Title</h2>
                        <p style="color: #999; font-size: 0.85em; letter-spacing: 0.5px;">ID: ${identifier} | Artisan Quality</p>
                        <div style="padding: 20px 0; line-height: 1.7;">
                            [Description focusing on materials, craftsmanship, and unique details]
                        </div>
                        ${statsHtml ? `<div style="background: #f8fcf0; padding: 15px; border-left: 4px solid #6b8e23; margin: 20px 0;">${statsHtml}</div>` : ''}
                        <h3 style="color: #6b8e23; margin-top: 30px;">${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else if (style === 'collectible') {
        return `
            ${commonInstructions}
            **Description Generation (Collectible / Investment HTML):**
            *   Clinical, grading-focused, authoritative.
            *   Structure:
                1.  <div style="border: 1px solid #333; background: #fff; font-family: Arial, sans-serif;">
                        <div style="background: #111; color: #fff; padding: 10px 20px; font-weight: bold; letter-spacing: 1px;">
                            COLLECTOR GRADE LISTING
                        </div>
                        <div style="padding: 30px;">
                            ${imgMarker}
                            <h2 style="margin-top: 0;">Title</h2>
                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                                <tr style="background: #f5f5f5;"><td style="padding: 10px; border: 1px solid #ddd;"><strong>Catalog ID</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${identifier}</td></tr>
                                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Condition Grade</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${condTitle}</td></tr>
                            </table>
                            <h3>Condition Report</h3>
                            <p>[Rigorous analysis of condition, flaws, wear, and rarity]</p>
                            ${statsHtml ? `<p><strong>Attributes:</strong> ${statsHtml}</p>` : ''}
                            <h3>${specTitle}</h3>
                            ${supplementalHtml}
                        </div>
                    </div>
        `;
    } else {
        // Professional (Default)
        return `
            ${commonInstructions}
            **Description Generation (Professional HTML):**
            *   Standard professional listing format.
            *   Structure:
                a. ${imgMarker}
                b. **Header:** <h2>Title</h2>, <p><strong>ID:</strong> ${identifier}</p>.
                c. **Product Details:** <h3>Product Details</h3>. Analyze image for condition. 
                ${isElec ? 'Mention cosmetic condition of screen/casing explicitly.' : ''}
                ${statsHtml ? `d. **Notes:** <h3>Additional Information</h3> <p>${statsHtml}</p>` : ''}
                e. **Specs:** <h3>${specTitle}</h3> ${supplementalHtml}
        `;
    }
}

export async function generateListingContent(
  partImageDataUrl: string,
  identifier: string,
  supplementalHtml: string,
  style: ListingStyle = 'professional',
  platform: Platform = 'ebay',
  type: ScanType = 'auto-part',
  options?: ListingOptions
): Promise<{ title: string; description: string }> {
  const imagePart = imageDataUrlToGenerativePart(partImageDataUrl);
  
  let instructions = '';
  let specLabel = 'Product Specs';
  if (type === 'auto-part') specLabel = 'Vehicle Fitment';
  if (type === 'electronics') specLabel = 'Tech Specs';
  
  // Construct Stats HTML
  let statsHtml = '';
  if (type === 'auto-part') {
      if (options?.donorVehicleDetails) statsHtml += `<strong>Donor Vehicle:</strong> ${options.donorVehicleDetails}<br/>`;
      if (options?.donorVin) statsHtml += `<strong>VIN:</strong> ${options.donorVin}<br/>`;
      if (options?.mileage) statsHtml += `<strong>Mileage:</strong> ${options.mileage}<br/>`;
  }
  
  // Handle condition formatting for FB/Craigslist
  let conditionText = options?.condition || 'Used';
  if (type === 'auto-part') conditionText = options?.condition || 'Used OEM';
  if (type === 'electronics') conditionText = options?.condition || 'Used - Working';

  if ((platform === 'facebook' || platform === 'craigslist') && conditionText.includes('Fair')) {
      conditionText += ' (As Is)';
  }

  // ACES/PIES Context Inclusion
  const acesPiesContext = options?.acesPiesData ? `
    **CRITICAL: RAW DATA PROVIDED**
    The user has uploaded raw data (XML/CSV). Prioritize this data over image analysis.
    
    **Raw Data:**
    ${options.acesPiesData}
  ` : '';

  // Allow embedded image for ALL platforms (removing ebay check)
  const hasEmbeddedImage = !!(options?.embeddedImageUrl);

  if (platform === 'facebook') {
    instructions = `
        ${acesPiesContext}
        *   Create a catchy, engaging title for Facebook Marketplace (use 1-2 emojis).
        *   **Description Generation (Facebook - Plain Text):**
        *   Use emojis (🔥, 📦, ✅). No HTML (unless image is embedded, then minimal).
        *   Structure:
            1.  **Header:** Item Name & ID
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** 2-3 short sentences.
            6.  **${specLabel}:** Convert the HTML table below into a text list.
            7.  **Data:** ${supplementalHtml}
            ${type === 'auto-part' && options?.donorVin ? `8. **Donor VIN:** ${options.donorVin}` : ''}
    `;
  } else if (platform === 'craigslist') {
    instructions = `
        ${acesPiesContext}
        *   Create a clear, professional title for Craigslist.
        *   **Description Generation (Craigslist - Plain Text):**
        *   Clean text. No HTML (unless image is embedded).
        *   Structure:
            1.  **Item:** Name & ID ${identifier}
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** Detailed description of the item.
            6.  **${specLabel}:** Convert the HTML table below into a structured text list.
            7.  **Data:** ${supplementalHtml}
            ${type === 'auto-part' && options?.donorVin ? `8. **Donor VIN:** ${options.donorVin}` : ''}
    `;
  } else {
    // eBay (HTML)
    instructions = `
        ${acesPiesContext}
        ${getStyleInstruction(style, identifier, supplementalHtml, type, statsHtml, hasEmbeddedImage)}
        ${type === 'auto-part' && options?.donorVehicleDetails ? `*   **Donor Vehicle Identified:** ${options.donorVehicleDetails}. Use this to ensure title accuracy (Year/Make/Model).` : ''}
        ${type === 'electronics' ? '*   **Electronics Note:** Emphasize that serial numbers are recorded for fraud prevention.' : ''}
    `;
  }

  const prompt = `
    You are an expert copywriter and catalog manager.
    Based on the provided identifier "${identifier}" and the attached image, generate a listing in JSON format.
    
    ${instructions}

    Your response MUST be a single, valid JSON object with two keys: "title" and "description".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
            },
            required: ['title', 'description'],
        },
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("The AI returned an empty response.");
    }
    const result = JSON.parse(jsonText);

    // Smart Image Injection
    if (hasEmbeddedImage && options?.embeddedImageUrl) {
        const imgHtml = `
            <div style="width: 100%; text-align: center; margin-bottom: 25px; padding: 20px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                <img src="${options.embeddedImageUrl}" alt="${result.title}" style="max-width: 100%; height: auto; max-height: 500px; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
            </div>
        `;
        
        if (result.description.includes('{{IMAGE_PLACEHOLDER}}')) {
            result.description = result.description.replace('{{IMAGE_PLACEHOLDER}}', imgHtml);
        } else {
            // Fallback: Prepend if AI missed the marker or specific template didn't use it
            // This handles FB/CL cases where {{IMAGE_PLACEHOLDER}} instruction wasn't sent
            result.description = imgHtml + result.description;
        }
    }

    return result;
  } catch (error) {
    console.error("Error generating listing:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to generate listing because the AI returned an invalid data format. Please try again.");
    }
    throw new Error(`Failed to generate listing. ${error instanceof Error ? error.message : "An unknown AI error occurred."}`);
  }
}
