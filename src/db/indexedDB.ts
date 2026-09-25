/**
 * IndexedDB wrapper for Mini Universal POS
 * Database Name: MiniUniversalPOS
 * Stores: products, categories, transactions, customers, users, settings
 */

const DB_NAME = 'MiniUniversalPOS';
const DB_VERSION = 2;

export interface Category {
  id: string;
  name: string;
  description?: string;
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
      } else if (tx) {
        tx.objectStore('products').clear();
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
export async function clearAllData(): Promise<void> {
  try {
    const db = await openDB();
    const stores = ['products', 'categories', 'transactions', 'customers', 'settings'];
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
  } catch (e) {
    console.debug('Clear stores note:', e);
  }

  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
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
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}
