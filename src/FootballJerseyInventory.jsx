import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Upload,
  Plus,
  Trash2,
  Download,
  Shirt,
  Image as ImageIcon,
  Lock,
  RotateCcw,
} from "lucide-react";

const STORAGE_KEY = "football_jersey_inventory_v5";
const DB_NAME = "football_jersey_inventory_images_db";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

const BASE_SIZES = ["XXL", "XL", "L", "M", "S", "152", "146", "140", "134"];
const MESSI_EXTRA_SIZES = ["128", "122"];
const FIXED_QUALITY = "Player version";
const CSV_NEWLINE = "\n";
const UTF8_BOM = "\uFEFF";
const APP_BASE_URL = import.meta.env.BASE_URL || "./";
const PIE_COLORS = [
  "#0f172a",
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#be123c",
];
const SIZE_COLORS = {
  XXL: { bg: "#ffedd5", border: "#fdba74", text: "#7c2d12", accent: "#ea580c" },
  XL: { bg: "#fae8ff", border: "#e879f9", text: "#701a75", accent: "#c026d3" },
  L: { bg: "#fee2e2", border: "#fca5a5", text: "#7f1d1d", accent: "#dc2626" },
  M: { bg: "#dbeafe", border: "#93c5fd", text: "#1e3a8a", accent: "#2563eb" },
  S: { bg: "#dcfce7", border: "#86efac", text: "#14532d", accent: "#16a34a" },
  152: { bg: "#fef3c7", border: "#fcd34d", text: "#78350f", accent: "#d97706" },
  146: { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95", accent: "#7c3aed" },
  140: { bg: "#cffafe", border: "#67e8f9", text: "#164e63", accent: "#0891b2" },
  134: { bg: "#fce7f3", border: "#f9a8d4", text: "#831843", accent: "#db2777" },
  128: { bg: "#e0e7ff", border: "#a5b4fc", text: "#312e81", accent: "#4f46e5" },
  122: { bg: "#ecfccb", border: "#bef264", text: "#365314", accent: "#65a30d" },
};
const DEFAULT_SIZE_COLORS = { bg: "#f1f5f9", border: "#cbd5e1", text: "#0f172a", accent: "#475569" };
const PERMANENT_PHOTO_CATALOG = [
  {
    id: "messi-argentina",
    playerMatch: "messi",
    teamMatch: "argentina",
    imageName: "messi-argentina.png",
    imagePath: "jerseys/messi-argentina.png",
  },
];

function getBundledAssetPath(assetPath) {
  const base = APP_BASE_URL.endsWith("/") ? APP_BASE_URL : `${APP_BASE_URL}/`;
  return `${base}${String(assetPath || "").replace(/^\/+/, "")}`;
}

function getPermanentCatalogEntry(product = {}) {
  const player = String(product.player || "").trim().toLowerCase();
  const team = String(product.team || "").trim().toLowerCase();
  const imageName = String(product.imageName || "").trim().toLowerCase();

  return (
    PERMANENT_PHOTO_CATALOG.find(
      (entry) =>
        imageName === entry.imageName ||
        (player.includes(entry.playerMatch) && team.includes(entry.teamMatch))
    ) || null
  );
}

function getPermanentCatalogId(product = {}) {
  return getPermanentCatalogEntry(product)?.id || "";
}

function getBundledProductImage(product = {}) {
  const catalogEntry = getPermanentCatalogEntry(product);
  return catalogEntry ? getBundledAssetPath(catalogEntry.imagePath) : "";
}

function getBundledProductImageName(product = {}) {
  return getPermanentCatalogEntry(product)?.imageName || "";
}

function getSizesForPlayer(playerName = "") {
  const player = String(playerName).toLowerCase();
  return player.includes("messi") ? [...BASE_SIZES, ...MESSI_EXTRA_SIZES] : BASE_SIZES;
}

function getSizeColors(size) {
  return SIZE_COLORS[String(size)] || DEFAULT_SIZE_COLORS;
}

function getSizeStyleVars(size) {
  const colors = getSizeColors(size);

  return {
    "--size-bg": colors.bg,
    "--size-border": colors.border,
    "--size-text": colors.text,
    "--size-accent": colors.accent,
  };
}

function buildSizeStyleAttribute(size) {
  const colors = getSizeColors(size);
  return `style="--size-bg: ${colors.bg}; --size-border: ${colors.border}; --size-text: ${colors.text}; --size-accent: ${colors.accent};"`;
}

function buildReportHeaderCell(header) {
  const colors = SIZE_COLORS[String(header)];
  if (!colors) return `<th>${escapeHTML(header)}</th>`;
  return `<th class="size-heading" style="background: ${colors.accent}; color: white;">${escapeHTML(header)}</th>`;
}

function buildReportSizeCell(size, value) {
  const colors = getSizeColors(size);
  const quantity = Number(value || 0);
  const cellContent =
    quantity > 0
      ? `<span class="download-number-circle">${escapeHTML(quantity)}</span>`
      : "";
  return `<td class="number size-data" style="background: ${colors.bg}; border-color: ${colors.border}; color: ${colors.text};">${cellContent}</td>`;
}

function buildReportSizeBadge(size, value) {
  return `
    <span class="download-size-badge" ${buildSizeStyleAttribute(size)}>
      <span class="download-size-label">${escapeHTML(size)}</span>
      <span class="download-number-circle">${escapeHTML(value)}</span>
    </span>`;
}

function makeId() {
  return `jersey-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function blankStock(sizes = BASE_SIZES) {
  return sizes.reduce((acc, size) => {
    acc[size] = 0;
    return acc;
  }, {});
}

function normalizeStock(stock, sizes = BASE_SIZES) {
  const safeStock = blankStock(sizes);

  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    sizes.forEach((size) => {
      const quantity = Number(stock[size]);
      safeStock[size] = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
    });
  }

  return safeStock;
}

function getStockTotal(stock, sizes = BASE_SIZES) {
  const safeStock = normalizeStock(stock, sizes);
  return sizes.reduce((sum, size) => sum + Number(safeStock[size] || 0), 0);
}

function normalizeProduct(product = {}) {
  const player = product.player || "Unknown Player";
  const sizes = getSizesForPlayer(player);
  const bundledImagePreview = getBundledProductImage({ ...product, player });
  const bundledImageName = getBundledProductImageName({ ...product, player });

  return {
    id: product.id || makeId(),
    player,
    team: product.team || "Unknown Team",
    quality: FIXED_QUALITY,
    imagePreview: product.imagePreview || product.image || bundledImagePreview,
    imageName: product.imageName || bundledImageName,
    hasStoredImage: Boolean(
      product.hasStoredImage || product.imageName || product.imagePreview || product.image || bundledImagePreview
    ),
    stock: normalizeStock(product.stock, sizes),
  };
}

function productForStorage(product) {
  const safeProduct = normalizeProduct(product);

  return {
    id: safeProduct.id,
    player: safeProduct.player,
    team: safeProduct.team,
    quality: FIXED_QUALITY,
    imageName: safeProduct.imageName,
    hasStoredImage: safeProduct.hasStoredImage,
    stock: safeProduct.stock,
  };
}

function createNewProductFromForm(formProduct) {
  const player = formProduct.player.trim() || "New Player";
  const team = formProduct.team.trim() || "New Team";

  return normalizeProduct({
    id: makeId(),
    player,
    team,
    quality: FIXED_QUALITY,
    imagePreview: "",
    imageName: "",
    hasStoredImage: false,
    stock: blankStock(getSizesForPlayer(player)),
  });
}

function resetProductQuantities(product) {
  const safeProduct = normalizeProduct(product);
  return {
    ...safeProduct,
    stock: blankStock(getSizesForPlayer(safeProduct.player)),
  };
}

function isPermanentPhotoProduct(product) {
  const safeProduct = normalizeProduct(product);
  return Boolean(safeProduct.imagePreview || safeProduct.hasStoredImage);
}

function productKey(product) {
  const safeProduct = normalizeProduct(product);
  return `${safeProduct.player.trim().toLowerCase()}-${safeProduct.team.trim().toLowerCase()}`;
}

function productsMatchIdentity(a, b) {
  const permanentCatalogA = getPermanentCatalogId(a);
  const permanentCatalogB = getPermanentCatalogId(b);

  if (permanentCatalogA && permanentCatalogA === permanentCatalogB) return true;
  return productKey(a) === productKey(b);
}

function getProductSortRank(product) {
  const player = normalizeProduct(product).player.trim().toLowerCase();

  if (player.includes("lamine yamal")) return 1;
  if (player.includes("messi")) return 2;
  if (player.includes("ronaldo")) return 3;
  return 4;
}

function sortProductsByPriority(products) {
  return products
    .map((product, index) => ({ product: normalizeProduct(product), index }))
    .sort((a, b) => {
      const rankDifference = getProductSortRank(a.product) - getProductSortRank(b.product);
      return rankDifference || a.index - b.index;
    })
    .map(({ product }) => product);
}

const starterProducts = [
  normalizeProduct({
    id: "permanent-messi-argentina",
    player: "Messi",
    team: "Argentina",
    stock: { L: 0, M: 0, S: 0, 152: 0, 146: 0, 140: 0, 134: 0, 128: 0, 122: 0 },
  }),
];

function mergeMissingStarterProducts(savedProducts) {
  const safeSavedProducts = savedProducts.map(normalizeProduct);
  const missingStarterProducts = starterProducts.filter(
    (product) => !safeSavedProducts.some((savedProduct) => productsMatchIdentity(savedProduct, product))
  );

  return sortProductsByPriority([...missingStarterProducts, ...safeSavedProducts]);
}

function loadProducts() {
  if (typeof window === "undefined") return sortProductsByPriority(starterProducts);

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return mergeMissingStarterProducts([]);

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return mergeMissingStarterProducts([]);

    return mergeMissingStarterProducts(parsed);
  } catch {
    return mergeMissingStarterProducts([]);
  }
}

function saveProducts(products) {
  if (typeof window === "undefined") return;

  try {
    const lightweightProducts = products.map(productForStorage);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightProducts));
  } catch (error) {
    console.warn("Inventory could not be saved locally:", error);
  }
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
    };
  });
}

async function saveImageToDatabase(productId, imageDataUrl) {
  try {
    const db = await openImageDatabase();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);
      store.put({ id: productId, imageDataUrl, savedAt: new Date().toISOString() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    db.close();
  } catch (error) {
    console.warn("Image could not be saved in browser storage:", error);
  }
}

async function getImageFromDatabase(productId) {
  try {
    const db = await openImageDatabase();

    const imageRecord = await new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, "readonly");
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.get(productId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return imageRecord?.imageDataUrl || "";
  } catch (error) {
    console.warn("Image could not be loaded from browser storage:", error);
    return "";
  }
}

async function deleteImageFromDatabase(productId) {
  try {
    const db = await openImageDatabase();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);
      store.delete(productId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    db.close();
  } catch (error) {
    console.warn("Image could not be deleted from browser storage:", error);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(imageUrl) {
  if (!imageUrl || String(imageUrl).startsWith("data:")) return imageUrl || "";

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return imageUrl;
    return await blobToDataUrl(await response.blob());
  } catch (error) {
    console.warn("Bundled photo could not be embedded in the report:", error);
    return imageUrl;
  }
}

async function getProductPhotoDataUrl(product) {
  const safeProduct = normalizeProduct(product);

  if (safeProduct.imagePreview?.startsWith("data:")) return safeProduct.imagePreview;

  const storedImage = safeProduct.hasStoredImage ? await getImageFromDatabase(safeProduct.id) : "";
  if (storedImage) return storedImage;

  return safeProduct.imagePreview ? fetchImageAsDataUrl(safeProduct.imagePreview) : "";
}

function escapeCSVCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildCSV(rows) {
  return `${UTF8_BOM}${rows.map((row) => row.map(escapeCSVCell).join(",")).join(CSV_NEWLINE)}`;
}

function getReportSizesForProducts(products) {
  const safeProducts = sortProductsByPriority(products);
  const reportSizes = new Set();

  safeProducts.forEach((item) => {
    const safeItem = normalizeProduct(item);
    const productSizes = getSizesForPlayer(safeItem.player);
    const safeStock = normalizeStock(safeItem.stock, productSizes);

    productSizes.forEach((size) => {
      if (Number(safeStock[size] || 0) > 0) {
        reportSizes.add(size);
      }
    });
  });

  return Array.from(reportSizes);
}

function downloadText(filename, text, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSummaryRows(products, imageDataById = new Map()) {
  const safeProducts = sortProductsByPriority(products);
  const allSizes = getReportSizesForProducts(safeProducts);
  const rows = [["Player", "Photo Data URL", ...allSizes]];

  safeProducts.forEach((item) => {
    const safeItem = normalizeProduct(item);
    const productSizes = getSizesForPlayer(safeItem.player);
    const safeStock = normalizeStock(safeItem.stock, productSizes);
    const photoDataUrl = safeItem.imagePreview || imageDataById.get(safeItem.id) || "";

    rows.push([
      safeItem.player,
      photoDataUrl,
      ...allSizes.map((size) => (Number(safeStock[size] || 0) > 0 ? safeStock[size] : "")),
    ]);
  });

  return rows;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) return null;

  return {
    mimeType: match[1] || "image/png",
    isBase64: Boolean(match[2]),
    data: match[3] || "",
  };
}

function getImageExtension(mimeType = "") {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "png";
}

function buildPhotoSpreadsheetMHTML(products, imageDataById = new Map()) {
  const safeProducts = sortProductsByPriority(products);
  const headers = ["Photo", "Player", "Sizes"];
  const headerCells = headers.map(buildReportHeaderCell).join("");
  const workbookBoundary = `----=_JerseyInventoryWorkbook_${Date.now()}`;
  const boundaryMarker = `--${workbookBoundary}`;
  const imageParts = [];

  const bodyRows = safeProducts
    .map((item, index) => {
      const safeItem = normalizeProduct(item);
      const productSizes = getSizesForPlayer(safeItem.player);
      const safeStock = normalizeStock(safeItem.stock, productSizes);
      const photoDataUrl = safeItem.imagePreview || imageDataById.get(safeItem.id) || "";
      const sizeBadges =
        productSizes
          .filter((size) => Number(safeStock[size] || 0) > 0)
          .map((size) => buildReportSizeBadge(size, safeStock[size]))
          .join("") || `<span class="no-photo">No sizes with stock</span>`;
      const parsedPhoto = parseDataUrl(photoDataUrl);
      let photoCell = `<span class="no-photo">No photo</span>`;

      if (parsedPhoto) {
        const contentId = `photo-${index}@football-jersey-inventory`;
        const extension = getImageExtension(parsedPhoto.mimeType);
        const imageData = parsedPhoto.isBase64 ? parsedPhoto.data : btoa(decodeURIComponent(parsedPhoto.data));
        imageParts.push({
          contentId,
          extension,
          mimeType: parsedPhoto.mimeType,
          data: imageData,
        });
        photoCell = `<img src="cid:${contentId}" alt="${escapeHTML(safeItem.player)} ${escapeHTML(safeItem.team)}" />`;
      }

      return `
        <tr>
          <td class="photo-cell">${photoCell}</td>
          <td class="player-cell">${escapeHTML(safeItem.player)}</td>
          <td class="size-list-cell">${sizeBadges}</td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Inventory</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #0f172a; color: white; font-size: 16px; padding: 10px; text-align: left; }
    td { border: 1px solid #cbd5e1; font-size: 15px; font-weight: 700; padding: 10px; vertical-align: middle; }
    .photo-cell { width: 150px; height: 150px; text-align: center; }
    img { width: 130px; height: 130px; object-fit: cover; display: block; margin: 0 auto; }
    .number { text-align: center; font-size: 18px; font-weight: 900; }
    .size-heading { text-align: center; border-left: 4px solid rgba(255, 255, 255, 0.75); }
    .size-data { border: 2px solid; min-width: 98px; }
    .download-number-circle { display: inline-block; width: 76px; height: 76px; border: 6px solid currentColor; border-radius: 999px; background: rgba(255, 255, 255, 0.86); font-size: 42px; font-weight: 900; line-height: 64px; text-align: center; }
    .size-list-cell { min-width: 420px; }
    .download-size-badge { display: inline-grid; grid-template-columns: auto auto; align-items: center; gap: 12px; margin: 6px; padding: 10px 14px; background: var(--size-bg); border: 3px solid var(--size-border); border-left: 10px solid var(--size-accent); border-radius: 999px; color: var(--size-text); }
    .download-size-label { font-size: 28px; font-weight: 900; }
    .download-size-badge .download-number-circle { border-color: var(--size-accent); color: var(--size-text); }
    .no-photo { color: #64748b; font-weight: 900; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const imageSections = imageParts
    .map(
      (image) => `${boundaryMarker}
Content-Type: ${image.mimeType}
Content-Transfer-Encoding: base64
Content-ID: <${image.contentId}>
Content-Location: ${image.contentId}.${image.extension}

${image.data}`
    )
    .join("\n");

  return `MIME-Version: 1.0
Content-Type: multipart/related; boundary="${workbookBoundary}"

${boundaryMarker}
Content-Type: text/html; charset="utf-8"
Content-Location: football-jersey-inventory.htm

${html}
${imageSections ? `\n${imageSections}` : ""}
${boundaryMarker}--`;
}

function buildPhotoTableReportHTML(products, imageDataById = new Map()) {
  const safeProducts = sortProductsByPriority(products);
  const headers = ["Photo", "Player", "Sizes"];
  const headerCells = headers.map(buildReportHeaderCell).join("");

  const reportProducts = safeProducts.filter((item) => {
    const safeItem = normalizeProduct(item);
    const productSizes = getSizesForPlayer(safeItem.player);
    return getStockTotal(safeItem.stock, productSizes) > 0;
  });

  const bodyRows = reportProducts
    .map((item) => {
      const safeItem = normalizeProduct(item);
      const productSizes = getSizesForPlayer(safeItem.player);
      const safeStock = normalizeStock(safeItem.stock, productSizes);
      const photoDataUrl = safeItem.imagePreview || imageDataById.get(safeItem.id) || "";
      const sizeBadges =
        productSizes
          .filter((size) => Number(safeStock[size] || 0) > 0)
          .map((size) => buildReportSizeBadge(size, safeStock[size]))
          .join("") || `<span class="no-photo">No sizes with stock</span>`;
      const photoCell = photoDataUrl
        ? `<img src="${escapeHTML(photoDataUrl)}" alt="${escapeHTML(safeItem.player)} ${escapeHTML(safeItem.team)}" />`
        : `<span class="no-photo">No photo</span>`;

      return `
        <tr>
          <td class="photo-cell">${photoCell}</td>
          <td class="player-cell">${escapeHTML(safeItem.player)}</td>
          <td class="size-list-cell">${sizeBadges}</td>
        </tr>`;
    })
    .join("");
  const tableBody =
    bodyRows ||
    `<tr><td class="empty-report" colspan="3">No jerseys with stock to show.</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Football Jersey Inventory Photo Table</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0 30px 30px; font-family: Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
    h1 { margin: 0 0 28px; font-size: 72px; font-weight: 900; letter-spacing: 0; line-height: 1.08; }
    .wrap { overflow-x: auto; background: white; border-radius: 28px 28px 0 0; box-shadow: 0 1px 0 rgba(15, 23, 42, 0.08); }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; min-width: 1500px; }
    col.photo-col { width: 260px; }
    col.player-col { width: 440px; }
    col.sizes-col { width: auto; }
    thead tr { background: #0f172a; }
    th { background: #0f172a; color: white; font-size: 28px; font-weight: 900; padding: 22px 22px; text-align: left; }
    th:first-child { border-top-left-radius: 28px; }
    th:last-child { border-top-right-radius: 28px; }
    td { border-bottom: 2px solid #e2e8f0; font-size: 24px; font-weight: 800; min-height: 250px; padding: 22px; vertical-align: middle; }
    tbody tr { background: white; min-height: 250px; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .photo-cell { height: 250px; text-align: center; }
    .player-cell { color: #0f172a; font-size: 28px; font-weight: 900; }
    img { width: 218px; height: 218px; object-fit: cover; display: block; margin: 0 auto; border-radius: 16px; background: white; }
    .number { text-align: center; font-weight: 900; }
    .size-list-cell { min-width: 760px; }
    .download-size-badge { display: inline-flex; align-items: center; justify-content: space-between; gap: 24px; min-width: 250px; min-height: 150px; margin: 18px 14px; padding: 20px 24px 20px 32px; background: var(--size-bg); border: 5px solid var(--size-border); border-left: 18px solid var(--size-accent); border-radius: 999px; color: var(--size-text); }
    .download-size-label { font-size: 44px; font-weight: 900; line-height: 1; }
    .download-number-circle { align-items: center; background: rgba(255, 255, 255, 0.92); border: 8px solid var(--size-accent); border-radius: 999px; color: var(--size-text); display: inline-flex; font-size: 60px; font-weight: 900; height: 108px; justify-content: center; line-height: 1; min-width: 108px; padding: 0 16px; text-align: center; }
    .no-photo { color: #64748b; font-size: 28px; font-weight: 900; }
    .empty-report { color: #64748b; font-size: 36px; font-weight: 900; height: 220px; text-align: center; }
    @media (max-width: 1100px) {
      body { padding: 0 18px 24px; }
      h1 { font-size: 48px; margin-bottom: 22px; }
      table { min-width: 980px; }
      col.photo-col { width: 220px; }
      col.player-col { width: 320px; }
      th { font-size: 24px; padding: 18px; }
      td { font-size: 22px; padding: 18px; }
      .photo-cell { height: 220px; }
      img { width: 180px; height: 180px; }
      .download-size-badge { min-width: 210px; min-height: 126px; margin: 12px 10px; padding: 16px 20px 16px 26px; }
      .download-size-label { font-size: 38px; }
      .download-number-circle { font-size: 52px; height: 92px; min-width: 92px; }
    }
    @media (max-width: 760px) {
      body { padding: 12px; }
      h1 { font-size: 36px; line-height: 1.08; margin-bottom: 16px; }
      .wrap { overflow: visible; border-radius: 18px; background: transparent; }
      table, tbody, tr, td { display: block; width: 100%; }
      table { min-width: 0; table-layout: auto; }
      colgroup, thead { display: none; }
      tbody tr { background: white; border: 2px solid #e2e8f0; border-radius: 18px; margin-bottom: 16px; min-height: 0; overflow: hidden; }
      tbody tr:nth-child(even) { background: white; }
      td { border-bottom: 1px solid #e2e8f0; min-height: 0; padding: 16px; }
      td:last-child { border-bottom: 0; }
      .photo-cell { background: #f8fafc; height: auto; padding: 18px; }
      img { width: 180px; height: 180px; }
      .player-cell { font-size: 26px; }
      .player-cell::before, .size-list-cell::before {
        color: #64748b;
        display: block;
        font-size: 14px;
        font-weight: 900;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .player-cell::before { content: "Player"; }
      .size-list-cell { min-width: 0; }
      .size-list-cell::before { content: "Sizes"; }
      .download-size-badge { display: flex; gap: 14px; margin: 8px 0; min-height: 108px; min-width: 0; padding: 14px 18px 14px 22px; width: 100%; border-left-width: 12px; }
      .download-size-label { font-size: 34px; }
      .download-number-circle { border-width: 6px; font-size: 46px; height: 82px; min-width: 82px; }
      .no-photo { display: block; font-size: 22px; padding: 24px 0; text-align: center; }
      .empty-report { height: auto; font-size: 24px; padding: 40px 18px; }
    }
    @media print {
      body { background: white; padding: 0 12px 12px; }
      .wrap { box-shadow: none; border-radius: 0; }
      th:first-child, th:last-child { border-radius: 0; }
    }
  </style>
</head>
<body>
  <h1>Football Jersey Inventory Photo Table</h1>
  <div class="wrap">
    <table>
      <colgroup>
        <col class="photo-col" />
        <col class="player-col" />
        <col class="sizes-col" />
      </colgroup>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${tableBody}</tbody>
    </table>
  </div>
</body>
</html>`;
}

function buildPieChartData(reportProducts) {
  let runningPercentage = 0;

  const positiveItems = reportProducts
    .map((item) => {
      const safeItem = normalizeProduct(item);
      const productSizes = getSizesForPlayer(safeItem.player);
      const explicitTotal = Number(item.totalForJersey);
      const value = Number.isFinite(explicitTotal)
        ? explicitTotal
        : getStockTotal(safeItem.stock, productSizes);

      return {
        label: `${safeItem.player} - ${safeItem.team}`,
        value: Math.max(0, value),
      };
    })
    .filter((item) => item.value > 0);

  const total = positiveItems.reduce((sum, item) => sum + item.value, 0);

  return positiveItems.map((item, index) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const start = runningPercentage;
    runningPercentage += percentage;

    return {
      ...item,
      percentage,
      start,
      color: PIE_COLORS[index % PIE_COLORS.length],
    };
  });
}

function buildPieChartHTML(pieData, totalStock) {
  if (!pieData.length || totalStock <= 0) {
    return `
      <section class="chart-section">
        <div class="chart-empty">
          <div class="chart-empty-title">Animated Pie Chart</div>
          <p>Add quantities to your jerseys to see stock share in the pie chart.</p>
        </div>
      </section>`;
  }

  const segments = pieData
    .map(
      (item, index) => `
        <circle
          class="pie-segment"
          cx="100"
          cy="100"
          r="70"
          fill="transparent"
          stroke="${item.color}"
          stroke-width="40"
          pathLength="100"
          stroke-dasharray="${item.percentage} ${100 - item.percentage}"
          stroke-dashoffset="${-item.start}"
          transform="rotate(-90 100 100)"
          style="animation-delay: ${index * 0.12}s"
        />`
    )
    .join("");

  const legend = pieData
    .map(
      (item) => `
        <div class="legend-row">
          <span class="legend-dot" style="background: ${item.color}"></span>
          <span class="legend-label">${escapeHTML(item.label)}</span>
          <strong class="legend-value">${escapeHTML(item.value)} (${escapeHTML(item.percentage.toFixed(1))}%)</strong>
        </div>`
    )
    .join("");

  return `
    <section class="chart-section">
      <div class="chart-title-row">
        <div>
          <h2>Animated Stock Pie Chart</h2>
          <p>Each slice shows how much stock each jersey has compared with the full inventory.</p>
        </div>
        <div class="chart-total-pill">Total ${escapeHTML(totalStock)}</div>
      </div>
      <div class="chart-layout">
        <div class="pie-wrap">
          <svg class="pie-svg" viewBox="0 0 200 200" role="img" aria-label="Stock pie chart">
            <circle class="pie-bg" cx="100" cy="100" r="70" fill="transparent" stroke="#e2e8f0" stroke-width="40" />
            ${segments}
            <circle cx="100" cy="100" r="44" fill="white" />
            <text x="100" y="94" text-anchor="middle" class="pie-center-label">Total</text>
            <text x="100" y="120" text-anchor="middle" class="pie-center-number">${escapeHTML(totalStock)}</text>
          </svg>
        </div>
        <div class="legend">${legend}</div>
      </div>
    </section>`;
}

function LiveStockPieChart({ pieData, totalStock }) {
  const animationKey = pieData.map((item) => `${item.label}:${item.value}`).join("|");

  return (
    <section className="interactive-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <style>{`
        @keyframes livePieDraw {
          from { stroke-dasharray: 0 100; }
        }
      `}</style>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black">Stock Share</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Updates from the quantity inputs.</p>
        </div>
        <div className="inline-flex w-fit items-center rounded-full bg-slate-900 px-3 py-1.5 text-sm font-black text-white">
          Total: {totalStock}
        </div>
      </div>

      {pieData.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
          <div className="flex justify-center">
            <svg
              key={animationKey}
              viewBox="0 0 200 200"
              role="img"
              aria-label="Live stock pie chart"
              className="aspect-square w-full max-w-[240px] overflow-visible"
            >
              <circle cx="100" cy="100" r="70" fill="transparent" stroke="#e2e8f0" strokeWidth="40" />
              {pieData.map((item, index) => (
                <circle
                  key={item.label}
                  className="pie-slice"
                  cx="100"
                  cy="100"
                  r="70"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="40"
                  pathLength="100"
                  strokeDasharray={`${item.percentage} ${100 - item.percentage}`}
                  strokeDashoffset={-item.start}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  style={{
                    animation: "livePieDraw 700ms ease-out both",
                    animationDelay: `${index * 80}ms`,
                    transition: "stroke-dasharray 350ms ease, stroke-dashoffset 350ms ease",
                  }}
                />
              ))}
              <circle cx="100" cy="100" r="44" fill="white" />
              <text x="100" y="94" textAnchor="middle" className="fill-slate-500 text-sm font-black">
                Total
              </text>
              <text x="100" y="121" textAnchor="middle" className="fill-slate-900 text-3xl font-black">
                {totalStock}
              </text>
            </svg>
          </div>

          <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1">
            {pieData.map((item) => (
              <div
                key={item.label}
                className="chart-legend-row grid grid-cols-[14px_1fr_auto] items-center gap-2 rounded-md bg-slate-50 px-3 py-2"
                style={{ "--legend-color": item.color }}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 truncate text-sm font-black text-slate-700">{item.label}</span>
                <span className="whitespace-nowrap text-sm font-black text-slate-900">
                  {item.value} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-[10px] border-slate-300 bg-white" />
          <p className="text-sm font-black text-slate-600">Add quantities to see the chart.</p>
        </div>
      )}
    </section>
  );
}

function runSelfTests() {
  const tests = [
    {
      name: "normalizeStock returns all base sizes when stock is undefined",
      pass: () => BASE_SIZES.every((size) => normalizeStock(undefined)[size] === 0),
    },
    {
      name: "normalizeStock returns all base sizes when stock is null",
      pass: () => BASE_SIZES.every((size) => normalizeStock(null)[size] === 0),
    },
    {
      name: "normalizeStock keeps valid quantities",
      pass: () => normalizeStock({ L: 5, M: "3" }).L === 5 && normalizeStock({ L: 5, M: "3" }).M === 3,
    },
    {
      name: "normalizeStock removes invalid quantities",
      pass: () => normalizeStock({ L: -2, M: "bad" }).L === 0 && normalizeStock({ L: -2, M: "bad" }).M === 0,
    },
    {
      name: "getStockTotal never crashes with missing stock",
      pass: () => getStockTotal(undefined) === 0 && getStockTotal(null) === 0,
    },
    {
      name: "normalizeProduct always creates safe stock",
      pass: () => BASE_SIZES.every((size) => normalizeProduct({ player: "Test", team: "Test" }).stock[size] === 0),
    },
    {
      name: "base sizes include XL and XXL",
      pass: () => BASE_SIZES.includes("XL") && BASE_SIZES.includes("XXL"),
    },
    {
      name: "CSV escaping handles commas and quotation marks",
      pass: () => escapeCSVCell('Ronaldo, "Portugal"') === '"Ronaldo, ""Portugal"""',
    },
    {
      name: "CSV builder uses escaped newline instead of broken source newline",
      pass: () => buildCSV([["A"], ["B"]]) === `${UTF8_BOM}"A"${CSV_NEWLINE}"B"`,
    },
    {
      name: "summary CSV includes Messi extra size columns",
      pass: () =>
        buildSummaryRows([
          { player: "Messi 10", team: "Argentina", imagePreview: "data:image/png;base64,a", stock: { 128: 2, 122: 1 } },
        ])[0].includes("128"),
    },
    {
      name: "summary CSV excludes zero size values",
      pass: () => {
        const rows = buildSummaryRows([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { L: 0, M: 3 } },
        ]);
        return !rows[0].includes("L") && !rows[1].includes("X");
      },
    },
    {
      name: "photo table report excludes zero-stock size entries",
      pass: () => {
        const report = buildPhotoTableReportHTML([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { L: 0, M: 3 } },
        ]);
        return (
          !report.includes('download-size-label">L</span>') &&
          !report.includes("download-zero-cross") &&
          report.includes('download-size-label">M</span>')
        );
      },
    },
    {
      name: "photo table report excludes jerseys with total zero quantity",
      pass: () => {
        const report = buildPhotoTableReportHTML([
          { player: "Zero Stock", team: "One", imagePreview: "data:image/png;base64,a", stock: { M: 0 } },
          { player: "Has Stock", team: "Two", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
        ]);
        return !report.includes("Zero Stock") && report.includes("Has Stock");
      },
    },
    {
      name: "photo table report renders stocked quantities as circles",
      pass: () =>
        buildPhotoTableReportHTML([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
        ]).includes("download-number-circle"),
    },
    {
      name: "photo table report keeps jerseys without photos",
      pass: () => {
        const report = buildPhotoTableReportHTML([
          { player: "Has Photo", team: "One", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
          { player: "No Photo", team: "Two", stock: { M: 3 } },
        ]);
        return report.includes("Has Photo") && report.includes("No Photo");
      },
    },
    {
      name: "photo table report excludes team and quality columns",
      pass: () => {
        const report = buildPhotoTableReportHTML([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
        ]);
        return !report.includes("<th>Team</th>") && !report.includes("<th>Quality</th>");
      },
    },
    {
      name: "photo table report excludes total stock column",
      pass: () =>
        !buildPhotoTableReportHTML([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
        ]).includes("<th>Total Stock</th>"),
    },
    {
      name: "summary rows exclude total stock column",
      pass: () =>
        !buildSummaryRows([
          { player: "Ronaldo", team: "Portugal", imagePreview: "data:image/png;base64,a", stock: { M: 3 } },
        ])[0].includes("Total Stock"),
    },
    {
      name: "pie chart data calculates stock percentages",
      pass: () => {
        const pieData = buildPieChartData([
          { player: "A", team: "One", stock: { L: 3 } },
          { player: "B", team: "Two", stock: { L: 1 } },
        ]);
        return pieData.length === 2 && pieData[0].percentage === 75 && pieData[1].percentage === 25;
      },
    },
    {
      name: "pie chart ignores zero stock items",
      pass: () => buildPieChartData([{ player: "A", team: "One", stock: { L: 0 } }]).length === 0,
    },
    {
      name: "pie chart HTML returns empty state when all stock is zero",
      pass: () => buildPieChartHTML([], 0).includes("Add quantities"),
    },
    {
      name: "HTML escaping protects visual report content",
      pass: () => escapeHTML('<img src="x">') === '&lt;img src=&quot;x&quot;&gt;',
    },
    {
      name: "productForStorage removes big image preview data",
      pass: () => !Object.prototype.hasOwnProperty.call(productForStorage({ player: "A", team: "B", imagePreview: "big-image-data" }), "imagePreview"),
    },
    {
      name: "productForStorage keeps photo metadata",
      pass: () => productForStorage({ player: "A", team: "B", imageName: "shirt.jpg", hasStoredImage: true }).imageName === "shirt.jpg",
    },
    {
      name: "photo-backed products are permanent",
      pass: () =>
        isPermanentPhotoProduct({ player: "A", team: "B", imagePreview: "data:image/png;base64,a" }) &&
        isPermanentPhotoProduct({ player: "A", team: "B", hasStoredImage: true }) &&
        !isPermanentPhotoProduct({ player: "A", team: "B" }),
    },
    {
      name: "createNewProductFromForm creates a product even when fields are empty",
      pass: () => createNewProductFromForm({ player: "", team: "" }).player === "New Player",
    },
    {
      name: "all products always use Player version",
      pass: () => normalizeProduct({ player: "Test", team: "Team", quality: "Premium" }).quality === FIXED_QUALITY,
    },
    {
      name: "Messi has extra sizes 128 and 122",
      pass: () => getSizesForPlayer("Messi 10").includes("128") && getSizesForPlayer("Messi 10").includes("122"),
    },
    {
      name: "non-Messi jerseys do not show Messi extra sizes",
      pass: () => !getSizesForPlayer("Ronaldo").includes("128") && !getSizesForPlayer("Ronaldo").includes("122"),
    },
    {
      name: "starter products include the bundled permanent photo card",
      pass: () => {
        const starter = starterProducts[0];
        return (
          starterProducts.length === 1 &&
          productKey(starter) === "messi-argentina" &&
          starter.imagePreview.includes("jerseys/messi-argentina.png")
        );
      },
    },
    {
      name: "bundled photo restores after lightweight storage",
      pass: () =>
        normalizeProduct({ player: "Messi", team: "Argentina", imageName: "messi-argentina.png", hasStoredImage: true }).imagePreview.includes(
          "jerseys/messi-argentina.png"
        ),
    },
    {
      name: "saved products are displayed in priority order",
      pass: () => {
        const orderedPlayers = sortProductsByPriority([
          { player: "Mbappé", team: "Blue" },
          { player: "Ronaldo", team: "Portugal" },
          { player: "Lamine Yamal", team: "Spain" },
          { player: "Messi 10", team: "Argentina" },
        ]).map((product) => product.player);
        return orderedPlayers.join(",") === "Lamine Yamal,Messi 10,Ronaldo,Mbappé";
      },
    },
    {
      name: "mergeMissingStarterProducts adds starter products without duplicating saved products",
      pass: () =>
        mergeMissingStarterProducts([{ player: "Messi 10", team: "Argentina" }]).filter(
          (product) => getPermanentCatalogId(product) === "messi-argentina"
        ).length === 1,
    },
    {
      name: "resetProductQuantities keeps photos and resets only stock numbers",
      pass: () => {
        const product = resetProductQuantities({
          player: "Test",
          team: "Team",
          imagePreview: "photo-data",
          imageName: "photo.jpg",
          hasStoredImage: true,
          stock: { L: 5, M: 3 },
        });
        return product.imagePreview === "photo-data" && product.imageName === "photo.jpg" && getStockTotal(product.stock) === 0;
      },
    },
  ];

  const failedTests = tests.filter((test) => !test.pass());
  if (failedTests.length > 0) {
    console.warn("Inventory self-tests failed:", failedTests.map((test) => test.name));
  }
}

export default function FootballJerseyInventory() {
  const [products, setProducts] = useState(loadProducts);
  const [query, setQuery] = useState("");
  const [newProduct, setNewProduct] = useState({ player: "", team: "" });
  const [imageStatus, setImageStatus] = useState("");

  useEffect(() => {
    runSelfTests();
  }, []);

  useEffect(() => {
    saveProducts(products);
  }, [products]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredImages() {
      const productsNeedingImages = products
        .map(normalizeProduct)
        .filter((product) => product.hasStoredImage && !product.imagePreview);

      if (productsNeedingImages.length === 0) return;

      setImageStatus("Loading saved photos...");

      const imageEntries = await Promise.all(
        productsNeedingImages.map(async (product) => [product.id, await getImageFromDatabase(product.id)])
      );

      if (cancelled) return;

      const imageMap = new Map(imageEntries.filter(([, imageDataUrl]) => Boolean(imageDataUrl)));

      setProducts((current) =>
        current.map((item) => {
          const safeItem = normalizeProduct(item);
          const imageDataUrl = imageMap.get(safeItem.id);
          return imageDataUrl ? { ...safeItem, imagePreview: imageDataUrl, hasStoredImage: true } : safeItem;
        })
      );

      setImageStatus(imageMap.size > 0 ? "Saved photos loaded." : "No saved photo data found.");
    }

    loadStoredImages();

    return () => {
      cancelled = true;
    };
  }, []);

  const safeProducts = useMemo(() => sortProductsByPriority(products), [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return safeProducts;

    return safeProducts.filter((item) => `${item.player} ${item.team} ${item.quality}`.toLowerCase().includes(q));
  }, [safeProducts, query]);

  const totalJerseys = useMemo(
    () => safeProducts.reduce((sum, item) => sum + getStockTotal(item.stock, getSizesForPlayer(item.player)), 0),
    [safeProducts]
  );

  const livePieData = useMemo(() => buildPieChartData(safeProducts), [safeProducts]);

  const totalStyles = safeProducts.length;

  const updateProduct = (id, patch) => {
    setProducts((current) =>
      current.map((item) => (item.id === id ? normalizeProduct({ ...item, ...patch }) : normalizeProduct(item)))
    );
  };

  const updateStock = (id, size, value) => {
    const quantity = Number(value);
    const safeValue = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;

    setProducts((current) =>
      current.map((item) => {
        const safeItem = normalizeProduct(item);
        if (safeItem.id !== id) return safeItem;

        return {
          ...safeItem,
          stock: {
            ...safeItem.stock,
            [size]: safeValue,
          },
        };
      })
    );
  };

  const handleImageUpload = async (id, file) => {
    if (!file) return;

    try {
      setImageStatus("Uploading photo...");
      const imageDataUrl = await readFileAsDataUrl(file);

      updateProduct(id, {
        imagePreview: imageDataUrl,
        imageName: file.name,
        hasStoredImage: true,
      });

      await saveImageToDatabase(id, imageDataUrl);
      setImageStatus("Photo uploaded and saved.");
    } catch (error) {
      console.warn("Photo upload failed:", error);
      setImageStatus("Photo upload failed. Please try another image.");
    }
  };

  const addProduct = () => {
    setProducts((current) => [createNewProductFromForm(newProduct), ...current.map(normalizeProduct)]);
    setNewProduct({ player: "", team: "" });
  };

  const deleteProduct = async (id) => {
    const product = safeProducts.find((item) => item.id === id);
    if (product && isPermanentPhotoProduct(product)) {
      setImageStatus("This photo model is permanent and stays in the list.");
      return;
    }

    setProducts((current) => current.map(normalizeProduct).filter((item) => item.id !== id));
    await deleteImageFromDatabase(id);
  };

  const deleteNoPictureProducts = () => {
    const noPictureProducts = safeProducts.filter((item) => !isPermanentPhotoProduct(item));

    if (noPictureProducts.length === 0) {
      setImageStatus("No no-picture cards to delete.");
      return;
    }

    setProducts((current) => current.map(normalizeProduct).filter(isPermanentPhotoProduct));
    setImageStatus(`Deleted ${noPictureProducts.length} no-picture card${noPictureProducts.length === 1 ? "" : "s"}.`);
  };

  const resetQuantitiesOnly = () => {
    setProducts((current) => current.map(resetProductQuantities));
    setImageStatus("Quantities reset to 0. Photos and jersey details were kept.");
  };

  const exportPhotoTableReport = async () => {
    setImageStatus("Preparing photo table report...");

    const imageEntries = await Promise.all(
      safeProducts.map(async (item) => {
        const safeItem = normalizeProduct(item);
        const photoDataUrl = await getProductPhotoDataUrl(safeItem);
        return [safeItem.id, photoDataUrl];
      })
    );
    const imageDataById = new Map(imageEntries.filter(([, photoDataUrl]) => Boolean(photoDataUrl)));
    const photoReportHTML = buildPhotoTableReportHTML(safeProducts, imageDataById);
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      `football-jersey-photo-table-${date}.html`,
      photoReportHTML,
      "text/html;charset=utf-8"
    );
    setImageStatus(
      imageDataById.size > 0
        ? "Photo table report exported with embedded photos."
        : "Photo table report exported. No uploaded photos were found to include."
    );
  };

  const exportVisualReport = async () => {
    const reportProducts = await Promise.all(
      safeProducts.map(async (item) => {
        const safeItem = normalizeProduct(item);
        const productSizes = getSizesForPlayer(safeItem.player);
        const safeStock = normalizeStock(safeItem.stock, productSizes);
        const totalForJersey = getStockTotal(safeStock, productSizes);
        const storedImage = await getProductPhotoDataUrl(safeItem);

        return {
          ...safeItem,
          productSizes,
          safeStock,
          totalForJersey,
          storedImage,
        };
      })
    );

    const totalReportStock = reportProducts.reduce((sum, item) => sum + item.totalForJersey, 0);
    const pieData = buildPieChartData(reportProducts);
    const pieChart = buildPieChartHTML(pieData, totalReportStock);
    const date = new Date().toISOString().slice(0, 10);

    const cards = reportProducts
      .map((item) => {
        const sizeCards = item.productSizes
          .filter((size) => Number(item.safeStock[size] || 0) > 0)
          .map((size) => {
            const quantity = Number(item.safeStock[size] || 0);

            return `
              <div class="size-card" ${buildSizeStyleAttribute(size)}>
                <div class="size-label">${escapeHTML(size)}</div>
                <div class="size-number"><span class="download-number-circle">${escapeHTML(quantity)}</span></div>
              </div>`;
          })
          .join("");
        const sizeBlock = sizeCards || `<div class="no-stock-sizes">No sizes with stock</div>`;

        const photoBlock = item.storedImage
          ? `<img class="photo" src="${item.storedImage}" alt="${escapeHTML(item.player)} ${escapeHTML(item.team)}" />`
          : `<div class="photo-placeholder">No Photo</div>`;

        return `
          <section class="card">
            <div class="photo-wrap">${photoBlock}</div>
            <div class="details">
              <div class="player">${escapeHTML(item.player)}</div>
              <div class="sizes">${sizeBlock}</div>
            </div>
          </section>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Football Jersey Inventory Report</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
    .header, .chart-section, .card { background: white; border-radius: 28px; padding: 32px; margin-bottom: 24px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0; font-size: 56px; line-height: 1; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 24px; }
    .summary-box { background: #e2e8f0; border-radius: 22px; padding: 24px; text-align: center; }
    .summary-label { font-size: 22px; font-weight: 800; color: #475569; }
    .summary-number { font-size: 72px; font-weight: 900; line-height: 1; }
    .card { display: grid; grid-template-columns: 260px 1fr; gap: 24px; page-break-inside: avoid; }
    .photo-wrap { width: 260px; min-height: 260px; background: #e2e8f0; border-radius: 22px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .photo { width: 100%; height: 260px; object-fit: cover; display: block; }
    .photo-placeholder { font-size: 30px; font-weight: 900; color: #64748b; }
    .player { font-size: 48px; font-weight: 900; line-height: 1; }
    .sizes { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-top: 18px; }
    .size-card { background: var(--size-bg); border: 3px solid var(--size-border); border-left: 12px solid var(--size-accent); border-radius: 18px; padding: 14px; text-align: center; }
    .size-label { color: var(--size-text); font-size: 28px; font-weight: 900; letter-spacing: 0; }
    .size-number { align-items: center; color: var(--size-text); display: flex; font-size: 46px; font-weight: 900; justify-content: center; line-height: 1; margin-top: 10px; min-height: 94px; }
    .size-number .download-number-circle { align-items: center; background: rgba(255, 255, 255, 0.9); border: 7px solid var(--size-accent); border-radius: 999px; color: var(--size-text); display: inline-flex; font-size: 56px; font-weight: 900; height: 92px; justify-content: center; line-height: 1; min-width: 92px; padding: 0 12px; }
    .no-stock-sizes { grid-column: 1 / -1; background: #f8fafc; border-radius: 18px; color: #64748b; font-size: 24px; font-weight: 900; padding: 18px; text-align: center; }
    .chart-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
    .chart-title-row h2 { margin: 0; font-size: 42px; line-height: 1; }
    .chart-title-row p { margin: 10px 0 0; font-size: 20px; font-weight: 700; color: #475569; }
    .chart-total-pill { white-space: nowrap; background: #0f172a; color: white; border-radius: 999px; padding: 14px 22px; font-size: 24px; font-weight: 900; }
    .chart-layout { display: grid; grid-template-columns: 360px 1fr; gap: 28px; align-items: center; }
    .pie-wrap { display: flex; align-items: center; justify-content: center; }
    .pie-svg { width: 100%; max-width: 360px; overflow: visible; }
    .pie-segment { transform-origin: 100px 100px; animation: drawPie 1.1s ease-out both; stroke-linecap: round; }
    .pie-center-label { font-size: 14px; font-weight: 900; fill: #64748b; }
    .pie-center-number { font-size: 30px; font-weight: 900; fill: #0f172a; }
    .legend { display: grid; gap: 10px; }
    .legend-row { display: grid; grid-template-columns: 24px 1fr auto; gap: 12px; align-items: center; background: #f8fafc; border-radius: 16px; padding: 12px 14px; }
    .legend-dot { width: 18px; height: 18px; border-radius: 999px; display: inline-block; }
    .legend-label { font-size: 20px; font-weight: 900; color: #334155; }
    .legend-value { font-size: 22px; font-weight: 900; color: #0f172a; }
    .chart-empty { background: #f8fafc; border-radius: 22px; padding: 32px; text-align: center; }
    .chart-empty-title { font-size: 42px; font-weight: 900; }
    .chart-empty p { font-size: 22px; font-weight: 800; color: #64748b; }
    @keyframes drawPie { from { stroke-dasharray: 0 100; } }
    @media print { body { background: white; padding: 16px; } .card, .header, .chart-section { box-shadow: none; border: 2px solid #e2e8f0; } }
    @media (max-width: 760px) { body { padding: 16px; } h1 { font-size: 38px; } .card { grid-template-columns: 1fr; } .photo-wrap { width: 100%; } .chart-layout { grid-template-columns: 1fr; } .chart-title-row { flex-direction: column; } }
  </style>
</head>
<body>
  <header class="header">
    <h1>Football Jersey Inventory</h1>
    <div class="summary">
      <div class="summary-box">
        <div class="summary-label">Total Styles</div>
        <div class="summary-number">${escapeHTML(reportProducts.length)}</div>
      </div>
    </div>
  </header>
  ${pieChart}
  ${cards}
</body>
</html>`;

    downloadText(`football-jersey-visual-report-${date}.html`, html, "text/html;charset=utf-8");
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 text-slate-900 sm:p-6">
      <div className="air-background" aria-hidden="true">
        <span className="air-plane air-plane-one" />
        <span className="air-plane air-plane-two" />
        <span className="air-plane air-plane-three" />
      </div>
      <div className="relative z-10 mx-auto max-w-screen-2xl space-y-5">
        <header className="interactive-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white">
                <Shirt className="h-4 w-4" /> Jersey Inventory
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Football Jersey Stock</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Track photos, sizes, and stock in one simple workspace.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-xs font-bold uppercase text-slate-500">Styles</p>
                <p className="text-3xl font-black">{totalStyles}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-xs font-bold uppercase text-slate-500">Stock</p>
                <p className="text-3xl font-black">{totalJerseys}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="interactive-panel rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black">Add Jersey</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_140px]">
            <input
              value={newProduct.player}
              onChange={(e) => setNewProduct((p) => ({ ...p, player: e.target.value }))}
              placeholder="Player name, e.g. Messi"
              className="rounded-md border border-slate-300 px-3 py-2.5 text-base font-bold outline-none focus:border-slate-900"
            />
            <input
              value={newProduct.team}
              onChange={(e) => setNewProduct((p) => ({ ...p, team: e.target.value }))}
              placeholder="Team, e.g. Argentina"
              className="rounded-md border border-slate-300 px-3 py-2.5 text-base font-bold outline-none focus:border-slate-900"
            />
            <button
              onClick={addProduct}
              className="flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-base font-black text-white hover:bg-slate-700"
            >
              <Plus className="h-5 w-5" /> Add
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Default photos are built into the app. New uploads are saved in this browser.
          </p>
          {imageStatus && (
            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">
              {imageStatus}
            </p>
          )}
        </section>

        <section className="interactive-panel flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player, team or quality"
              className="w-full rounded-md border border-slate-300 py-2.5 pl-10 pr-3 text-base font-bold outline-none focus:border-slate-900"
            />
          </div>
          <button
            onClick={exportPhotoTableReport}
            className="flex items-center justify-center gap-2 rounded-md border border-slate-900 px-3 py-2.5 text-sm font-black hover:bg-slate-900 hover:text-white"
          >
            <Download className="h-5 w-5" /> Photo Table
          </button>
          <button
            onClick={exportVisualReport}
            className="flex items-center justify-center gap-2 rounded-md border border-slate-900 px-3 py-2.5 text-sm font-black hover:bg-slate-900 hover:text-white"
          >
            <Download className="h-5 w-5" /> Pie Report
          </button>
          <button
            onClick={resetQuantitiesOnly}
            className="flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2.5 text-sm font-black text-red-600 hover:bg-red-50"
          >
            <RotateCcw className="h-5 w-5" /> Reset
          </button>
          <button
            onClick={deleteNoPictureProducts}
            className="flex items-center justify-center gap-2 rounded-md border border-red-300 px-3 py-2.5 text-sm font-black text-red-700 hover:bg-red-600 hover:text-white"
          >
            <Trash2 className="h-5 w-5" /> Delete No-Photo
          </button>
        </section>

        <LiveStockPieChart pieData={livePieData} totalStock={totalJerseys} />

        <main className="grid gap-6 xl:grid-cols-2">
          {filteredProducts.length === 0 && (
            <section className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <h2 className="text-lg font-black text-slate-800">No jerseys to show</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Add a jersey above or adjust the search.</p>
            </section>
          )}
          {filteredProducts.map((item) => {
            const safeItem = normalizeProduct(item);
            const productSizes = getSizesForPlayer(safeItem.player);
            const safeStock = normalizeStock(safeItem.stock, productSizes);
            const itemTotal = getStockTotal(safeStock, productSizes);
            const isPermanent = isPermanentPhotoProduct(safeItem);

            return (
              <article key={safeItem.id} className="jersey-card overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                  <div className="flex min-h-[180px] items-center justify-center overflow-hidden bg-slate-100 p-3">
                    {safeItem.imagePreview ? (
                      <img
                        src={safeItem.imagePreview}
                        alt={`${safeItem.player} ${safeItem.team}`}
                        className="jersey-photo h-full max-h-[220px] w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-500">
                        <ImageIcon className="mx-auto mb-2 h-10 w-10" />
                        <p className="text-sm font-black">No Picture</p>
                        {safeItem.hasStoredImage && (
                          <p className="mt-1 text-xs font-bold">Saved photo will load shortly</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <input
                          value={safeItem.player}
                          onChange={(e) => updateProduct(safeItem.id, { player: e.target.value })}
                          className="w-full border-b border-transparent bg-transparent text-2xl font-black outline-none focus:border-slate-900"
                        />
                        <input
                          value={safeItem.team}
                          onChange={(e) => updateProduct(safeItem.id, { team: e.target.value })}
                          className="mt-1 w-full border-b border-transparent bg-transparent text-base font-extrabold text-slate-500 outline-none focus:border-slate-900"
                        />
                      </div>
                      {isPermanent ? (
                        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-2 text-xs font-black text-emerald-700">
                          <Lock className="h-4 w-4" /> Permanent
                        </div>
                      ) : (
                        <button
                          onClick={() => deleteProduct(safeItem.id)}
                          className="rounded-md bg-red-50 p-2 text-red-600 hover:bg-red-100"
                          aria-label="Delete product"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-slate-600">
                        {FIXED_QUALITY}
                      </div>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-black hover:bg-slate-200">
                        <Upload className="h-5 w-5" /> Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(safeItem.id, e.target.files?.[0])}
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black uppercase text-slate-500">Sizes</p>
                        <p className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-white">
                          Total: {itemTotal}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
                        {productSizes.map((size) => {
                          const sizeQuantity = Number(safeStock[size] || 0);

                          return (
                            <label
                              key={size}
                              className={`size-tile rounded-lg p-2 text-slate-900 shadow-sm hover:-translate-y-0.5 hover:shadow-md ${
                                sizeQuantity === 0 ? "size-tile-empty" : ""
                              }`}
                              style={getSizeStyleVars(size)}
                            >
                              <span className="size-label-ui block text-center text-base font-black leading-none sm:text-lg">
                                {size}
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={safeStock[size] ?? 0}
                                onChange={(e) => updateStock(safeItem.id, size, e.target.value)}
                                className="size-input mt-2 block h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xl font-black leading-none text-slate-900 outline-none focus:border-slate-900"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}
