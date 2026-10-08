/**
 * Offline ZIP Export, Import, Inspection & Transfer Engine
 * Mini Universal POS — Multi-Device Manual Transfer & Backup System
 * 
 * Capabilities:
 * 1. Full Business Backup (.zip) with images/ directory
 * 2. Products-Only Transfer (.zip) for Admin -> Cashier transfer (Messenger/Bluetooth/USB)
 * 3. Sales & Shift Transfer (.zip) for Cashier -> Admin transfer
 * 4. Safe Products-Only Import: Updates product info/prices without overwriting Cashier's stock levels
 * 5. Safe Sales Merge Import: Adds new sales without duplicating transactions
 * 6. Full Restore (.zip): Complete dataset restore while preserving local Admin PIN credentials
 * 7. Security: Path traversal protection, file size validation, image Blob storage
 */

import JSZip from 'jszip';
import {
  openDB,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  getAllCashiers,
  getAllStockMovements,
  getAllProductHistory,
  getAllResetRequests,
  getSettings,
  saveSettings,
  saveProduct,
  saveCategory,
  saveCustomer,
  saveCashier,
  saveResetRequest,
  clearAllData,
  createPreMergeSafetySnapshot,
  Product,
  Category,
  Transaction,
  Customer,
  Cashier,
  StockMovement,
  Settings,
  blobToBase64,
  base64ToBlob,
} from '../db/indexedDB';

export type ZipExportType = 'full_backup' | 'products_transfer' | 'sales_transfer';

export interface ZipManifest {
  app: string;
  version: number;
  exportType: ZipExportType;
  exportedAt: string;
  storeName: string;
  ownerName: string;
  counts: {
    products?: number;
    categories?: number;
    transactions?: number;
    stockMovements?: number;
    customers?: number;
    cashiers?: number;
    images?: number;
  };
}

export interface ZipInspection {
  valid: boolean;
  error?: string;
  exportType: ZipExportType | 'legacy_json';
  version: number;
  exportedAt?: string;
  storeName?: string;
  ownerName?: string;
  fileName: string;
  fileSize: number;
  counts: {
    productsToAdd: number;
    productsToUpdate: number;
    categoriesToAdd: number;
    transactionsToAdd: number;
    transactionsDuplicate: number;
    stockMovementsToAdd: number;
    customersToAdd: number;
    cashiersToAdd: number;
    imagesCount: number;
  };
  conflicts: string[];
  parsedData: {
    manifest?: ZipManifest;
    products?: Product[];
    categories?: Category[];
    transactions?: Transaction[];
    stockMovements?: StockMovement[];
    customers?: Customer[];
    cashiers?: Cashier[];
    settings?: Settings;
    productHistory?: any[];
    resetRequests?: any[];
    imagesMap?: Map<string, Blob>; // productId -> Blob
  };
}

export interface ImportExecutionResult {
  success: boolean;
  message: string;
  summary: {
    productsAdded: number;
    productsUpdated: number;
    categoriesAdded: number;
    transactionsAdded: number;
    transactionsSkipped: number;
    stockMovementsAdded: number;
    customersAdded: number;
    cashiersAdded: number;
    imagesRestored: number;
  };
}

// Helper: Download a Blob as a file
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Determine image MIME type / extension from Blob or Base64
 */
function getImageExtension(mimeOrBase64: string): string {
  if (mimeOrBase64.includes('jpeg') || mimeOrBase64.includes('jpg')) return 'jpg';
  if (mimeOrBase64.includes('webp')) return 'webp';
  if (mimeOrBase64.includes('gif')) return 'gif';
  return 'png';
}

// ============================================================================
// 1. ZIP EXPORT FUNCTIONS
// ============================================================================

/**
 * Export Full Business Backup (.zip)
 * Includes all business records + product images folder
 */
export async function exportFullBusinessBackupZip(): Promise<void> {
  const db = await openDB();
  const settings = await getSettings(db);
  const categories = await getAllCategories(db);
  const rawProducts = await getAllProducts(db);
  const transactions = await getAllTransactions();
  const customers = await getAllCustomers();
  const cashiers = await getAllCashiers(db);
  const stockMovements = await getAllStockMovements(db);
  const resetRequests = await getAllResetRequests(db);
  const history = await getAllProductHistory();

  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  let imagesCount = 0;

  // Process products and extract Blobs into images/ directory in ZIP
  const serializedProducts: any[] = [];
  for (const prod of rawProducts) {
    let imageFilename: string | undefined = undefined;

    if (prod.image) {
      try {
        let blob: Blob | null = null;
        if (prod.image instanceof Blob) {
          blob = prod.image;
        } else if (typeof prod.image === 'string' && prod.image.startsWith('data:')) {
          blob = base64ToBlob(prod.image);
        }

        if (blob && imagesFolder) {
          const ext = getImageExtension(blob.type);
          imageFilename = `images/prod-${prod.id}.${ext}`;
          imagesFolder.file(`prod-${prod.id}.${ext}`, blob);
          imagesCount++;
        }
      } catch (e) {
        console.warn('Failed extracting image for zip export:', prod.name, e);
      }
    }

    serializedProducts.push({
      ...prod,
      image: imageFilename, // Reference relative path in zip
    });
  }

  // Sanitize settings: strip local Admin PINs and recovery secrets
  const sanitizedSettings: Settings = {
    ...settings,
    adminPin: '••••',
    adminPinHash: undefined,
    adminPinSalt: undefined,
    recoveryCodeHash: undefined,
    recoveryCodeSalt: undefined,
    recoveryCodeCreatedAt: undefined,
    recoveryToken: undefined,
    failedRecoveryAttempts: undefined,
    recoveryLockoutUntil: undefined,
  };

  const manifest: ZipManifest = {
    app: 'MiniUniversalPOS',
    version: 5,
    exportType: 'full_backup',
    exportedAt: new Date().toISOString(),
    storeName: settings.storeName || 'Mini POS',
    ownerName: settings.ownerName || 'Store Owner',
    counts: {
      products: serializedProducts.length,
      categories: categories.length,
      transactions: transactions.length,
      stockMovements: stockMovements.length,
      customers: customers.length,
      cashiers: cashiers.length,
      images: imagesCount,
    },
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('products.json', JSON.stringify(serializedProducts, null, 2));
  zip.file('categories.json', JSON.stringify(categories, null, 2));
  zip.file('transactions.json', JSON.stringify(transactions, null, 2));
  zip.file('stock_movements.json', JSON.stringify(stockMovements, null, 2));
  zip.file('customers.json', JSON.stringify(customers, null, 2));
  zip.file('cashiers.json', JSON.stringify(cashiers, null, 2));
  zip.file('reset_requests.json', JSON.stringify(resetRequests, null, 2));
  zip.file('product_history.json', JSON.stringify(history, null, 2));
  zip.file('settings.json', JSON.stringify(sanitizedSettings, null, 2));

  const zipContent = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeStore = (settings.storeName || 'MiniPOS').toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  triggerBlobDownload(zipContent, `${safeStore}-full-backup-${dateStr}.zip`);

  try {
    localStorage.setItem('pos_last_backup_date', new Date().toISOString());
  } catch (e) {
    // ignore
  }
}

/**
 * Export Products-Only Transfer (.zip)
 * Designed for Admin -> Cashier transfer via Messenger / Bluetooth / USB
 * Contains ONLY product details, categories & product images. NO sales, NO PINs, NO inventory overrides.
 */
export async function exportProductsOnlyTransferZip(): Promise<void> {
  const db = await openDB();
  const settings = await getSettings(db);
  const categories = await getAllCategories(db);
  const rawProducts = await getAllProducts(db);

  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  let imagesCount = 0;

  const transferProducts: any[] = [];
  for (const prod of rawProducts) {
    let imageFilename: string | undefined = undefined;

    if (prod.image) {
      try {
        let blob: Blob | null = null;
        if (prod.image instanceof Blob) {
          blob = prod.image;
        } else if (typeof prod.image === 'string' && prod.image.startsWith('data:')) {
          blob = base64ToBlob(prod.image);
        }

        if (blob && imagesFolder) {
          const ext = getImageExtension(blob.type);
          imageFilename = `images/prod-${prod.id}.${ext}`;
          imagesFolder.file(`prod-${prod.id}.${ext}`, blob);
          imagesCount++;
        }
      } catch (e) {
        console.warn('Image extract failed:', prod.name);
      }
    }

    transferProducts.push({
      id: prod.id,
      sku: prod.sku,
      barcode: prod.barcode,
      name: prod.name,
      price: prod.price,
      cost: prod.cost,
      stock: prod.stock, // Default opening stock reference for new products
      categoryId: prod.categoryId,
      description: prod.description,
      image: imageFilename,
      createdAt: prod.createdAt,
      updatedAt: prod.updatedAt,
    });
  }

  const manifest: ZipManifest = {
    app: 'MiniUniversalPOS',
    version: 5,
    exportType: 'products_transfer',
    exportedAt: new Date().toISOString(),
    storeName: settings.storeName || 'Mini POS',
    ownerName: settings.ownerName || 'Store Owner',
    counts: {
      products: transferProducts.length,
      categories: categories.length,
      images: imagesCount,
    },
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('products.json', JSON.stringify(transferProducts, null, 2));
  zip.file('categories.json', JSON.stringify(categories, null, 2));

  const zipContent = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeStore = (settings.storeName || 'MiniPOS').toLowerCase().replace(/[^a-z0-9]/g, '-');

  triggerBlobDownload(zipContent, `${safeStore}-products-transfer-${dateStr}.zip`);
}

/**
 * Export Sales Transfer (.zip)
 * Designed for Cashier -> Admin transfer of shift sales & stock movements
 */
export async function exportSalesTransferZip(): Promise<void> {
  const db = await openDB();
  const settings = await getSettings(db);
  const transactions = await getAllTransactions();
  const stockMovements = await getAllStockMovements(db);
  const customers = await getAllCustomers();

  const zip = new JSZip();

  const manifest: ZipManifest = {
    app: 'MiniUniversalPOS',
    version: 5,
    exportType: 'sales_transfer',
    exportedAt: new Date().toISOString(),
    storeName: settings.storeName || 'Mini POS',
    ownerName: settings.ownerName || 'Store Owner',
    counts: {
      transactions: transactions.length,
      stockMovements: stockMovements.length,
      customers: customers.length,
    },
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('transactions.json', JSON.stringify(transactions, null, 2));
  zip.file('stock_movements.json', JSON.stringify(stockMovements, null, 2));
  zip.file('customers.json', JSON.stringify(customers, null, 2));

  const zipContent = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeStore = (settings.storeName || 'MiniPOS').toLowerCase().replace(/[^a-z0-9]/g, '-');

  triggerBlobDownload(zipContent, `${safeStore}-sales-transfer-${dateStr}.zip`);
}

// ============================================================================
// 2. ZIP INSPECTION & VALIDATION ENGINE
// ============================================================================

/**
 * Safely inspect and validate a user-selected ZIP file before importing
 */
export async function inspectZipFile(file: File): Promise<ZipInspection> {
  const result: ZipInspection = {
    valid: false,
    exportType: 'full_backup',
    version: 5,
    fileName: file.name,
    fileSize: file.size,
    counts: {
      productsToAdd: 0,
      productsToUpdate: 0,
      categoriesToAdd: 0,
      transactionsToAdd: 0,
      transactionsDuplicate: 0,
      stockMovementsToAdd: 0,
      customersToAdd: 0,
      cashiersToAdd: 0,
      imagesCount: 0,
    },
    conflicts: [],
    parsedData: {},
  };

  // Max ZIP size limit: 100MB
  if (file.size > 100 * 1024 * 1024) {
    result.error = 'ZIP archive exceeds maximum supported file size limit of 100MB.';
    return result;
  }

  // Support for legacy JSON files
  if (file.name.toLowerCase().endsWith('.json')) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      result.exportType = 'legacy_json';
      result.parsedData = {
        products: parsed.products || [],
        categories: parsed.categories || [],
        transactions: parsed.transactions || [],
        stockMovements: parsed.stockMovements || [],
        customers: parsed.customers || [],
        cashiers: parsed.cashiers || [],
        settings: parsed.settings,
        productHistory: parsed.productHistory || [],
      };
      result.storeName = parsed.metadata?.storeName || parsed.settings?.storeName;
      result.exportedAt = parsed.exportedAt || parsed.metadata?.timestamp;
      result.valid = true;
      
      // Perform counts for legacy JSON
      const localProducts = await getAllProducts();
      const localProdIds = new Set(localProducts.map(p => p.id));
      for (const p of (result.parsedData.products || [])) {
        if (localProdIds.has(p.id)) result.counts.productsToUpdate++;
        else result.counts.productsToAdd++;
      }
      result.counts.categoriesToAdd = (result.parsedData.categories || []).length;
      result.counts.transactionsToAdd = (result.parsedData.transactions || []).length;

      return result;
    } catch (err) {
      result.error = 'Failed to parse legacy JSON backup file.';
      return result;
    }
  }

  try {
    const zip = await JSZip.loadAsync(file);

    // Path traversal check
    for (const relativePath of Object.keys(zip.files)) {
      if (relativePath.includes('../') || relativePath.startsWith('/')) {
        result.error = 'Unsafe archive path detected inside ZIP file.';
        return result;
      }
      if (/\.(exe|sh|bat|cmd|apk|app|vbs|js)$/i.test(relativePath)) {
        result.error = 'Unsafe executable content detected inside ZIP archive.';
        return result;
      }
    }

    // 1. Read manifest.json
    let manifest: ZipManifest | undefined = undefined;
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        const text = await manifestFile.async('text');
        manifest = JSON.parse(text);
        result.exportType = manifest?.exportType || 'full_backup';
        result.version = manifest?.version || 5;
        result.exportedAt = manifest?.exportedAt;
        result.storeName = manifest?.storeName;
        result.ownerName = manifest?.ownerName;
        result.parsedData.manifest = manifest;
      } catch (e) {
        console.warn('Manifest parse warning:', e);
      }
    }

    // 2. Read products & categories
    let products: Product[] = [];
    const productsFile = zip.file('products.json');
    if (productsFile) {
      try {
        const text = await productsFile.async('text');
        products = JSON.parse(text);
        result.parsedData.products = products;
      } catch (e) {
        result.error = 'Failed to parse products.json in ZIP archive.';
        return result;
      }
    }

    let categories: Category[] = [];
    const categoriesFile = zip.file('categories.json');
    if (categoriesFile) {
      try {
        const text = await categoriesFile.async('text');
        categories = JSON.parse(text);
        result.parsedData.categories = categories;
      } catch (e) {
        // ignore
      }
    }

    // 3. Read transactions, stock movements, customers, cashiers, settings
    const transactionsFile = zip.file('transactions.json');
    if (transactionsFile) {
      try {
        const text = await transactionsFile.async('text');
        result.parsedData.transactions = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const stockMovementsFile = zip.file('stock_movements.json');
    if (stockMovementsFile) {
      try {
        const text = await stockMovementsFile.async('text');
        result.parsedData.stockMovements = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const customersFile = zip.file('customers.json');
    if (customersFile) {
      try {
        const text = await customersFile.async('text');
        result.parsedData.customers = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const cashiersFile = zip.file('cashiers.json');
    if (cashiersFile) {
      try {
        const text = await cashiersFile.async('text');
        result.parsedData.cashiers = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const settingsFile = zip.file('settings.json');
    if (settingsFile) {
      try {
        const text = await settingsFile.async('text');
        result.parsedData.settings = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const productHistoryFile = zip.file('product_history.json');
    if (productHistoryFile) {
      try {
        const text = await productHistoryFile.async('text');
        result.parsedData.productHistory = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    const resetRequestsFile = zip.file('reset_requests.json');
    if (resetRequestsFile) {
      try {
        const text = await resetRequestsFile.async('text');
        result.parsedData.resetRequests = JSON.parse(text);
      } catch (e) {
        // ignore
      }
    }

    // 4. Extract Product Images from images/ folder inside ZIP
    const imagesMap = new Map<string, Blob>();
    const imageFiles = Object.keys(zip.files).filter((f) => f.startsWith('images/') && !zip.files[f].dir);

    for (const imgPath of imageFiles) {
      try {
        const fileObj = zip.file(imgPath);
        if (fileObj) {
          const blob = await fileObj.async('blob');
          // Extract product ID from filename e.g. "images/prod-123.png" -> "123"
          const match = imgPath.match(/prod-([^.\/]+)/);
          if (match && match[1]) {
            imagesMap.set(match[1], blob);
          }
        }
      } catch (e) {
        console.warn('Image extraction failed:', imgPath);
      }
    }
    result.parsedData.imagesMap = imagesMap;
    result.counts.imagesCount = imagesMap.size;

    // Determine export type if no manifest was present
    if (!manifest) {
      if (products.length > 0 && !result.parsedData.transactions) {
        result.exportType = 'products_transfer';
      } else if (result.parsedData.transactions && products.length === 0) {
        result.exportType = 'sales_transfer';
      } else {
        result.exportType = 'full_backup';
      }
    }

    // 5. Compare with local IndexedDB records to count additions & updates
    const localProducts = await getAllProducts();
    const localProdIdMap = new Map(localProducts.map((p) => [p.id, p]));
    const localBarcodeMap = new Map(localProducts.map((p) => [p.barcode.toLowerCase(), p]));

    for (const p of products) {
      const existingById = localProdIdMap.get(p.id);
      const existingByBarcode = p.barcode ? localBarcodeMap.get(p.barcode.toLowerCase()) : undefined;

      if (existingById || existingByBarcode) {
        result.counts.productsToUpdate++;
        const target = existingById || existingByBarcode!;
        if (target.price !== p.price) {
          result.conflicts.push(`Price change for "${p.name}": ₱${target.price} ➔ ₱${p.price}`);
        }
      } else {
        result.counts.productsToAdd++;
      }
    }

    const localCategories = await getAllCategories();
    const localCatIds = new Set(localCategories.map((c) => c.id));
    for (const c of categories) {
      if (!localCatIds.has(c.id)) {
        result.counts.categoriesToAdd++;
      }
    }

    if (result.parsedData.transactions) {
      const localTxs = await getAllTransactions();
      const localTxIds = new Set(localTxs.map((t) => t.id));
      for (const t of result.parsedData.transactions) {
        if (localTxIds.has(t.id)) {
          result.counts.transactionsDuplicate++;
        } else {
          result.counts.transactionsToAdd++;
        }
      }
    }

    result.valid = true;
    return result;
  } catch (err: any) {
    console.error('ZIP inspection error:', err);
    result.error = err.message || 'Corrupted or invalid ZIP archive file.';
    return result;
  }
}

// ============================================================================
// 3. IMPORT EXECUTION ENGINE
// ============================================================================

/**
 * Execute Products-Only Transfer Import
 * CRITICAL RULE: Updates product info/prices WITHOUT overwriting Cashier's local stock levels!
 */
export async function executeProductsOnlyImport(
  inspection: ZipInspection
): Promise<ImportExecutionResult> {
  const db = await openDB();
  let productsAdded = 0;
  let productsUpdated = 0;
  let categoriesAdded = 0;
  let imagesRestored = 0;

  const zipProducts = inspection.parsedData.products || [];
  const zipCategories = inspection.parsedData.categories || [];
  const imagesMap = inspection.parsedData.imagesMap || new Map<string, Blob>();

  // 1. Import Categories
  const existingCats = await getAllCategories(db);
  const existingCatIds = new Set(existingCats.map((c) => c.id));
  for (const cat of zipCategories) {
    if (cat && cat.id && cat.name && !existingCatIds.has(cat.id)) {
      await saveCategory(cat, db);
      categoriesAdded++;
    }
  }

  // 2. Import Products with Inventory Protection
  const localProducts = await getAllProducts(db);
  const localProdIdMap = new Map(localProducts.map((p) => [p.id, p]));
  const localBarcodeMap = new Map(
    localProducts.filter((p) => p.barcode).map((p) => [p.barcode.toLowerCase(), p])
  );

  for (const zipProd of zipProducts) {
    if (!zipProd || !zipProd.id || !zipProd.name) continue;

    const existingById = localProdIdMap.get(zipProd.id);
    const existingByBarcode = zipProd.barcode ? localBarcodeMap.get(zipProd.barcode.toLowerCase()) : undefined;
    const existing = existingById || existingByBarcode;

    // Retrieve product image from extracted zip imagesMap if available
    let imageBlob: Blob | undefined = undefined;
    if (imagesMap.has(zipProd.id)) {
      imageBlob = imagesMap.get(zipProd.id);
      imagesRestored++;
    } else if (typeof zipProd.image === 'string' && zipProd.image.startsWith('data:')) {
      try {
        imageBlob = base64ToBlob(zipProd.image);
        imagesRestored++;
      } catch (e) {
        // ignore
      }
    } else if (existing?.image) {
      imageBlob = existing.image as Blob;
    }

    if (existing) {
      // UPDATE EXISTING PRODUCT: Update details & prices, KEEP Cashier's local stock quantity intact!
      const updatedProduct: Product = {
        ...existing,
        name: zipProd.name,
        sku: zipProd.sku || existing.sku,
        barcode: zipProd.barcode || existing.barcode,
        price: zipProd.price ?? existing.price,
        cost: zipProd.cost ?? existing.cost,
        categoryId: zipProd.categoryId || existing.categoryId,
        description: zipProd.description || existing.description,
        image: imageBlob || existing.image,
        stock: existing.stock, // PRESERVE EXISTING LOCAL STOCK!
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
      await saveProduct(updatedProduct, db);
      productsUpdated++;
    } else {
      // BRAND NEW PRODUCT: Add new product to Cashier's POS
      const newProduct: Product = {
        ...zipProd,
        stock: zipProd.stock ?? 0, // Opening stock for new item
        image: imageBlob,
        createdAt: zipProd.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
      await saveProduct(newProduct, db);
      productsAdded++;
    }
  }

  return {
    success: true,
    message: `Products Transfer imported successfully! Added ${productsAdded} new products, updated ${productsUpdated} existing products, and restored ${imagesRestored} product images. Inventory stock levels were protected.`,
    summary: {
      productsAdded,
      productsUpdated,
      categoriesAdded,
      transactionsAdded: 0,
      transactionsSkipped: 0,
      stockMovementsAdded: 0,
      customersAdded: 0,
      cashiersAdded: 0,
      imagesRestored,
    },
  };
}

/**
 * Execute Sales Transfer Import
 * Merges sales records from Cashier -> Admin without duplicating transactions
 */
export async function executeSalesTransferImport(
  inspection: ZipInspection
): Promise<ImportExecutionResult> {
  const db = await openDB();
  let transactionsAdded = 0;
  let transactionsSkipped = 0;
  let stockMovementsAdded = 0;
  let customersAdded = 0;

  const zipTxs = inspection.parsedData.transactions || [];
  const zipStockMovements = inspection.parsedData.stockMovements || [];
  const zipCustomers = inspection.parsedData.customers || [];

  // Merge Sales Transactions by unique ID
  const localTxs = await getAllTransactions();
  const localTxIds = new Set(localTxs.map((t) => t.id));

  for (const tx of zipTxs) {
    if (tx && tx.id) {
      if (!localTxIds.has(tx.id)) {
        await new Promise<void>((resolve, reject) => {
          const idbTx = db.transaction('transactions', 'readwrite');
          const store = idbTx.objectStore('transactions');
          const req = store.put({ ...tx, syncStatus: 'synced' });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        transactionsAdded++;
      } else {
        transactionsSkipped++;
      }
    }
  }

  // Merge Stock Movements by unique ID
  const localSMs = await getAllStockMovements(db);
  const localSMIds = new Set(localSMs.map((s) => s.id));

  for (const sm of zipStockMovements) {
    if (sm && sm.id && !localSMIds.has(sm.id)) {
      await new Promise<void>((resolve, reject) => {
        const idbTx = db.transaction('stock_movements', 'readwrite');
        const store = idbTx.objectStore('stock_movements');
        const req = store.put({ ...sm, syncStatus: 'synced' });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      stockMovementsAdded++;
    }
  }

  // Merge Customers
  const localCusts = await getAllCustomers();
  const localCustIds = new Set(localCusts.map((c) => c.id));

  for (const cust of zipCustomers) {
    if (cust && cust.id && !localCustIds.has(cust.id)) {
      await saveCustomer(cust, db);
      customersAdded++;
    }
  }

  return {
    success: true,
    message: `Sales Transfer imported successfully! Restored ${transactionsAdded} sales records (${transactionsSkipped} duplicates skipped) and ${stockMovementsAdded} stock movements.`,
    summary: {
      productsAdded: 0,
      productsUpdated: 0,
      categoriesAdded: 0,
      transactionsAdded,
      transactionsSkipped,
      stockMovementsAdded,
      customersAdded,
      cashiersAdded: 0,
      imagesRestored: 0,
    },
  };
}

/**
 * Execute Full Restore
 * Restores complete business dataset while strictly preserving receiving device's local Admin PIN & recovery keys
 */
export async function executeFullRestore(
  inspection: ZipInspection,
  createSafetyBackup = true
): Promise<ImportExecutionResult> {
  const db = await openDB();

  if (createSafetyBackup) {
    await createPreMergeSafetySnapshot();
  }

  // Preserve local authentication credentials
  const currentSettings = await getSettings(db);

  let productsAdded = 0;
  let productsUpdated = 0;
  let categoriesAdded = 0;
  let transactionsAdded = 0;
  let customersAdded = 0;
  let cashiersAdded = 0;
  let stockMovementsAdded = 0;
  let historyAdded = 0;
  let resetRequestsAdded = 0;
  let imagesRestored = 0;

  const parsed = inspection.parsedData;
  const imagesMap = parsed.imagesMap || new Map<string, Blob>();

  // Restore Categories (Merge: Add if not exists)
  if (Array.isArray(parsed.categories)) {
    const localCategories = await getAllCategories(db);
    const localCatIds = new Set(localCategories.map((c) => c.id));
    for (const cat of parsed.categories) {
      if (cat && cat.id && cat.name) {
        if (!localCatIds.has(cat.id)) {
          await saveCategory(cat, db);
          categoriesAdded++;
        }
      }
    }
  }

  // Pre-fetch all local transactions, stock movements, etc. to protect and merge stocks correctly
  const localTransactions = await getAllTransactions();
  const localTxIds = new Set(localTransactions.map(t => t.id));

  const localStockMovements = await getAllStockMovements(db);
  const localSMIds = new Set(localStockMovements.map(s => s.id));

  const backupSMIds = new Set((parsed.stockMovements || []).map(s => s.id));

  // Index local stock movements by product ID to adjust restored stock accurately
  const localMovementsByProduct = new Map<string, StockMovement[]>();
  for (const m of localStockMovements) {
    if (!localMovementsByProduct.has(m.productId)) {
      localMovementsByProduct.set(m.productId, []);
    }
    localMovementsByProduct.get(m.productId)!.push(m);
  }

  // Restore Products with extracted image Blobs and Smart Stock Protection
  if (Array.isArray(parsed.products)) {
    const localProducts = await getAllProducts(db);
    const localProdIds = new Set(localProducts.map(p => p.id));

    for (const prod of parsed.products) {
      if (prod && prod.id && prod.name) {
        let imageBlob: Blob | undefined = undefined;
        if (imagesMap.has(prod.id)) {
          imageBlob = imagesMap.get(prod.id);
          imagesRestored++;
        } else if (typeof prod.image === 'string' && prod.image.startsWith('data:')) {
          try {
            imageBlob = base64ToBlob(prod.image);
            imagesRestored++;
          } catch (e) {
            // ignore
          }
        }

        // SMART INVENTORY ALIGNMENT:
        // Find any local stock movements (e.g. sales, returns, restocks) that are NOT present in the backup.
        // These represent the sales/events that occurred after the backup was taken (even if the product was deleted locally).
        // We apply their quantity changes to the backup stock level to get the correct current stock!
        const pMovements = localMovementsByProduct.get(prod.id) || [];
        const newMovements = pMovements.filter(m => !backupSMIds.has(m.id));
        const localAdjustment = newMovements.reduce((sum, m) => sum + m.quantityChange, 0);
        let finalStock = prod.stock + localAdjustment;
        if (finalStock < 0) finalStock = 0;

        const existsLocally = localProdIds.has(prod.id);
        if (existsLocally) {
          productsUpdated++;
        } else {
          productsAdded++;
        }

        const productToSave: Product = {
          ...prod,
          stock: finalStock,
          image: imageBlob || prod.image,
          syncStatus: 'synced',
        };
        await saveProduct(productToSave, db);
      }
    }
  }

  // Restore Transactions (Merge: Add if not exists)
  if (Array.isArray(parsed.transactions)) {
    for (const tx of parsed.transactions) {
      if (tx && tx.id && !localTxIds.has(tx.id)) {
        await new Promise<void>((resolve, reject) => {
          const idbTx = db.transaction('transactions', 'readwrite');
          const store = idbTx.objectStore('transactions');
          const req = store.put({ ...tx, syncStatus: 'synced' });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        transactionsAdded++;
      }
    }
  }

  // Restore Stock Movements (Merge: Add if not exists)
  if (Array.isArray(parsed.stockMovements)) {
    for (const sm of parsed.stockMovements) {
      if (sm && sm.id && !localSMIds.has(sm.id)) {
        await new Promise<void>((resolve, reject) => {
          const idbTx = db.transaction('stock_movements', 'readwrite');
          const store = idbTx.objectStore('stock_movements');
          const req = store.put({ ...sm, syncStatus: 'synced' });
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        stockMovementsAdded++;
      }
    }
  }

  // Restore Customers (Merge: Add if not exists)
  if (Array.isArray(parsed.customers)) {
    const localCusts = await getAllCustomers();
    const localCustIds = new Set(localCusts.map(c => c.id));
    for (const cust of parsed.customers) {
      if (cust && cust.id && !localCustIds.has(cust.id)) {
        await saveCustomer(cust, db);
        customersAdded++;
      }
    }
  }

  // Restore Cashiers (Merge: Add if not exists)
  if (Array.isArray(parsed.cashiers)) {
    const localCashiers = await getAllCashiers(db);
    const localCashierIds = new Set(localCashiers.map(c => c.id));
    for (const cashier of parsed.cashiers) {
      if (cashier && cashier.id && !localCashierIds.has(cashier.id)) {
        await saveCashier(cashier, db);
        cashiersAdded++;
      }
    }
  }

  // Restore Product History Logs (Merge: Add if not exists)
  if (Array.isArray(parsed.productHistory)) {
    const localHistory = await getAllProductHistory();
    const localHistIds = new Set(localHistory.map(h => h.id));
    for (const log of parsed.productHistory) {
      if (log && log.id && !localHistIds.has(log.id)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('product_history', 'readwrite');
          const store = tx.objectStore('product_history');
          const req = store.put(log);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        historyAdded++;
      }
    }
  }

  // Restore Reset Requests (Merge: Add if not exists)
  if (Array.isArray(parsed.resetRequests)) {
    const localResetRequests = await getAllResetRequests(db);
    const localReqIds = new Set(localResetRequests.map(r => r.id));
    for (const req of parsed.resetRequests) {
      if (req && req.id && !localReqIds.has(req.id)) {
        await saveResetRequest(req);
        resetRequestsAdded++;
      }
    }
  }

  // Restore Settings while strictly preserving receiving device's local Admin PIN & Recovery credentials
  if (parsed.settings) {
    const safeSettingsToSave: Settings = {
      ...parsed.settings,
      adminPin: currentSettings.adminPin || parsed.settings.adminPin || '',
      adminPinHash: currentSettings.adminPinHash,
      adminPinSalt: currentSettings.adminPinSalt,
      recoveryCodeHash: currentSettings.recoveryCodeHash,
      recoveryCodeSalt: currentSettings.recoveryCodeSalt,
      recoveryCodeCreatedAt: currentSettings.recoveryCodeCreatedAt,
      recoveryToken: currentSettings.recoveryToken,
      failedRecoveryAttempts: currentSettings.failedRecoveryAttempts,
      recoveryLockoutUntil: currentSettings.recoveryLockoutUntil,
      isSetup: currentSettings.isSetup !== undefined ? currentSettings.isSetup : true,
    };
    await saveSettings(safeSettingsToSave, db);
  }

  return {
    success: true,
    message: `Merge Restore completed! Merged ${productsAdded} new products, updated ${productsUpdated} existing products (aligned with actual sales), merged ${transactionsAdded} sales, and restored ${imagesRestored} product images. All other business logs were fully preserved.`,
    summary: {
      productsAdded,
      productsUpdated,
      categoriesAdded,
      transactionsAdded,
      transactionsSkipped: 0,
      stockMovementsAdded,
      customersAdded,
      cashiersAdded,
      imagesRestored,
    },
  };
}

