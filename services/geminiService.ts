
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export async function extractPartNumberFromImage(imageBase64: string): Promise<string> {
  const imagePart = fileToGenerativePart(imageBase64.split(',')[1], 'image/jpeg');
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
    return response.text.trim();
  } catch (error) {
    console.error("Error extracting part number:", error);
    throw new Error("Failed to communicate with AI for part number extraction.");
  }
}

export async function getCompatibilityData(partNumber: string): Promise<string> {
  const prompt = `
    You are an expert on automotive parts and ACES/PIES compatibility data.
    For the given auto part number "${partNumber}", perform a search to find its vehicle compatibility.
    Your response must be ONLY a well-structured HTML table with a header row (<th>). Do not include any other text, explanation, or markdown formatting like \`\`\`.
    The table should have columns for: "Make", "Model", "Year Range", and any relevant "Engine/Trim" details.
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

    return response.text.trim();
  } catch (error) {
    console.error("Error fetching compatibility data:", error);
    throw new Error("Failed to communicate with AI for compatibility data lookup.");
  }
}

export async function generateListingContent(
  partImageBase64: string,
  partNumber: string
): Promise<{ title: string; description: string }> {
  const imagePart = fileToGenerativePart(partImageBase64.split(',')[1], 'image/jpeg');
  const prompt = `
    Based on the provided part number "${partNumber}" and the attached image of a used auto part, generate a complete, professional, and highly detailed eBay Motors listing.
    Your response MUST be a single, valid JSON object with two keys: "title" and "description". Do not include markdown formatting like \`\`\`json around the output.

    **Instructions & Content Requirements:**

    **1. Title Generation:**
    *   Create a concise, SEO-friendly eBay title.
    *   Include: Main part name, Part number "${partNumber}", Brand (e.g., OEM, Motorcraft), and a key vehicle it fits.
    *   Research and include any alternative common names for the part to maximize search visibility.

    **2. Description Generation (HTML Format):**
    *   The entire description must be a single HTML string.
    *   Use headings (e.g., <h3>), paragraphs (<p>), lists (<ul>, <li>), and bold tags (<strong>) for clear, professional formatting.
    *   The description MUST include the following sections in this order:

        a. **"Why Buy From Us?" Section:**
           *   Start with a highlighted, attention-grabbing section.
           *   Use a bulleted list (<ul>) with checkmark emojis (✅).
           *   Include these points: "Tested & Inspected Parts", "Fast & Free Shipping", "30-Day Hassle-Free Returns", "Responsive Customer Service".

        b. **Part Information:**
           *   A brief paragraph describing the part, its function, and common applications based on your research of "${partNumber}".

        c. **Part Number & Specifications:**
           *   Clearly state the primary part number: <strong>${partNumber}</strong>.
           *   Research and list any "Alternative/Interchange Part Numbers" you can find. If none are found, state "N/A".

        d. **Structured Condition Details:**
           *   Analyze the provided image carefully.
           *   Provide an honest and detailed assessment in a bulleted list (<ul>).
           *   The list MUST include these points:
               *   **Cosmetic Condition:** (e.g., "Shows normal signs of wear for a used part. Minor scratches and scuffs are visible but do not affect functionality.")
               *   **Connector Integrity:** (e.g., "All electrical connectors are intact and free of corrosion.")
               *   **Mounting Points:** (e.g., "All mounting tabs and points are solid and undamaged.")
               *   **Overall Assessment:** (e.g., "This is a genuine, fully functional part pulled from a running vehicle.")

        e. **Vehicle Compatibility:**
           *   This is the most critical section. Generate a detailed compatibility list.
           *   Format this as a well-structured HTML table with a header row (<th>).
           *   The table should have columns for: Make, Model, Year Range, and any relevant Engine/Trim details.
           *   Use Google Search to find as much accurate ACES/PIES fitment data as possible.

        f. **Standard Business Policies:**
           *   Include the following pre-written sections verbatim:
             <h3>Shipping Information</h3>
             <p>We offer fast and free shipping within the continental United States. Your item will be carefully packaged and dispatched within one business day of receiving cleared payment. Please note that we do not ship to P.O. Boxes.</p>
             <h3>Return Policy</h3>
             <p>We stand behind our products. We offer a 30-day hassle-free return policy. If you are not satisfied with your purchase, please contact us to initiate a return. The buyer is responsible for return shipping costs unless the item is defective or not as described.</p>

        g. **Disclaimer:**
           *   Include a standard disclaimer:
             <h3>Disclaimer</h3>
             <p>While we strive to provide the most accurate compatibility information, we are not professional mechanics. The compatibility chart is for reference only. It is the buyer's responsibility to verify fitment with their vehicle's VIN before purchase. Please compare the part number and photos to your existing part to ensure a proper match.</p>

    **Example JSON Output Structure:**
    {
      "title": "OEM Ford F-150 Fuel Injector Assembly 9F593 - Fits 2011-2014 5.0L V8",
      "description": "<h3>Why Buy From Us?</h3><ul><li>✅ Tested & Inspected Parts</li></ul><h3>Part Information</h3><p>This is a genuine OEM Ford fuel injector...</p>"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // The response is expected to be a JSON string.
    // However, sometimes the model might wrap it in markdown.
    const jsonText = response.text.trim().replace(/^```json\s*|```$/g, '');
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating eBay listing:", error);
    throw new Error("Failed to communicate with AI for listing generation. The model may have returned an invalid format.");
  }
}