import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));

// Persistence directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const STORE_FILE = path.join(DATA_DIR, 'central-store.json');

interface CentralStore {
  version: number;
  lastUpdated: string;
  products: any[];
  categories: any[];
  transactions: any[];
  stockMovements: any[];
  cashiers: any[];
  resetRequests: any[];
  settings?: any;
}

const defaultCentralStore: CentralStore = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  products: [],
  categories: [],
  transactions: [],
  stockMovements: [],
  cashiers: [
    {
      id: 'cashier-1',
      name: 'Cashier 1',
      pin: '0000',
      role: 'cashier',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  resetRequests: [],
};

function readCentralStore(): CentralStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading central store:', err);
  }
  return defaultCentralStore;
}

function writeCentralStore(store: CentralStore) {
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing central store:', err);
  }
}

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Full state for sync or Remote Admin
app.get('/api/sync/state', (_req, res) => {
  const store = readCentralStore();
  res.json({
    success: true,
    data: store,
  });
});

// Bidirectional synchronization endpoint
app.post('/api/sync', (req, res) => {
  const {
    transactions = [],
    stockMovements = [],
    resetRequests = [],
    products = [],
    cashiers = [],
    categories = [],
  } = req.body;

  const current = readCentralStore();

  // Merge transactions by unique ID
  const txMap = new Map<string, any>();
  current.transactions.forEach((tx: any) => txMap.set(tx.id, tx));
  transactions.forEach((tx: any) => {
    if (tx && tx.id) {
      txMap.set(tx.id, { ...tx, syncStatus: 'synced' });
    }
  });
  current.transactions = Array.from(txMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Merge stock movements by unique ID
  const smMap = new Map<string, any>();
  current.stockMovements.forEach((sm: any) => smMap.set(sm.id, sm));
  stockMovements.forEach((sm: any) => {
    if (sm && sm.id) {
      smMap.set(sm.id, { ...sm, syncStatus: 'synced' });
    }
  });
  current.stockMovements = Array.from(smMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Merge reset requests
  const reqMap = new Map<string, any>();
  current.resetRequests.forEach((r: any) => reqMap.set(r.id, r));
  resetRequests.forEach((r: any) => {
    if (r && r.id) {
      // Don't overwrite an already resolved request with a stale pending one
      const existing = reqMap.get(r.id);
      if (existing && existing.status === 'resolved' && r.status === 'pending') {
        // keep existing resolved
      } else {
        reqMap.set(r.id, { ...r, syncStatus: 'synced' });
      }
    }
  });
  current.resetRequests = Array.from(reqMap.values()).sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  // Merge products
  if (Array.isArray(products) && products.length > 0) {
    const prodMap = new Map<string, any>();
    current.products.forEach((p: any) => prodMap.set(p.id, p));
    products.forEach((p: any) => {
      if (p && p.id) {
        prodMap.set(p.id, p);
      }
    });
    current.products = Array.from(prodMap.values());
  }

  // Merge categories
  if (Array.isArray(categories) && categories.length > 0) {
    const catMap = new Map<string, any>();
    current.categories.forEach((c: any) => catMap.set(c.id, c));
    categories.forEach((c: any) => {
      if (c && c.id) {
        catMap.set(c.id, c);
      }
    });
    current.categories = Array.from(catMap.values());
  }

  // Merge cashiers
  if (Array.isArray(cashiers) && cashiers.length > 0) {
    const cashMap = new Map<string, any>();
    current.cashiers.forEach((c: any) => cashMap.set(c.id, c));
    cashiers.forEach((c: any) => {
      if (c && c.id) {
        // If server had a password/pin updated more recently, keep it
        const existing = cashMap.get(c.id);
        if (existing && existing.updatedAt && c.updatedAt && new Date(existing.updatedAt) > new Date(c.updatedAt)) {
          // Keep existing
        } else {
          cashMap.set(c.id, c);
        }
      }
    });
    current.cashiers = Array.from(cashMap.values());
  }

  writeCentralStore(current);

  res.json({
    success: true,
    message: 'Synchronized successfully',
    syncedAt: new Date().toISOString(),
    serverData: current,
  });
});

// Admin resolves PIN reset request
app.post('/api/admin/resolve-reset', (req, res) => {
  const { requestId, cashierId, newPin } = req.body;
  const store = readCentralStore();

  const request = store.resetRequests.find((r: any) => r.id === requestId);
  if (request) {
    request.status = 'resolved';
    request.resolvedAt = new Date().toISOString();
    request.temporaryPin = newPin;
  }

  const cashier = store.cashiers.find((c: any) => c.id === cashierId);
  if (cashier) {
    cashier.pin = newPin;
    cashier.updatedAt = new Date().toISOString();
  }

  writeCentralStore(store);

  res.json({
    success: true,
    message: 'PIN successfully reset',
    temporaryPin: newPin,
    updatedStore: store,
  });
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mini Universal POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
