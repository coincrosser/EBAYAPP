import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ListingStyle = 'professional' | 'minimalist' | 'table-layout' | 'bold-classic' | 'modern-card';

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

export async function extractPartNumberFromImage(imageDataUrl: string): Promise<string> {
  const imagePart = imageDataUrlToGenerativePart(imageDataUrl);
  const prompt = `
    Analyze this image of a car part's serial number.
    Perform Optical Character Recognition (OCR) to identify and extract ONLY the most prominent and likely part number or serial number.
    Return ONLY the alphanumeric string of the part number, with no extra text, labels, or explanation.
    If multiple numbers are visible, return the one that is most clearly a serial/part number.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
    });
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI returned an empty response. Please try a clearer image.");
    }
    return text;
  } catch (error) {
    console.error("Error extracting part number:", error);
    throw new Error(`Failed to extract part number from image. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

export async function getCompatibilityData(partNumber: string): Promise<string> {
  const prompt = `
    You are an expert on automotive parts and ACES/PIES compatibility data.
    For the given auto part number "${partNumber}", perform a search to find its vehicle compatibility.
    Your response must be ONLY a well-structured HTML table with a header row (<th>). 
    Ensure the table is formatted for easy reading and copying into eBay listings.
    Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", "Engine/Trim", and "Notes".
    If you cannot find any compatibility data, return a single HTML paragraph: <p>No compatibility information found for part number ${partNumber}.</p>
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text.trim().replace(/^```html\s*|```$/g, '');
    if (!text) {
        throw new Error("The AI returned an empty response for compatibility data.");
    }
    return text;
  } catch (error) {
    console.error("Error fetching compatibility data:", error);
    throw new Error(`Failed to look up compatibility data. ${error instanceof Error ? error.message : 'An unknown AI error occurred.'}`);
  }
}

const getStyleInstruction = (style: ListingStyle, partNumber: string, compatibilityHtml: string): string => {
    // NOTE: Branding (ChrisJayden Auto Repair) is now handled in ResultCard.tsx to prevent duplication 
    // and ensure consistent formatting in the footer.
    
    const commonInstructions = `
        *   Create a concise, SEO-friendly eBay title.
        *   Include: Year range, Make, Model, Part name, Part number "${partNumber}", and key specifiers (e.g., AT/MT, Engine Size, OEM).
    `;

    if (style === 'minimalist') {
        return `
            ${commonInstructions}

            **Description Generation (Minimalist HTML Format):**
            *   The goal is a clean, mobile-friendly listing with short text and bullet points.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h2>Title</h2> (Same as generated title)
                2.  <h3>Quick Specs</h3>
                    <ul>
                        <li><strong>Part Number:</strong> ${partNumber}</li>
                        <li><strong>Condition:</strong> Used OEM (See Photos)</li>
                    </ul>
                3.  <h3>Vehicle Fitment</h3>
                    ${compatibilityHtml}
        `;
    } else if (style === 'table-layout') {
        return `
            ${commonInstructions}

            **Description Generation (Table Layout HTML Format):**
            *   The goal is a structured, technical look.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h2>Title</h2>
                2.  Create an HTML <table> with styling 'width:100%; border-collapse:collapse; margin-bottom:20px;'.
                    Rows should have a light gray background for headers.
                    Rows:
                    *   <strong>Part Number</strong> | ${partNumber}
                    *   <strong>Condition</strong> | Used OEM
                    *   <strong>Warranty</strong> | See Policy Below
                3.  <h3>Detailed Description</h3>
                    <p>[Analyze image and describe the item in 2-3 sentences]</p>
                    <p><strong>Stock Note:</strong> Item is a genuine OEM part harvested from our rebuild projects.</p>
                4.  <h3>Compatibility</h3>
                    ${compatibilityHtml}
        `;
    } else if (style === 'bold-classic') {
        return `
            ${commonInstructions}

            **Description Generation (Bold Classic HTML Format):**
            *   Use a structured, high-contrast layout with horizontal rules.
            *   Wrap content in an <article> tag.
            *   Structure:
                1.  <h1 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">Title</h1>
                2.  <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 1.2em; font-weight: bold;">Part Number: ${partNumber}</span>
                    </div>
                3.  <hr />
                4.  <h3>Item Description</h3>
                    <p>[Analyze image and describe the item]</p>
                5.  <hr />
                6.  <h3>Vehicle Fitment</h3>
                    ${compatibilityHtml}
        `;
    } else if (style === 'modern-card') {
        return `
            ${commonInstructions}

            **Description Generation (Modern Card HTML Format):**
            *   Create a contained, card-style look.
            *   Wrap content in an <article style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; font-family: sans-serif;">.
            *   Structure:
                1.  <div style="background-color: #f3f4f6; padding: 20px; border-bottom: 1px solid #e5e7eb;">
                        <h2 style="margin: 0; color: #111827;">Title</h2>
                        <p style="margin: 10px 0 0; color: #4b5563;">Part #: <strong>${partNumber}</strong> | Condition: <strong>Used OEM</strong></p>
                    </div>
                2.  <div style="padding: 20px;">
                        <h3 style="color: #374151;">Details</h3>
                        <p>[Analyze image and describe the item]</p>
                        <h3 style="color: #374151; margin-top: 20px;">Fitment Data</h3>
                        ${compatibilityHtml}
                    </div>
        `;
    } else {
        // Professional (Default / LKQ Style)
        return `
            ${commonInstructions}

            **Description Generation (Professional HTML Format):**
            *   The entire description must be a single HTML string.
            *   The root element must be an <article> tag.
            *   Each major part MUST be wrapped in a <section> tag with style="margin-bottom: 1.5rem;".
            *   Structure:
                a. **Header:** <h2>Title</h2>, <p><strong>Part Number:</strong> ${partNumber}</p>.
                b. **Product Details:** <h3>Product Details</h3>. Analyze image for condition. State this is a Genuine OEM part.
                c. **Compatibility:** <h3>Vehicle Compatibility</h3> ${compatibilityHtml}
        `;
    }
};

export async function generateListingContent(
  partImageDataUrl: string,
  partNumber: string,
  compatibilityHtml: string,
  style: ListingStyle = 'professional'
): Promise<{ title: string; description: string }> {
  const imagePart = imageDataUrlToGenerativePart(partImageDataUrl);
  
  const instructions = getStyleInstruction(style, partNumber, compatibilityHtml);

  const prompt = `
    You are an expert copywriter for ChrisJayden Auto Repair, a professional auto parts seller.
    Based on the provided part number "${partNumber}" and the attached image of a used auto part, generate a listing in JSON format.

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
    console.error("Error generating eBay listing:", error);
    if (error instanceof SyntaxError) {
        throw new Error("Failed to generate listing because the AI returned an invalid data format. Please try again.");
    }
    throw new Error(`Failed to generate listing. ${error instanceof Error ? error.message : "An unknown AI error occurred."}`);
  }
}