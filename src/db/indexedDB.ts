/**
 * IndexedDB wrapper for Mini Universal POS
 * Database Name: MiniUniversalPOS
 * Stores: products, categories, transactions, customers, users, settings,
 *         cashiers, stock_movements, reset_requests, product_history
 */

const DB_NAME = 'MiniUniversalPOS';
const DB_VERSION = 5;

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
  syncStatus?: 'synced' | 'pending' | 'syncing';
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
  syncStatus?: 'synced' | 'pending' | 'syncing';
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  description?: string;
  createdAt: string;
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
}

export interface Settings {
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
  recoveryToken?: string;
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
  storeName: 'Mini Universal POS Store',
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
  ownerName: 'Jerome Urbano',
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

  // Check cashiers
  const cashiers = await getAllCashiers(db);
  if (cashiers.length === 0) {
    for (const c of DEFAULT_CASHIERS) {
      await saveCashier(c, db);
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
        syncStatus: 'synced',
      };
      await saveProduct(fullProd, db);
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
export async function getAllProducts(dbInstance?: IDBDatabase): Promise<Product[]> {
  const db = dbInstance || (await openDB());
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
export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort newest first
      const results = (request.result || []).sort(
        (a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
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
export async function getAllCashiers(dbInstance?: IDBDatabase): Promise<Cashier[]> {
  try {
    const db = dbInstance || (await openDB());
    if (!db.objectStoreNames.contains('cashiers')) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('cashiers', 'readonly');
      const store = tx.objectStore('cashiers');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
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
  const db = dbInstance || (await openDB());
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
  const db = dbInstance || (await openDB());
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

export interface POSBackupData {
  app: string;
  version: number;
  exportedAt: string;
  metadata?: {
    productCount: number;
    categoryCount: number;
    transactionCount: number;
    customerCount: number;
    cashierCount?: number;
    stockMovementCount?: number;
    historyCount?: number;
    storeName?: string;
  };
  settings?: Settings;
  categories?: Category[];
  products?: (Omit<Product, 'image'> & { image?: string })[];
  transactions?: Transaction[];
  customers?: Customer[];
  cashiers?: Cashier[];
  stockMovements?: StockMovement[];
  resetRequests?: CashierResetRequest[];
  productHistory?: ProductHistoryLog[];
}

export interface ImportSummary {
  productsCount: number;
  categoriesCount: number;
  transactionsCount: number;
  customersCount: number;
  cashiersCount: number;
  stockMovementsCount: number;
  settingsRestored: boolean;
  preMergeBackupCreated: boolean;
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
  const cashiers = await getAllCashiers(db);
  const stockMovements = await getAllStockMovements(db);
  const resetRequests = await getAllResetRequests(db);

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
    version: 5,
    exportedAt: new Date().toISOString(),
    metadata: {
      productCount: serializedProducts.length,
      categoryCount: categories.length,
      transactionCount: transactions.length,
      customerCount: customers.length,
      cashierCount: cashiers.length,
      stockMovementCount: stockMovements.length,
      historyCount: productHistory.length,
      storeName: settings.storeName || 'Mini POS',
    },
    settings,
    categories,
    products: serializedProducts,
    transactions,
    customers,
    cashiers,
    stockMovements,
    resetRequests,
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

  // Must have at least products, categories, transactions, or settings
  const hasProducts = Array.isArray(data.products);
  const hasCategories = Array.isArray(data.categories);
  const hasSettings = data.settings && typeof data.settings === 'object';
  const hasTransactions = Array.isArray(data.transactions);
  const hasCashiers = Array.isArray(data.cashiers);

  if (!hasProducts && !hasCategories && !hasSettings && !hasTransactions && !hasCashiers) {
    return {
      valid: false,
      error: 'Backup file does not contain any recognizable POS data (products, categories, cashiers, or settings).',
    };
  }

  return { valid: true, backup: data as POSBackupData };
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

/**
 * Import and restore/merge backup data into IndexedDB
 * @param backup The parsed backup data
 * @param mode 'replace' clears existing data first; 'merge' adds/updates without overwriting valid data
 */
export async function importDataFromJSON(
  backup: POSBackupData,
  mode: 'replace' | 'merge' = 'replace'
): Promise<ImportSummary> {
  const db = await openDB();

  let preMergeBackupCreated = false;
  if (mode === 'merge') {
    preMergeBackupCreated = await createPreMergeSafetySnapshot();
  }

  // If replace mode, clear store tables safely using clear() inside transactions
  if (mode === 'replace') {
    const storesToClear = [
      'products',
      'categories',
      'transactions',
      'customers',
      'settings',
      'product_history',
      'cashiers',
      'stock_movements',
      'reset_requests',
    ];
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
  let cashiersCount = 0;
  let stockMovementsCount = 0;
  let settingsRestored = false;

  // Restore/Merge Settings
  if (backup.settings) {
    if (mode === 'replace') {
      await saveSettings(backup.settings, db);
      settingsRestored = true;
    } else {
      // In merge mode, preserve store name & pin unless current is default
      const current = await getSettings(db);
      const mergedSettings: Settings = {
        ...backup.settings,
        storeName: current.storeName || backup.settings.storeName,
        adminPin: current.adminPin || backup.settings.adminPin,
      };
      await saveSettings(mergedSettings, db);
      settingsRestored = true;
    }
  }

  // Restore/Merge Categories
  if (Array.isArray(backup.categories)) {
    const existingCats = await getAllCategories(db);
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    for (const cat of backup.categories) {
      if (cat && cat.id && cat.name) {
        if (mode === 'replace' || !existingCatIds.has(cat.id)) {
          await saveCategory(cat, db);
          categoriesCount++;
        }
      }
    }
  }

  // Restore/Merge Products
  if (Array.isArray(backup.products)) {
    const existingProds = await getAllProducts(db);
    const existingMap = new Map(existingProds.map((p) => [p.id, p]));
    const existingBarcodeMap = new Map(existingProds.map((p) => [p.barcode.toLowerCase(), p]));

    for (const item of backup.products) {
      if (item && item.id && item.name) {
        // If merging, avoid duplicating if same barcode or ID exists
        if (mode === 'merge' && (existingMap.has(item.id) || existingBarcodeMap.has(item.barcode.toLowerCase()))) {
          // Keep existing valid record, don't duplicate
          continue;
        }

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
          syncStatus: 'synced',
        };
        await saveProduct(productToSave, db);
        productsCount++;
      }
    }
  }

  // Restore/Merge Transactions
  // Every completed sale preserves actual unit price used at purchase
  if (Array.isArray(backup.transactions)) {
    const existingTx = await getAllTransactions();
    const existingTxIds = new Set(existingTx.map((t) => t.id));

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('transactions', 'readwrite');
      const store = tx.objectStore('transactions');
      for (const t of backup.transactions!) {
        if (t && t.id) {
          if (mode === 'replace' || !existingTxIds.has(t.id)) {
            store.put({ ...t, syncStatus: 'synced' });
            transactionsCount++;
          }
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Restore/Merge Stock Movements
  if (Array.isArray(backup.stockMovements) && db.objectStoreNames.contains('stock_movements')) {
    const existingMovements = await getAllStockMovements(db);
    const existingSmIds = new Set(existingMovements.map((m) => m.id));

    await new Promise<void>((resolve) => {
      const tx = db.transaction('stock_movements', 'readwrite');
      const store = tx.objectStore('stock_movements');
      for (const sm of backup.stockMovements!) {
        if (sm && sm.id) {
          if (mode === 'replace' || !existingSmIds.has(sm.id)) {
            store.put({ ...sm, syncStatus: 'synced' });
            stockMovementsCount++;
          }
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // Restore/Merge Cashiers
  if (Array.isArray(backup.cashiers) && db.objectStoreNames.contains('cashiers')) {
    const existingCashiers = await getAllCashiers(db);
    const existingCashierIds = new Set(existingCashiers.map((c) => c.id));

    for (const cashier of backup.cashiers) {
      if (cashier && cashier.id && cashier.name) {
        if (mode === 'replace' || !existingCashierIds.has(cashier.id)) {
          await saveCashier(cashier, db);
          cashiersCount++;
        }
      }
    }
  }

  // Restore Customers
  if (Array.isArray(backup.customers)) {
    const existingCust = await getAllCustomers();
    const existingCustIds = new Set(existingCust.map((c) => c.id));

    for (const cust of backup.customers) {
      if (cust && cust.id && cust.name) {
        if (mode === 'replace' || !existingCustIds.has(cust.id)) {
          await saveCustomer(cust);
          customersCount++;
        }
      }
    }
  }

  // Restore Reset Requests
  if (Array.isArray(backup.resetRequests) && db.objectStoreNames.contains('reset_requests')) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction('reset_requests', 'readwrite');
      const store = tx.objectStore('reset_requests');
      for (const r of backup.resetRequests!) {
        if (r && r.id) {
          store.put(r);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
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
    cashiersCount,
    stockMovementsCount,
    settingsRestored,
    preMergeBackupCreated,
  };
}
