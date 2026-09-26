/**
 * IndexedDB wrapper for Mini Universal POS
 * Database Name: MiniUniversalPOS
 * Stores: products, categories, transactions, customers, users, settings
 */

const DB_NAME = 'MiniUniversalPOS';
const DB_VERSION = 3;

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export type ProductHistoryAction = 'add' | 'edit' | 'delete' | 'restock';

export interface ProductHistoryLog {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  sku: string;
  action: ProductHistoryAction;
  timestamp: string; // ISO string
  details: string;
  stockBefore?: number;
  stockAfter?: number;
  stockAdded?: number;
  oldPrice?: number;
  newPrice?: number;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  price: number;
  cost?: number;
  stock: number;
  categoryId: string;
  description?: string;
  image?: Blob | string; // Blob in IDDB, base64 in JSON backup
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  receiptNo: string;
  date: string; // ISO string
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment: number;
  change: number;
  customerId?: string;
  customerName?: string;
  cashier?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  createdAt: string;
}

export interface Settings {
  storeName: string;
  storeAddress: string;
  storeContact: string;
  receiptFooter: string;
  currency: string;
  taxRate: number;
  lowStockThreshold: number;
  adminPin: string;
  darkMode: boolean;
  ownerName: string;
  animatedBackground?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Mini Universal POS Store',
  storeAddress: '123 Business Rd, Metro Manila, Philippines',
  storeContact: '+63 912 345 6789',
  receiptFooter: 'Thank you for your purchase! Please come again.',
  currency: '₱',
  taxRate: 0,
  lowStockThreshold: 10,
  adminPin: '1234',
  darkMode: false,
  ownerName: 'Jerome Urbano',
  animatedBackground: true,
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Beverages', description: 'Soft drinks, juices, water' },
  { id: 'cat-2', name: 'Snacks & Sweets', description: 'Chips, chocolates, biscuits' },
  { id: 'cat-3', name: 'Grocery & Staples', description: 'Rice, canned goods, condiments' },
  { id: 'cat-4', name: 'Personal Care', description: 'Soap, shampoo, toothpaste' },
];

export const DEFAULT_PRODUCTS: Omit<Product, 'createdAt' | 'updatedAt'>[] = [];

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;

      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: true });
        productStore.createIndex('sku', 'sku', { unique: false });
        productStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('product_history')) {
        const histStore = db.createObjectStore('product_history', { keyPath: 'id' });
        histStore.createIndex('timestamp', 'timestamp', { unique: false });
        histStore.createIndex('productId', 'productId', { unique: false });
        histStore.createIndex('action', 'action', { unique: false });
      }
    };
  });
}

// Seed initial data if empty
export async function seedInitialData(): Promise<void> {
  const db = await openDB();
  
  // Check settings
  const settings = await getSettings(db);
  if (!settings) {
    await saveSettings(DEFAULT_SETTINGS, db);
  }

  // Check categories
  const categories = await getAllCategories(db);
  if (categories.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await saveCategory(cat, db);
    }
  }

  // Check products
  const products = await getAllProducts(db);
  if (products.length === 0) {
    const now = new Date().toISOString();
    for (const p of DEFAULT_PRODUCTS) {
      const fullProd: Product = {
        ...p,
        createdAt: now,
        updatedAt: now,
      };
      await saveProduct(fullProd, db);
    }
  }
}

// Generic helper for transactions
export async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  return { store, tx };
}

// --- Categories ---
export async function getAllCategories(dbInstance?: IDBDatabase): Promise<Category[]> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCategory(category: Category, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const request = store.put(category);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Products ---
export async function getAllProducts(dbInstance?: IDBDatabase): Promise<Product[]> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const index = store.index('barcode');
    const request = index.get(barcode);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProduct(product: Product, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const request = store.put(product);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const request = store.delete(id);
    request.onsuccess = () => {};
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Generate unique barcode (e.g. 2000 + random 8 digits)
export async function generateUniqueBarcode(): Promise<string> {
  const products = await getAllProducts();
  const barcodes = new Set(products.map(p => p.barcode));
  
  let barcode = '';
  do {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    barcode = `2000${randomNum}`;
  } while (barcodes.has(barcode));

  return barcode;
}

// --- Transactions ---
export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort newest first
      const results = request.result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'products'], 'readwrite');
    
    // Save transaction
    const txStore = tx.objectStore('transactions');
    txStore.put(transaction);

    // Update product stocks
    const productStore = tx.objectStore('products');
    let completed = 0;
    const items = transaction.items;

    if (items.length === 0) {
      tx.oncomplete = () => resolve();
    }

    items.forEach(item => {
      const getReq = productStore.get(item.productId);
      getReq.onsuccess = () => {
        const prod = getReq.result as Product;
        if (prod) {
          prod.stock = Math.max(0, prod.stock - item.quantity);
          prod.updatedAt = new Date().toISOString();
          productStore.put(prod);
        }
        completed++;
        if (completed === items.length) {
          // done
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Customers ---
export async function getAllCustomers(): Promise<Customer[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    const request = store.put(customer);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Settings ---
export async function getSettings(dbInstance?: IDBDatabase): Promise<Settings> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('app_settings');
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : DEFAULT_SETTINGS);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSettings(settings: Settings, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key: 'app_settings', value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear all data
export async function clearAllData(preserveSettings: boolean = false): Promise<void> {
  const db = await openDB();
  const stores = ['products', 'categories', 'transactions', 'customers', 'product_history'];
  if (!preserveSettings) {
    stores.push('settings');
  }

  const existingStores = stores.filter((s) => db.objectStoreNames.contains(s));
  if (existingStores.length === 0) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      const tx = db.transaction(existingStores, 'readwrite');
      for (const storeName of existingStores) {
        tx.objectStore(storeName).clear();
      }
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

// --- Product History & Restock Logging ---
export async function addProductHistoryLog(
  log: Omit<ProductHistoryLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains('product_history')) {
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('product_history', 'readwrite');
        const store = tx.objectStore('product_history');
        const fullLog: ProductHistoryLog = {
          id: log.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: log.timestamp || new Date().toISOString(),
          ...log,
        };
        store.put(fullLog);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        console.warn('Logging product history skipped:', e);
        resolve();
      }
    });
  } catch (err) {
    console.warn('Failed to open DB for product history log:', err);
  }
}

export async function getAllProductHistory(): Promise<ProductHistoryLog[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains('product_history')) {
      return [];
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('product_history', 'readonly');
        const store = tx.objectStore('product_history');
        const req = store.getAll();
        req.onsuccess = () => {
          const results = (req.result || []) as ProductHistoryLog[];
          results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(results);
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  } catch (err) {
    return [];
  }
}

export async function clearProductHistory(): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains('product_history')) {
      return;
    }
    return new Promise((resolve) => {
      const tx = db.transaction('product_history', 'readwrite');
      const store = tx.objectStore('product_history');
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    // silent
  }
}

// Blob to Base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Base64 to Blob
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0]?.split(':')[1] || 'image/png';
  const raw = window.atob(parts[1] || '');
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export interface POSBackupData {
  app: string;
  version: number;
  exportedAt: string;
  metadata?: {
    productCount: number;
    categoryCount: number;
    transactionCount: number;
    customerCount: number;
    historyCount?: number;
    storeName?: string;
  };
  settings?: Settings;
  categories?: Category[];
  products?: (Omit<Product, 'image'> & { image?: string })[];
  transactions?: Transaction[];
  customers?: Customer[];
  productHistory?: ProductHistoryLog[];
}

export interface ImportSummary {
  productsCount: number;
  categoriesCount: number;
  transactionsCount: number;
  customersCount: number;
  settingsRestored: boolean;
}

/**
 * Export all IndexedDB data to a structured JSON file and trigger browser download
 */
export async function exportAllDataAsJSON(): Promise<POSBackupData> {
  const db = await openDB();
  const settings = await getSettings(db);
  const categories = await getAllCategories(db);
  const rawProducts = await getAllProducts(db);
  const transactions = await getAllTransactions();
  const customers = await getAllCustomers();
  const productHistory = await getAllProductHistory();

  // Convert product image Blobs into Base64 strings for JSON portability
  const serializedProducts = await Promise.all(
    rawProducts.map(async (prod) => {
      let imageBase64: string | undefined = undefined;
      if (prod.image instanceof Blob) {
        try {
          imageBase64 = await blobToBase64(prod.image);
        } catch (e) {
          console.warn('Failed to convert image for product:', prod.name, e);
        }
      } else if (typeof prod.image === 'string') {
        imageBase64 = prod.image;
      }
      return {
        ...prod,
        image: imageBase64,
      };
    })
  );

  const backupData: POSBackupData = {
    app: 'MiniUniversalPOS',
    version: 3,
    exportedAt: new Date().toISOString(),
    metadata: {
      productCount: serializedProducts.length,
      categoryCount: categories.length,
      transactionCount: transactions.length,
      customerCount: customers.length,
      historyCount: productHistory.length,
      storeName: settings.storeName || 'Mini POS',
    },
    settings,
    categories,
    products: serializedProducts,
    transactions,
    customers,
    productHistory,
  };

  // Create JSON string and trigger client download
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeStoreName = (settings.storeName || 'MiniPOS')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = downloadUrl;
  a.download = `${safeStoreName}-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  // Store last backup time in localStorage for UI indicator
  try {
    localStorage.setItem('pos_last_backup_date', new Date().toISOString());
  } catch (e) {
    console.debug('LocalStorage note:', e);
  }

  return backupData;
}

/**
 * Validate parsed backup JSON
 */
export function validateBackupData(data: any): { valid: boolean; error?: string; backup?: POSBackupData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File is not a valid JSON object.' };
  }

  // Must have at least products, categories, or settings
  const hasProducts = Array.isArray(data.products);
  const hasCategories = Array.isArray(data.categories);
  const hasSettings = data.settings && typeof data.settings === 'object';
  const hasTransactions = Array.isArray(data.transactions);

  if (!hasProducts && !hasCategories && !hasSettings && !hasTransactions) {
    return { valid: false, error: 'Backup file does not contain any recognizable POS data (products, categories, or settings).' };
  }

  return { valid: true, backup: data as POSBackupData };
}

/**
 * Import and restore backup data into IndexedDB
 * @param backup The parsed backup data
 * @param mode 'replace' clears existing data first; 'merge' adds/updates records
 */
export async function importDataFromJSON(
  backup: POSBackupData,
  mode: 'replace' | 'merge' = 'replace'
): Promise<ImportSummary> {
  const db = await openDB();

  // If replace mode, clear store tables safely using clear() inside transactions
  if (mode === 'replace') {
    const storesToClear = ['products', 'categories', 'transactions', 'customers', 'settings', 'product_history'];
    for (const storeName of storesToClear) {
      if (db.objectStoreNames.contains(storeName)) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }
  }

  let categoriesCount = 0;
  let productsCount = 0;
  let transactionsCount = 0;
  let customersCount = 0;
  let settingsRestored = false;

  // Restore Settings
  if (backup.settings) {
    await saveSettings(backup.settings, db);
    settingsRestored = true;
  }

  // Restore Categories
  if (Array.isArray(backup.categories)) {
    for (const cat of backup.categories) {
      if (cat && cat.id && cat.name) {
        await saveCategory(cat, db);
        categoriesCount++;
      }
    }
  }

  // Restore Products
  if (Array.isArray(backup.products)) {
    for (const item of backup.products) {
      if (item && item.id && item.name) {
        let imageBlob: Blob | undefined = undefined;
        if (typeof item.image === 'string' && item.image.startsWith('data:')) {
          try {
            imageBlob = base64ToBlob(item.image);
          } catch (e) {
            console.warn('Image convert skipped for:', item.name);
          }
        }
        const productToSave: Product = {
          ...item,
          image: imageBlob || item.image,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveProduct(productToSave, db);
        productsCount++;
      }
    }
  }

  // Restore Transactions DIRECTLY into the transactions object store
  // NOTE: We do NOT use saveTransaction() here because saveTransaction() deducts product stock.
  // In a restore, product stock is already current in the products store!
  if (Array.isArray(backup.transactions)) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const t of backup.transactions!) {
        if (t && t.id) {
          store.put(t);
          transactionsCount++;
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Restore Customers
  if (Array.isArray(backup.customers)) {
    for (const cust of backup.customers) {
      if (cust && cust.id && cust.name) {
        await saveCustomer(cust);
        customersCount++;
      }
    }
  }

  // Restore Product History Logs
  if (Array.isArray(backup.productHistory) && db.objectStoreNames.contains('product_history')) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('product_history', 'readwrite');
        const store = tx.objectStore('product_history');
        for (const log of backup.productHistory!) {
          if (log && log.id) {
            store.put(log);
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  return {
    productsCount,
    categoriesCount,
    transactionsCount,
    customersCount,
    settingsRestored,
  };
}
