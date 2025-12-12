import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card' | 'luxury' | 'vintage' | 'handmade' | 'collectible';
export type Platform = 'ebay' | 'facebook' | 'craigslist';
export type ScanType = 'auto-part' | 'general-item';

export interface ListingOptions {
    price?: string;
    location?: string;
    condition?: string;
    donorVin?: string;
    mileage?: string;
    acesPiesData?: string; // Raw XML or CSV content
    donorVehicleDetails?: string; // Decoded VIN details
}

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
      model: 'gemini-2.5-flash',
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

  const generalPrompt = `
    Analyze this image of a product.
    Look specifically for a BARCODE (UPC, EAN), ISBN, or a printed Model Number.
    Perform OCR to read the numbers below the barcode or the text on the label.
    Return ONLY the numeric UPC/EAN code or alphanumeric Model Number.
    If multiple are visible, prefer the UPC (12 digits) or EAN (13 digits).
    Do not add labels like "UPC:" or "Model:". Just return the code.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: type === 'auto-part' ? autoPrompt : generalPrompt }] },
    });
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI returned an empty response. Please try a clearer image of the barcode or part number.");
    }
    return text;
  } catch (error) {
    console.error("Error extracting identifier:", error);
    throw new Error(`Failed to extract data from image. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

export async function getProductData(identifier: string, type: ScanType): Promise<string> {
  const autoPrompt = `
    You are an expert on automotive parts, ACES (Aftermarket Catalog Exchange Standard), and PIES (Product Information Exchange Standard).
    For the given auto part number "${identifier}", perform a search to find its vehicle compatibility (Year, Make, Model, Trim).
    
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes/Attributes".
    If you cannot find any data, return: <p>No compatibility information found for part number ${identifier}.</p>
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

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: type === 'auto-part' ? autoPrompt : generalPrompt,
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
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  const prompt = `
    You are an expert visual search assistant.
    Analyze the provided image ${type === 'auto-part' ? 'of an auto part' : 'of a product'}.
    Use your visual recognition capabilities and Google Search grounding to identify the item.
    
    Return a structured HTML report (do not use Markdown code blocks) with the following sections:
    1. <h3>Visual Identification</h3>
       <ul>
         <li><strong>Identified Item:</strong> [Name/Title]</li>
         <li><strong>Category/Type:</strong> [Classification]</li>
       </ul>
    2. <h3>Market Findings</h3>
       <p>Search online and list 3-5 similar items currently listed on ${type === 'auto-part' ? 'eBay Motors/car-part.com' : 'eBay/Amazon'}. Include approximate price ranges.</p>
    3. ${type === 'auto-part' ? '<h3>Potential Fitment</h3> <p>Based on visual cues (mounting points, shape), list what vehicles this part likely fits.</p>' : '<h3>Key Features</h3> <p>List visible features, materials, or specifications.</p>'}
    
    If you cannot identify it, state that clearly in the HTML.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

const getStyleInstruction = (style: ListingStyle, identifier: string, supplementalHtml: string, type: ScanType, statsHtml: string): string => {
    // Shared instructions
    const commonInstructions = `
        *   Create a concise, SEO-friendly title optimized for search.
        *   Include: Brand, Model, Key Features, and ID "${identifier}".
        *   For Auto Parts: STRICTLY follow the format "Year Make Model PartName Position MPN". Max 80 characters.
    `;

    // Branding text logic is handled in ResultCard now, but we guide the structure here.
    const isAuto = type === 'auto-part';
    const specTitle = isAuto ? "Vehicle Fitment (ACES)" : "Product Specifications";
    const condTitle = isAuto ? "Used OEM" : "Pre-Owned / Used";

    if (style === 'minimalist') {
        return `
            ${commonInstructions}
            **Description Generation (Minimalist HTML):**
            *   Clean, mobile-friendly, bullet points.
            *   Structure:
                1.  <h2>Title</h2>
                2.  <h3>Quick Specs</h3>
                    <ul>
                        <li><strong>ID:</strong> ${identifier}</li>
                        <li><strong>Condition:</strong> ${condTitle} (See Photos)</li>
                        ${statsHtml}
                    </ul>
                3.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'table-layout') {
        return `
            ${commonInstructions}
            **Description Generation (Table Layout HTML):**
            *   Structured, technical look.
            *   Structure:
                1.  <h2>Title</h2>
                2.  HTML Table (width:100%):
                    *   <strong>ID/SKU</strong> | ${identifier}
                    *   <strong>Condition</strong> | ${condTitle}
                3.  <h3>Detailed Description</h3>
                    <p>[Analyze image and describe item]</p>
                    ${statsHtml ? `<h3>Donor Vehicle</h3>${statsHtml}` : ''}
                4.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'bold-classic') {
        return `
            ${commonInstructions}
            **Description Generation (Bold Classic HTML):**
            *   High-contrast, centered, horizontal rules.
            *   Structure:
                1.  <h1 style="text-align: center; border-bottom: 2px solid #000;">Title</h1>
                2.  <div style="text-align: center; font-weight: bold;">ID: ${identifier}</div>
                3.  <hr />
                4.  <h3>Item Description</h3>
                    <p>[Analyze image and describe item]</p>
                    ${statsHtml ? `<div style="background:#eee; padding:10px; margin:10px 0;"><strong>Donor Stats:</strong> ${statsHtml}</div>` : ''}
                5.  <hr />
                6.  <h3>${specTitle}</h3>
                    ${supplementalHtml}
        `;
    } else if (style === 'modern-card') {
        return `
            ${commonInstructions}
            **Description Generation (Modern Card HTML):**
            *   Boxed layout, gray headers.
            *   Structure:
                1.  <div style="background-color: #f3f4f6; padding: 20px;">
                        <h2>Title</h2>
                        <p>ID: <strong>${identifier}</strong> | Condition: <strong>${condTitle}</strong></p>
                    </div>
                2.  <div style="padding: 20px;">
                        <h3>Details</h3>
                        <p>[Analyze image and describe item]</p>
                        ${statsHtml ? `<p><strong>Donor Vehicle:</strong> ${statsHtml}</p>` : ''}
                        <h3>${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else if (style === 'luxury') {
        return `
            ${commonInstructions}
            **Description Generation (Luxury / High-End HTML):**
            *   Tone: Sophisticated, elegant, emphasizing quality and exclusivity. Use serif fonts (Georgia, Times) in style tags.
            *   Structure:
                1.  <div style="font-family: Georgia, serif; color: #1a1a1a; line-height: 1.6;">
                2.  <h2 style="text-align: center; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #D4AF37; padding-bottom: 10px; margin-bottom: 30px;">${identifier}</h2>
                3.  <div style="text-align: center; font-style: italic; margin-bottom: 30px;">"A premium selection for the discerning enthusiast."</div>
                4.  <h3>Exquisite Details</h3>
                    <p>[Analyze image and describe item with high-end vocabulary]</p>
                    ${statsHtml ? `<div style="border: 1px solid #D4AF37; padding: 15px; margin: 20px 0;"><strong>Provenance / Donor:</strong> ${statsHtml}</div>` : ''}
                5.  <h3 style="text-transform: uppercase; letter-spacing: 1px; margin-top: 30px;">Specifications</h3>
                    ${supplementalHtml}
                </div>
        `;
    } else if (style === 'vintage') {
        return `
            ${commonInstructions}
            **Description Generation (Vintage / Retro HTML):**
            *   Tone: Nostalgic, emphasizing history, era, and authenticity.
            *   Structure:
                1.  <div style="font-family: 'Courier New', monospace; background-color: #fdfbf7; padding: 20px; border: 2px solid #5c4033; color: #3e2723;">
                2.  <h2 style="text-align: center; text-decoration: underline; color: #5c4033;">VINTAGE FIND: ${identifier}</h2>
                3.  <h3>Item History & Condition</h3>
                    <p>[Describe item focusing on age, patina, and era-specific details]</p>
                    ${statsHtml ? `<p><strong>Origin:</strong> ${statsHtml}</p>` : ''}
                4.  <hr style="border-top: 1px dashed #5c4033;" />
                5.  <h3>Technical Manifest</h3>
                    ${supplementalHtml}
                </div>
        `;
    } else if (style === 'handmade') {
        return `
            ${commonInstructions}
            **Description Generation (Handmade / Artisan HTML):**
            *   Tone: Warm, personal, emphasizing craftsmanship and uniqueness.
            *   Structure:
                1.  <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #4a5568;">
                2.  <h2 style="color: #2c7a7b; font-weight: 300; text-align: center;">${identifier}</h2>
                3.  <h3 style="color: #2d3748;">The Story</h3>
                    <p>[Describe the item with a focus on materials, texture, and the maker's touch]</p>
                4.  <div style="background-color: #e6fffa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #319795;">
                    <strong>Why it's special:</strong> [Highlight unique features or imperfections that prove it's handmade]
                </div>
                5.  <h3 style="color: #2d3748;">Details</h3>
                    ${supplementalHtml}
                </div>
        `;
    } else if (style === 'collectible') {
        return `
            ${commonInstructions}
            **Description Generation (Collectible / Investment Grade HTML):**
            *   Tone: Professional, clinical, precise, focused on grading and condition.
            *   Structure:
                1.  <div style="border: 4px double #000; padding: 20px;">
                2.  <h2 style="text-align: center; background: #000; color: #fff; padding: 5px; font-family: sans-serif;">COLLECTOR'S GRADE: ${identifier}</h2>
                3.  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding: 10px 0; margin-bottom: 20px; font-family: monospace;">
                        <span><strong>Condition Grade:</strong> [Assess Condition (e.g. Near Mint, Good)]</span>
                        <span><strong>Authenticity:</strong> Verified</span>
                    </div>
                4.  <h3>Condition Report</h3>
                    <p>[Detailed analysis of flaws, wear, or pristine nature. Be extremely specific.]</p>
                5.  <h3>Item Specifics</h3>
                    ${supplementalHtml}
                </div>
        `;
    } else {
        // Professional (Default)
        return `
            ${commonInstructions}
            **Description Generation (Professional HTML):**
            *   Standard professional listing format.
            *   Structure:
                a. **Header:** <h2>Title</h2>, <p><strong>ID:</strong> ${identifier}</p>.
                b. **Product Details:** <h3>Product Details</h3>. Analyze image for condition.
                ${statsHtml ? `c. **Donor Stats:** <h3>Donor Vehicle Information</h3> <p>${statsHtml}</p>` : ''}
                d. **Specs:** <h3>${specTitle}</h3> ${supplementalHtml}
        `;
    }
};

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
  const specLabel = type === 'auto-part' ? 'Vehicle Fitment' : 'Product Specs';
  
  // Construct Donor Stats HTML if available
  let statsHtml = '';
  if (type === 'auto-part') {
      if (options?.donorVehicleDetails) statsHtml += `<strong>Donor Vehicle:</strong> ${options.donorVehicleDetails}<br/>`;
      if (options?.donorVin) statsHtml += `<strong>VIN:</strong> ${options.donorVin}<br/>`;
      if (options?.mileage) statsHtml += `<strong>Mileage:</strong> ${options.mileage}<br/>`;
  }

  // Handle condition formatting for FB/Craigslist
  let conditionText = options?.condition || (type === 'auto-part' ? 'Used OEM' : 'Used');
  if ((platform === 'facebook' || platform === 'craigslist') && conditionText === 'Used - Fair') {
      conditionText += ' (As Is)';
  }

  // ACES/PIES Context Inclusion with ENHANCED PARSING LOGIC
  const acesPiesContext = options?.acesPiesData ? `
    **CRITICAL: RAW ACES/PIES DATA PROVIDED**
    The user has uploaded raw Auto Care Association standard data (ACES XML or PIES XML/JSON/CSV).
    This data is the SOURCE OF TRUTH. You MUST prioritize parsing this data over the image analysis or general knowledge for the description.

    1. **ACES (Vehicle Fitment - XML):** 
       - Look for <App> nodes (e.g., <App action="A" id="...">).
       - Extract <BaseVehicle> (YearID, MakeID, ModelID). If these are IDs, infer the Vehicle Name if possible, or output the ID clearly.
       - Extract Qualifiers: <EngineBase>, <BodyType>, <DriveType>, <Note>, <Qty>.
       - Construct a "Vehicle Compatibility" HTML table using this exact data.
       - IGNORE any visual cues if they contradict this data.
    
    2. **PIES (Product Attributes - XML/JSON/CSV):**
       - **XML:** Look for <Item> or <Part> nodes. 
         - **Identification:** <PartNumber>, <BrandAAIAID> (Brand Code), <BrandLabel>.
         - **Descriptions:** Look for <Descriptions> nodes. Use "Marketing" or "Extended" descriptions for the body, "Invoice" for the title.
         - **Details:** <Dimensions>, <Weight>, <Packages>, <HazardousMaterialCode>.
       - **JSON:** Look for keys like "PartNumber", "BrandAAIAID", "Descriptions", "DigitalAssets".
       - **CSV:** Look for headers like "PartNumber", "BrandAAIAID", "Description".
       - **Action:** Extract specific values to populate the "Item Specifics" section and description.
         - Map <HazardousMaterialCode> -> "Restricted" item specific.
         - Map <MinimumOrderQuantity> -> "Lot Size".
    
    **Raw Data:**
    ${options.acesPiesData}
  ` : '';

  if (platform === 'facebook') {
    instructions = `
        ${acesPiesContext}
        *   Create a catchy, engaging title for Facebook Marketplace (use 1-2 emojis).
        *   **Description Generation (Facebook - Plain Text):**
        *   Use emojis (🔥, 📦, ✅). No HTML.
        *   Structure:
            1.  **Header:** Item Name & ID
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** 2-3 short sentences.
            6.  **${specLabel}:** Convert the HTML table below (or ACES data if provided) into a text list.
            7.  **Data:** ${supplementalHtml}
            ${type === 'auto-part' && options?.donorVin ? `8. **Donor VIN:** ${options.donorVin}` : ''}
    `;
  } else if (platform === 'craigslist') {
    instructions = `
        ${acesPiesContext}
        *   Create a clear, professional title for Craigslist.
        *   **Description Generation (Craigslist - Plain Text):**
        *   Clean text. No HTML.
        *   Structure:
            1.  **Item:** Name & ID ${identifier}
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** Detailed description of the item.
            6.  **${specLabel}:** Convert the HTML table below (or ACES data if provided) into a structured text list.
            7.  **Data:** ${supplementalHtml}
            ${type === 'auto-part' && options?.donorVin ? `8. **Donor VIN:** ${options.donorVin}` : ''}
    `;
  } else {
    // eBay (HTML)
    instructions = `
        ${acesPiesContext}
        ${getStyleInstruction(style, identifier, supplementalHtml, type, statsHtml)}
        ${type === 'auto-part' && options?.donorVehicleDetails ? `*   **Donor Vehicle Identified:** ${options.donorVehicleDetails}. Use this to ensure title accuracy (Year/Make/Model).` : ''}
    `;
  }

  const prompt = `
    You are an expert copywriter and automotive catalog manager (ACES/PIES specialist).
    Based on the provided identifier "${identifier}" and the attached image, generate a listing in JSON format.
    
    ${instructions}

    Your response MUST be a single, valid JSON object with two keys: "title" and "description".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating listing:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to generate listing because the AI returned an invalid data format. Please try again.");
    }
    throw new Error(`Failed to generate listing. ${error instanceof Error ? error.message : "An unknown AI error occurred."}`);
  }
}