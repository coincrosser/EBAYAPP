import { SavedScan } from "../components/HistorySidebar";

// Static footer content to ensure exported CSVs include the branding and policies
// matching the UI presentation in ResultCard.
const STATIC_FOOTER_HTML = `
<hr style="margin: 2rem 0; border-color: #e5e7eb;" />

<section style="margin-bottom: 1.5rem;">
  <h3>CRITICAL: Buyer Responsibility & Fitment</h3>
  <p>Please verify compatibility before purchasing. While we guarantee the quality of our OEM parts, it is the buyer's sole responsibility to ensure this specific part fits your exact vehicle year, make, model, and trim level. Please cross-reference part numbers, check your vehicle’s VIN, or consult your local dealer to confirm fitment before you commit to buy.</p>
</section>

<section style="margin-bottom: 1.5rem;">
  <h3>Shipping & Return Policy</h3>
  <p><strong>Shipping:</strong> The buyer is responsible for all shipping costs associated with this item.</p>
  <p><strong>Returns:</strong> We stand behind the accuracy of our listings. If you receive an item that is not as described, returns are accepted within 15 days of receipt. Please review all listing photos and descriptions carefully prior to purchase.</p>
</section>

<section style="margin-bottom: 1.5rem;">
  <h3>About ChrisJayden Auto Repair: The Source for Genuine OEM Parts</h3>
  <p>At ChrisJayden Auto Repair, our business is built on hands-on automotive experience. Based physically in Oklahoma City, we specialize in the meticulous process of acquiring salvage vehicles and performing complete quality rebuilds.</p>
  <p>This specialized work gives us unique access to a massive assortment of pristine Original Equipment Manufacturer (OEM) parts that are far too good to go to waste. We harvest the best components—the very kind we trust in our own rebuild projects—and make them available to you. Skip the aftermarket guessing game and choose genuine OEM parts sourced by experienced rebuilders.</p>
</section>
`;

export const downloadEbayCSV = (scans: SavedScan[]) => {
  if (!scans.length) return;

  // eBay Seller Hub Reports (Drafts) Template Headers
  // As provided by the user
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
    if (!descriptionHtml.includes("ChrisJayden Auto Repair")) {
        descriptionHtml += STATIC_FOOTER_HTML;
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