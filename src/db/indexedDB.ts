/**
 * IndexedDB wrapper for Mini Universal POS
 * Database Name: MiniUniversalPOS
 * Stores: products, categories, transactions, customers, users, settings,
 *         cashiers, stock_movements, reset_requests, product_history
 */

const DB_NAME = 'MiniUniversalPOS';
const DB_VERSION = 5;

export interface StoreAccount {
  id: string; // e.g. 'store-main', 'store-1728320400000'
  storeName: string;
  ownerName: string;
  storeAddress?: string;
  storeContact?: string;
  adminPinHash?: string;
  adminPinSalt?: string;
  recoveryCodeHash?: string;
  recoveryCodeSalt?: string;
  recoveryCodeCreatedAt?: string;
  createdAt: string;
  isSetup: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  storeId?: string;
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
  storeId?: string;
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
  syncStatus?: 'synced' | 'pending' | 'syncing';
  storeId?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface TransactionItem {
  productId: string;
  name: string;
  price: number; // Unit price frozen at the exact time of purchase
  quantity: number;
  subtotal: number;
  image?: Blob | string;
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
  status?: 'completed' | 'refunded';
  syncStatus?: 'synced' | 'pending' | 'syncing';
  storeId?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  description?: string;
  createdAt: string;
  storeId?: string;
}

export type StockMovementType = 'restock' | 'sale' | 'adjustment' | 'return' | 'initial';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number; // e.g. +20 for restock, -2 for sale
  type: StockMovementType;
  user: string;
  role: 'admin' | 'cashier';
  timestamp: string; // ISO string
  syncStatus: 'synced' | 'pending' | 'syncing';
  referenceId?: string; // receiptNo or adjustment memo
  stockBefore?: number;
  stockAfter?: number;
  storeId?: string;
}

export interface Cashier {
  id: string;
  name: string;
  pin: string;
  role: 'cashier';
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  storeId?: string;
}

export interface CashierResetRequest {
  id: string;
  cashierId: string;
  cashierName: string;
  status: 'pending' | 'resolved';
  requestedAt: string; // ISO string
  resolvedAt?: string;
  temporaryPin?: string;
  syncStatus: 'synced' | 'pending' | 'syncing';
  notes?: string;
  storeId?: string;
}

export interface Settings {
  storeId?: string;
  storeName: string;
  storeAddress: string;
  storeContact: string;
  storeTin?: string;
  receiptHeader?: string;
  receiptFooter: string;
  currency: string;
  taxRate: number;
  lowStockThreshold: number;
  adminPin: string;
  adminPinHash?: string;
  adminPinSalt?: string;
  recoveryCodeHash?: string;
  recoveryCodeSalt?: string;
  recoveryCodeCreatedAt?: string;
  recoveryToken?: string;
  failedRecoveryAttempts?: number;
  recoveryLockoutUntil?: string;
  darkMode: boolean;
  ownerName: string;
  animatedBackground?: boolean;
  receiptPaperSize?: '80mm' | '58mm' | 'full';
  showBarcodeOnReceipt?: boolean;
  showCashierOnReceipt?: boolean;
  showLogoOnReceipt?: boolean;
  showTaxOnReceipt?: boolean;
  showCustomerOnReceipt?: boolean;
  receiptFontFamily?: 'mono' | 'sans';
  autoLockMinutes?: number; // 0 = disabled, default 5 minutes
  cashierCanViewAllSales?: boolean;
  lastSyncTime?: string;
  isSetup?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  storeName: '',
  storeAddress: '123 Business Rd, Metro Manila, Philippines',
  storeContact: '+63 912 345 6789',
  storeTin: '123-456-789-000',
  receiptHeader: 'Official Sales Receipt • Thank you for shopping with us!',
  receiptFooter: 'Thank you for your purchase! Goods sold are exchangeable within 7 days.',
  currency: '₱',
  taxRate: 0,
  lowStockThreshold: 10,
  adminPin: '',
  recoveryToken: '',
  darkMode: false,
  ownerName: '',
  isSetup: false,
  animatedBackground: true,
  receiptPaperSize: '80mm',
  showBarcodeOnReceipt: true,
  showCashierOnReceipt: true,
  showLogoOnReceipt: true,
  showTaxOnReceipt: true,
  showCustomerOnReceipt: true,
  receiptFontFamily: 'mono',
  autoLockMinutes: 5,
  cashierCanViewAllSales: false,
};

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Beverages', description: 'Soft drinks, juices, water' },
  { id: 'cat-2', name: 'Snacks & Sweets', description: 'Chips, chocolates, biscuits' },
  { id: 'cat-3', name: 'Grocery & Staples', description: 'Rice, canned goods, condiments' },
  { id: 'cat-4', name: 'Personal Care', description: 'Soap, shampoo, toothpaste' },
];

export const DEFAULT_CASHIERS: Cashier[] = [];

export const DEFAULT_PRODUCTS: Omit<Product, 'createdAt' | 'updatedAt'>[] = [];

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

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
        txStore.createIndex('syncStatus', 'syncStatus', { unique: false });
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

      if (!db.objectStoreNames.contains('cashiers')) {
        const cashierStore = db.createObjectStore('cashiers', { keyPath: 'id' });
        cashierStore.createIndex('name', 'name', { unique: false });
        cashierStore.createIndex('active', 'active', { unique: false });
      }

      if (!db.objectStoreNames.contains('stock_movements')) {
        const smStore = db.createObjectStore('stock_movements', { keyPath: 'id' });
        smStore.createIndex('timestamp', 'timestamp', { unique: false });
        smStore.createIndex('productId', 'productId', { unique: false });
        smStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        smStore.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('reset_requests')) {
        const reqStore = db.createObjectStore('reset_requests', { keyPath: 'id' });
        reqStore.createIndex('status', 'status', { unique: false });
        reqStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        reqStore.createIndex('requestedAt', 'requestedAt', { unique: false });
      }
    };
  });
}

// Seed initial data if brand new database
export async function seedInitialData(): Promise<void> {
  const db = await openDB();

  // Check store accounts
  const accounts = await getAllStoreAccounts(db);
  if (accounts.length > 0) {
    // Existing store(s) already configured; do not overwrite
    return;
  }

  // Check settings
  const settings = await getSettings(undefined, db);
  if (!settings || !settings.isSetup) {
    // Check categories
    const categories = await getAllCategories(db);
    if (categories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await saveCategory(cat, db);
      }
    }

    // Check cashiers
    const cashiers = await getAllCashiers(undefined, db);
    if (cashiers.length === 0) {
      for (const c of DEFAULT_CASHIERS) {
        await saveCashier(c, db);
      }
    }

    // Check products
    const products = await getAllProducts(undefined, db);
    if (products.length === 0) {
      const now = new Date().toISOString();
      for (const p of DEFAULT_PRODUCTS) {
        const fullProd: Product = {
          ...p,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'synced',
        };
        await saveProduct(fullProd, db);
      }
    }
  }
}

// Generic helper for transactions
export async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  return { store, tx };
}

// --- Categories ---
export async function getAllCategories(dbInstance?: IDBDatabase): Promise<Category[]> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCategory(category: Category, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || (await openDB());
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
export async function getAllProducts(
  storeIdOrDb?: string | IDBDatabase,
  dbInstance?: IDBDatabase
): Promise<Product[]> {
  let targetStoreId: string | undefined = undefined;
  let dbToUse: IDBDatabase | undefined = undefined;

  if (typeof storeIdOrDb === 'string') {
    targetStoreId = storeIdOrDb;
    dbToUse = dbInstance;
  } else if (storeIdOrDb && typeof storeIdOrDb === 'object') {
    dbToUse = storeIdOrDb as IDBDatabase;
  } else {
    dbToUse = dbInstance;
  }

  const db = dbToUse || (await openDB());
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => {
        let list = (request.result || []) as Product[];
        if (targetStoreId) {
          list = list.filter(
            (p) => p.storeId === targetStoreId || (!p.storeId && targetStoreId === 'store-main')
          );
        }
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      resolve([]);
    }
  });
}

export async function getProduct(id: string, dbInstance?: IDBDatabase): Promise<Product | undefined> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const request = store.get(id);
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
  const db = dbInstance || (await openDB());
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
  const barcodes = new Set(products.map((p) => p.barcode));

  let barcode = '';
  do {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    barcode = `2000${randomNum}`;
  } while (barcodes.has(barcode));

  return barcode;
}

// --- Transactions & Stock Movements ---
export async function getAllTransactions(
  storeIdOrDb?: string | IDBDatabase,
  dbInstance?: IDBDatabase
): Promise<Transaction[]> {
  let targetStoreId: string | undefined = undefined;
  let dbToUse: IDBDatabase | undefined = undefined;

  if (typeof storeIdOrDb === 'string') {
    targetStoreId = storeIdOrDb;
    dbToUse = dbInstance;
  } else if (storeIdOrDb && typeof storeIdOrDb === 'object') {
    dbToUse = storeIdOrDb as IDBDatabase;
  } else {
    dbToUse = dbInstance;
  }

  const db = dbToUse || (await openDB());
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('transactions', 'readonly');
      const store = tx.objectStore('transactions');
      const request = store.getAll();
      request.onsuccess = () => {
        let results = (request.result || []) as Transaction[];
        if (targetStoreId) {
          results = results.filter(
            (t) => !t.storeId || t.storeId === targetStoreId || (targetStoreId === 'store-main' && !t.storeId)
          );
        }
        results.sort(
          (a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Save transaction and automatically register individual stock movements
 * Unit prices are preserved inside transaction.items.
 */
export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await openDB();
  const txRecord: Transaction = {
    ...transaction,
    status: transaction.status || 'completed',
    syncStatus: transaction.syncStatus || 'pending',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'products', 'stock_movements'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const productStore = tx.objectStore('products');
    const movementStore = tx.objectStore('stock_movements');

    txStore.put(txRecord);

    const items = transaction.items || [];
    let completed = 0;

    if (items.length === 0) {
      tx.oncomplete = () => resolve();
    }

    items.forEach((item) => {
      const getReq = productStore.get(item.productId);
      getReq.onsuccess = () => {
        const prod = getReq.result as Product;
        if (prod) {
          const stockBefore = prod.stock;
          const stockAfter = Math.max(0, prod.stock - item.quantity);
          prod.stock = stockAfter;
          prod.updatedAt = new Date().toISOString();
          productStore.put(prod);

          // Add individual Stock Movement event
          const movementId = `sm-sale-${transaction.id}-${item.productId}-${Math.random().toString(36).slice(2, 6)}`;
          const movement: StockMovement = {
            id: movementId,
            productId: item.productId,
            productName: item.name,
            quantityChange: -item.quantity,
            type: 'sale',
            user: transaction.cashier || 'Cashier',
            role: 'cashier',
            timestamp: transaction.date || new Date().toISOString(),
            syncStatus: 'pending',
            referenceId: transaction.receiptNo,
            stockBefore,
            stockAfter,
          };
          movementStore.put(movement);
        }
        completed++;
        if (completed === items.length) {
          // All items handled
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Process a refund for a transaction.
 * 1. Mark transaction as refunded.
 * 2. Return quantities to product stock.
 * 3. Log stock movements.
 */
export async function processRefund(
  transactionId: string,
  user: string,
  role: 'admin' | 'cashier'
): Promise<void> {
  const db = await openDB();
  
  // 1. Get the transaction
  const txs = await getAllTransactions();
  const transaction = txs.find(t => t.id === transactionId);

  if (!transaction) throw new Error('Transaction not found');
  if (transaction.status === 'refunded') throw new Error('Transaction already refunded');

  // 2. Mark as refunded
  const updatedTx: Transaction = { 
    ...transaction, 
    status: 'refunded', 
    syncStatus: 'pending' 
  };
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.put(updatedTx);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 3. Return items to stock and log movements
  for (const item of transaction.items) {
    const product = await getProduct(item.productId, db);
    if (product) {
      const stockBefore = product.stock;
      const stockAfter = stockBefore + item.quantity;
      
      const updatedProduct: Product = {
        ...product,
        stock: stockAfter,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      };
      await saveProduct(updatedProduct, db);

      const movementId = `sm-refund-${transaction.id}-${item.productId}-${Math.random().toString(36).slice(2, 6)}`;
      const movement: StockMovement = {
        id: movementId,
        productId: item.productId,
        productName: item.name,
        quantityChange: item.quantity,
        type: 'return',
        user,
        role,
        timestamp: new Date().toISOString(),
        syncStatus: 'pending',
        referenceId: transaction.receiptNo,
        stockBefore,
        stockAfter,
      };
      
      await new Promise<void>((resolve, reject) => {
        const moveTx = db.transaction('stock_movements', 'readwrite');
        const store = moveTx.objectStore('stock_movements');
        const req = store.put(movement);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }
}

// --- Stock Movements ---
export async function getAllStockMovements(dbInstance?: IDBDatabase): Promise<StockMovement[]> {
  try {
    const db = dbInstance || (await openDB());
    if (!db.objectStoreNames.contains('stock_movements')) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('stock_movements', 'readonly');
      const store = tx.objectStore('stock_movements');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as StockMovement[];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function addStockMovement(
  movement: Omit<StockMovement, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<StockMovement> {
  const db = await openDB();
  const fullMovement: StockMovement = {
    id: movement.id || `sm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: movement.timestamp || new Date().toISOString(),
    ...movement,
    syncStatus: (movement as any).syncStatus || 'pending',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_movements', 'readwrite');
    const store = tx.objectStore('stock_movements');
    const req = store.put(fullMovement);
    req.onsuccess = () => resolve(fullMovement);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRawTransaction(transaction: Transaction, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.put(transaction);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveRawStockMovement(movement: StockMovement, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('stock_movements', 'readwrite');
    const store = tx.objectStore('stock_movements');
    const req = store.put(movement);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Cashiers ---
export async function getAllCashiers(
  storeIdOrDb?: string | IDBDatabase,
  dbInstance?: IDBDatabase
): Promise<Cashier[]> {
  try {
    let targetStoreId: string | undefined = undefined;
    let dbToUse: IDBDatabase | undefined = undefined;

    if (typeof storeIdOrDb === 'string') {
      targetStoreId = storeIdOrDb;
      dbToUse = dbInstance;
    } else if (storeIdOrDb && typeof storeIdOrDb === 'object') {
      dbToUse = storeIdOrDb as IDBDatabase;
    } else {
      dbToUse = dbInstance;
    }

    const db = dbToUse || (await openDB());
    if (!db.objectStoreNames.contains('cashiers')) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('cashiers', 'readonly');
      const store = tx.objectStore('cashiers');
      const req = store.getAll();
      req.onsuccess = () => {
        let list = (req.result || []) as Cashier[];
        if (targetStoreId) {
          list = list.filter(
            (c) => c.storeId === targetStoreId || (!c.storeId && targetStoreId === 'store-main')
          );
        }
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function saveCashier(cashier: Cashier, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cashiers', 'readwrite');
    const store = tx.objectStore('cashiers');
    const req = store.put(cashier);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCashier(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cashiers', 'readwrite');
    const store = tx.objectStore('cashiers');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Reset Requests ---
export async function getAllResetRequests(dbInstance?: IDBDatabase): Promise<CashierResetRequest[]> {
  try {
    const db = dbInstance || (await openDB());
    if (!db.objectStoreNames.contains('reset_requests')) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('reset_requests', 'readonly');
      const store = tx.objectStore('reset_requests');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as CashierResetRequest[];
        list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function saveResetRequest(reqData: CashierResetRequest): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reset_requests', 'readwrite');
    const store = tx.objectStore('reset_requests');
    const req = store.put(reqData);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function resolveResetRequest(
  requestId: string,
  temporaryPin: string
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['reset_requests', 'cashiers'], 'readwrite');
  const reqStore = tx.objectStore('reset_requests');
  const cashierStore = tx.objectStore('cashiers');

  return new Promise((resolve, reject) => {
    const getReq = reqStore.get(requestId);
    getReq.onsuccess = () => {
      const request = getReq.result as CashierResetRequest;
      if (request) {
        request.status = 'resolved';
        request.resolvedAt = new Date().toISOString();
        request.temporaryPin = temporaryPin;
        request.syncStatus = 'pending';
        reqStore.put(request);

        const getCashier = cashierStore.get(request.cashierId);
        getCashier.onsuccess = () => {
          const c = getCashier.result as Cashier;
          if (c) {
            c.pin = temporaryPin;
            c.updatedAt = new Date().toISOString();
            cashierStore.put(c);
          }
        };
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Pending Sync Collection & Updating ---
export interface PendingSyncPayload {
  transactions: Transaction[];
  stockMovements: StockMovement[];
  resetRequests: CashierResetRequest[];
  products: Product[];
  cashiers: Cashier[];
  categories: Category[];
  customers: Customer[];
  totalPendingCount: number;
}

export async function getPendingSyncPayload(): Promise<PendingSyncPayload> {
  const [allTx, allSm, allReq, allProd, allCash, allCat, allCust] = await Promise.all([
    getAllTransactions(),
    getAllStockMovements(),
    getAllResetRequests(),
    getAllProducts(),
    getAllCashiers(),
    getAllCategories(),
    getAllCustomers(),
  ]);

  const pendingTx = allTx.filter((t) => t.syncStatus === 'pending');
  const pendingSm = allSm.filter((s) => s.syncStatus === 'pending');
  const pendingReq = allReq.filter((r) => r.syncStatus === 'pending');

  return {
    transactions: pendingTx,
    stockMovements: pendingSm,
    resetRequests: pendingReq,
    products: allProd,
    cashiers: allCash,
    categories: allCat,
    customers: allCust,
    totalPendingCount: pendingTx.length + pendingSm.length + pendingReq.length,
  };
}

export async function markPendingDataAsSynced(
  syncedIds: { txIds?: string[]; smIds?: string[]; reqIds?: string[] }
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['transactions', 'stock_movements', 'reset_requests'], 'readwrite');
  const txStore = tx.objectStore('transactions');
  const smStore = tx.objectStore('stock_movements');
  const reqStore = tx.objectStore('reset_requests');

  return new Promise((resolve, reject) => {
    (syncedIds.txIds || []).forEach((id) => {
      const req = txStore.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.syncStatus = 'synced';
          txStore.put(req.result);
        }
      };
    });

    (syncedIds.smIds || []).forEach((id) => {
      const req = smStore.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.syncStatus = 'synced';
          smStore.put(req.result);
        }
      };
    });

    (syncedIds.reqIds || []).forEach((id) => {
      const req = reqStore.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.syncStatus = 'synced';
          reqStore.put(req.result);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Customers ---
export async function getAllCustomers(dbInstance?: IDBDatabase): Promise<Customer[]> {
  const db = dbInstance || (await openDB());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomer(customer: Customer, dbInstance?: IDBDatabase): Promise<void> {
  const db = dbInstance || (await openDB());
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

// --- Store Accounts ---
const STORE_LIST_LOCAL_KEY = 'pos_registered_stores_v1';

export async function getAllStoreAccounts(dbInstance?: IDBDatabase): Promise<StoreAccount[]> {
  // First attempt from IndexedDB
  const db = dbInstance || (await openDB());
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('app_stores_list');
      req.onsuccess = () => {
        let list: StoreAccount[] = req.result ? req.result.value : [];
        if (Array.isArray(list) && list.length > 0) {
          try {
            localStorage.setItem(STORE_LIST_LOCAL_KEY, JSON.stringify(list));
          } catch (e) {
            // ignore
          }
          resolve(list);
          return;
        }

        // Check fallback from localStorage
        try {
          const localSaved = localStorage.getItem(STORE_LIST_LOCAL_KEY);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              resolve(parsed);
              return;
            }
          }
        } catch (e) {
          // ignore
        }

        // Check if there was an existing single-store setup in app_settings
        const settingsReq = store.get('app_settings');
        settingsReq.onsuccess = () => {
          const currentSets: Settings = settingsReq.result ? settingsReq.result.value : null;
          if (currentSets && currentSets.isSetup && currentSets.storeName) {
            const defaultAccount: StoreAccount = {
              id: currentSets.storeId || 'store-main',
              storeName: currentSets.storeName,
              ownerName: currentSets.ownerName || 'Store Admin',
              storeAddress: currentSets.storeAddress,
              storeContact: currentSets.storeContact,
              adminPinHash: currentSets.adminPinHash,
              adminPinSalt: currentSets.adminPinSalt,
              recoveryCodeHash: currentSets.recoveryCodeHash,
              recoveryCodeSalt: currentSets.recoveryCodeSalt,
              recoveryCodeCreatedAt: currentSets.recoveryCodeCreatedAt,
              createdAt: new Date().toISOString(),
              isSetup: true,
            };
            const singleList = [defaultAccount];
            try {
              localStorage.setItem(STORE_LIST_LOCAL_KEY, JSON.stringify(singleList));
            } catch (e) {
              // ignore
            }
            resolve(singleList);
          } else {
            resolve([]);
          }
        };
        settingsReq.onerror = () => resolve([]);
      };
      req.onerror = () => {
        // Fallback to localStorage on error
        try {
          const localSaved = localStorage.getItem(STORE_LIST_LOCAL_KEY);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              resolve(parsed);
              return;
            }
          }
        } catch {}
        resolve([]);
      };
    } catch {
      // Fallback to localStorage
      try {
        const localSaved = localStorage.getItem(STORE_LIST_LOCAL_KEY);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed)) {
            resolve(parsed);
            return;
          }
        }
      } catch {}
      resolve([]);
    }
  });
}

export async function saveStoreAccountsList(accounts: StoreAccount[], dbInstance?: IDBDatabase): Promise<void> {
  try {
    localStorage.setItem(STORE_LIST_LOCAL_KEY, JSON.stringify(accounts));
  } catch (e) {
    // ignore
  }

  const db = dbInstance || (await openDB());
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key: 'app_stores_list', value: accounts });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // Always resolve so UI doesn't hang
    } catch {
      resolve();
    }
  });
}

export async function saveStoreAccount(account: StoreAccount, dbInstance?: IDBDatabase): Promise<void> {
  const accounts = await getAllStoreAccounts(dbInstance);
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account };
  } else {
    accounts.push(account);
  }
  await saveStoreAccountsList(accounts, dbInstance);
}

export async function deleteStoreAccount(id: string): Promise<void> {
  const accounts = await getAllStoreAccounts();
  const updated = accounts.filter((a) => a.id !== id);
  await saveStoreAccountsList(updated);

  try {
    const db = await openDB();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.delete(`app_settings_${id}`);
  } catch (e) {
    // ignore
  }
}

export async function findStoreAccountByName(name: string, dbInstance?: IDBDatabase): Promise<StoreAccount | null> {
  const clean = (name || '').trim().toLowerCase();
  if (!clean) return null;
  const accounts = await getAllStoreAccounts(dbInstance);
  return accounts.find((a) => a.storeName.trim().toLowerCase() === clean) || null;
}

// --- Settings ---
export async function getSettings(
  storeIdOrDb?: string | IDBDatabase,
  dbInstance?: IDBDatabase
): Promise<Settings> {
  let targetStoreId: string | undefined = undefined;
  let dbToUse: IDBDatabase | undefined = undefined;

  if (typeof storeIdOrDb === 'string') {
    targetStoreId = storeIdOrDb;
    dbToUse = dbInstance;
  } else if (storeIdOrDb && typeof storeIdOrDb === 'object') {
    dbToUse = storeIdOrDb as IDBDatabase;
  } else {
    dbToUse = dbInstance;
  }

  const db = dbToUse || (await openDB());
  const targetKey = targetStoreId ? `app_settings_${targetStoreId}` : 'app_settings';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(targetKey);
      request.onsuccess = () => {
        if (request.result && request.result.value) {
          resolve({
            ...DEFAULT_SETTINGS,
            ...request.result.value,
            storeId: targetStoreId || request.result.value.storeId || 'store-main',
          });
        } else {
          // If specific store key not in settings, check store accounts list
          getAllStoreAccounts(db).then((accs) => {
            const acc = targetStoreId ? accs.find((a) => a.id === targetStoreId) : undefined;
            if (acc) {
              const constructed: Settings = {
                ...DEFAULT_SETTINGS,
                storeId: acc.id,
                storeName: acc.storeName,
                ownerName: acc.ownerName,
                storeAddress: acc.storeAddress || DEFAULT_SETTINGS.storeAddress,
                storeContact: acc.storeContact || DEFAULT_SETTINGS.storeContact,
                adminPinHash: acc.adminPinHash,
                adminPinSalt: acc.adminPinSalt,
                recoveryCodeHash: acc.recoveryCodeHash,
                recoveryCodeSalt: acc.recoveryCodeSalt,
                recoveryCodeCreatedAt: acc.recoveryCodeCreatedAt,
                isSetup: acc.isSetup ?? true,
              };
              resolve(constructed);
            } else {
              const fallbackReq = store.get('app_settings');
              fallbackReq.onsuccess = () => {
                if (fallbackReq.result && fallbackReq.result.value) {
                  resolve({
                    ...DEFAULT_SETTINGS,
                    ...fallbackReq.result.value,
                    storeId: targetStoreId || fallbackReq.result.value.storeId || 'store-main',
                  });
                } else {
                  resolve({ ...DEFAULT_SETTINGS, storeId: targetStoreId || 'store-main' });
                }
              };
              fallbackReq.onerror = () => resolve({ ...DEFAULT_SETTINGS, storeId: targetStoreId || 'store-main' });
            }
          }).catch(() => {
            resolve({ ...DEFAULT_SETTINGS, storeId: targetStoreId || 'store-main' });
          });
        }
      };
      request.onerror = () => resolve({ ...DEFAULT_SETTINGS, storeId: targetStoreId || 'store-main' });
    } catch {
      resolve({ ...DEFAULT_SETTINGS, storeId: targetStoreId || 'store-main' });
    }
  });
}

export async function saveSettings(
  settings: Settings,
  storeIdOrDb?: string | IDBDatabase,
  dbInstance?: IDBDatabase
): Promise<void> {
  let targetStoreId: string = settings.storeId || 'store-main';
  let dbToUse: IDBDatabase | undefined = undefined;

  if (typeof storeIdOrDb === 'string') {
    targetStoreId = storeIdOrDb;
    dbToUse = dbInstance;
  } else if (storeIdOrDb && typeof storeIdOrDb === 'object') {
    dbToUse = storeIdOrDb as IDBDatabase;
  } else {
    dbToUse = dbInstance;
  }

  const db = dbToUse || (await openDB());
  const targetKey = `app_settings_${targetStoreId}`;
  const updatedSettings: Settings = { ...settings, storeId: targetStoreId };

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');

      store.put({ key: targetKey, value: updatedSettings });
      if (targetStoreId === 'store-main') {
        store.put({ key: 'app_settings', value: updatedSettings });
      }

      tx.oncomplete = async () => {
        try {
          const storeAccount: StoreAccount = {
            id: targetStoreId,
            storeName: settings.storeName || 'Store Account',
            ownerName: settings.ownerName || 'Store Admin',
            storeAddress: settings.storeAddress,
            storeContact: settings.storeContact,
            adminPinHash: settings.adminPinHash,
            adminPinSalt: settings.adminPinSalt,
            recoveryCodeHash: settings.recoveryCodeHash,
            recoveryCodeSalt: settings.recoveryCodeSalt,
            recoveryCodeCreatedAt: settings.recoveryCodeCreatedAt,
            createdAt: new Date().toISOString(),
            isSetup: settings.isSetup ?? true,
          };
          await saveStoreAccount(storeAccount, db);
        } catch (e) {
          console.warn('Syncing store account summary failed:', e);
        }
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

// Clear all data
export async function clearAllData(preserveSettings: boolean = false): Promise<void> {
  const db = await openDB();
  const stores = [
    'products',
    'categories',
    'transactions',
    'customers',
    'product_history',
    'stock_movements',
    'cashiers',
    'reset_requests',
  ];
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

/**
 * Create a quick safety snapshot before merging
 */
export async function createPreMergeSafetySnapshot(): Promise<boolean> {
  try {
    const rawProds = await getAllProducts();
    const categories = await getAllCategories();
    const transactions = await getAllTransactions();
    const settings = await getSettings();
    const snapshot = {
      timestamp: new Date().toISOString(),
      productsCount: rawProds.length,
      transactionsCount: transactions.length,
      categoriesCount: categories.length,
      settings,
    };
    localStorage.setItem('pos_pre_merge_backup', JSON.stringify(snapshot));
    return true;
  } catch (err) {
    console.warn('Safety snapshot creation warning:', err);
    return false;
  }
}
