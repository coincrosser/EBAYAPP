import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("VITE_GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card';
export type Platform = 'ebay' | 'facebook' | 'craigslist';
export type ScanType = 'auto-part' | 'general-item';

export interface ListingOptions {
    price?: string;
    location?: string;
    condition?: string;
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

export async function extractIdentifierFromImage(imageDataUrl: string, type: ScanType): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  
  const autoPrompt = `
    Analyze this image of a car part.
    Perform Optical Character Recognition (OCR) to identify and extract ONLY the most prominent part number or serial number.
    Return ONLY the alphanumeric string, with no extra text.
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
    You are an expert on automotive parts and ACES/PIES compatibility data.
    For the given auto part number "${identifier}", perform a search to find its vehicle compatibility.
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes".
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

const getStyleInstruction = (style: ListingStyle, identifier: string, supplementalHtml: string, type: ScanType): string => {
    // Shared instructions
    const commonInstructions = `
        *   Create a concise, SEO-friendly eBay title.
        *   Include: Brand, Model, Key Features, and ID "${identifier}".
    `;

    // Branding text logic is handled in ResultCard now, but we guide the structure here.
    const isAuto = type === 'auto-part';
    const specTitle = isAuto ? "Vehicle Fitment" : "Product Specifications";
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
                        <h3>${specTitle}</h3>
                        ${supplementalHtml}
                    </div>
        `;
    } else {
        // Professional (Default)
        return `
            ${commonInstructions}
            **Description Generation (Professional HTML):**
            *   Standard standard listing format.
            *   Structure:
                a. **Header:** <h2>Title</h2>, <p><strong>ID:</strong> ${identifier}</p>.
                b. **Details:** <h3>Product Details</h3>. Analyze image for condition.
                c. **Specs:** <h3>${specTitle}</h3> ${supplementalHtml}
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

  // Handle condition formatting for FB/Craigslist
  let conditionText = options?.condition || (type === 'auto-part' ? 'Used OEM' : 'Used');
  if ((platform === 'facebook' || platform === 'craigslist') && conditionText === 'Used - Fair') {
      conditionText += ' (As Is)';
  }

  if (platform === 'facebook') {
    instructions = `
        *   Create a catchy, engaging title for Facebook Marketplace (use 1-2 emojis).
        *   **Description Generation (Facebook - Plain Text):**
        *   Use emojis (🔥, 📦, ✅). No HTML.
        *   Structure:
            1.  **Header:** Item Name & ID
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** 2-3 short sentences.
            6.  **${specLabel}:** Convert the HTML table below into a text list.
            7.  **Data:** ${supplementalHtml}
    `;
  } else if (platform === 'craigslist') {
    instructions = `
        *   Create a clear, professional title for Craigslist.
        *   **Description Generation (Craigslist - Plain Text):**
        *   Clean text. No HTML.
        *   Structure:
            1.  **Item:** Name & ID ${identifier}
            2.  **Price:** ${options?.price || '[Enter Price]'}
            3.  **Location:** ${options?.location || '[Enter Location]'}
            4.  **Condition:** ${conditionText}
            5.  **Description:** Detailed description.
            6.  **${specLabel}:** Convert HTML table to text list.
            7.  **Data:** ${supplementalHtml}
    `;
  } else {
    // eBay (HTML)
    instructions = getStyleInstruction(style, identifier, supplementalHtml, type);
  }

  const prompt = `
    You are an expert reseller.
    Based on the provided identifier "${identifier}" and the image of the item.
    Item Type: ${type === 'auto-part' ? 'Automotive Part' : 'General Merchandise (Electronics, Home, etc.)'}.
    
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
        throw new Error("Failed to generate listing due to invalid AI response format. Try again.");
    }
    throw new Error(`Failed to generate listing. ${error instanceof Error ? error.message : "An unknown AI error occurred."}`);
  }
}
