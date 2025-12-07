import { SavedScan } from "../components/HistorySidebar";
import { UserProfile } from "../components/SettingsModal";

// Helper to generate the footer dynamically for the CSV export
// This ensures that bulk uploads to eBay include the user's configured policies and bio.
const getAutoFooterHtml = (p: UserProfile) => `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />
<section style="margin-bottom: 1.5rem;">
  <h3>CRITICAL: Buyer Responsibility & Fitment</h3>
  <p>Please verify compatibility before purchasing. It is the buyer's sole responsibility to ensure this specific part fits your exact vehicle. Please cross-reference part numbers, check your vehicle’s VIN, or consult your local dealer to confirm fitment before you commit to buy.</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> ${p.shippingPolicy}</p>
  <p><strong>Returns:</strong> ${p.returnPolicy}</p>
</section>
<section style="margin-bottom: 1.5rem;">
  <h3>About ${p.businessName}</h3>
  <p>${p.aboutAuto}</p>
</section>
`;

export const downloadEbayCSV = (scans: SavedScan[], userProfile: UserProfile) => {
  if (!scans.length) return;

  // eBay Seller Hub Reports (Drafts) Template Headers
  const infoRows = [
    "#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,",
    "#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html,,,,,,,,,,",
    `"#INFO After you've successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",,,,,,,,,,`,
    "#INFO,,,,,,,,,,"
  ];

  const headerRow = "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description,Format";

  const rows = scans.map(scan => {
    // CSV formatting: wrap in quotes, escape existing quotes with double quotes
    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;

    const action = "Draft";
    const sku = escapeCsv(scan.partNumber);
    const categoryId = ""; // Left blank for user input in eBay
    const title = escapeCsv(scan.title);
    const upc = "";
    const price = ""; // Left blank
    const quantity = "1";
    const photoUrl = ""; // Images are local, cannot be exported to CSV. User must upload in eBay.
    const conditionId = "3000"; // Used

    // Append branding if not present
    let descriptionHtml = scan.description;
    
    // We check if the branding is already there (using the business name)
    // If not, we append the appropriate footer. 
    // Note: History items don't strictly track if they were auto vs general in old versions,
    // so we default to Auto footer for now as it's the safest bet for existing users,
    // unless the description looks very generic.
    if (!descriptionHtml.includes(userProfile.businessName)) {
        descriptionHtml += getAutoFooterHtml(userProfile);
    }
    const description = escapeCsv(descriptionHtml);
    
    const format = "FixedPrice";

    return [
      action,
      sku,
      categoryId,
      title,
      upc,
      price,
      quantity,
      photoUrl,
      conditionId,
      description,
      format
    ].join(",");
  });

  const csvContent = [...infoRows, headerRow, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `rapid_listing_drafts_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};