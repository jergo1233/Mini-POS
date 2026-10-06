import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPendingSyncPayload,
  markPendingDataAsSynced,
  saveCashier,
  saveProduct,
  saveCategory,
  getAllCashiers,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  saveRawTransaction,
  getAllStockMovements,
  saveRawStockMovement,
  getAllCustomers,
  saveCustomer,
  Cashier,
  Product,
  Category,
  Transaction,
  StockMovement,
  Customer,
  CashierResetRequest,
  saveResetRequest,
  getSettings,
  saveSettings,
} from '../db/indexedDB';
import { safeFetchJson } from '../utils/apiHelper';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'failed';

export interface SyncManagerReturn {
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncTime: string | null;
  syncError: string | null;
  triggerSync: () => Promise<boolean>;
  refreshPendingCount: () => Promise<void>;
  notifications: any[];
}

export function useSyncManager(onDataUpdated?: () => void): SyncManagerReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pos_last_sync_time');
    } catch {
      return null;
    }
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('pos_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const isSyncingRef = useRef<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const payload = await getPendingSyncPayload();
      setPendingCount(payload.totalPendingCount);
      if (payload.totalPendingCount > 0 && syncState !== 'syncing' && syncState !== 'failed') {
        setSyncState('pending');
      } else if (payload.totalPendingCount === 0 && syncState !== 'syncing') {
        setSyncState('synced');
      }
    } catch (err) {
      console.debug('Failed to count pending sync items:', err);
    }
  }, [syncState]);

  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (isSyncingRef.current) return false;
    if (!navigator.onLine) {
      setSyncState('pending');
      return false;
    }

    isSyncingRef.current = true;
    setSyncState('syncing');
    setSyncError(null);

    try {
      const payload = await getPendingSyncPayload();
      const currentSettings = await getSettings();

      // Detect active user name and role from sessionStorage
      let clientName = 'Admin';
      let clientRole = 'admin';
      try {
        const sessionStr = sessionStorage.getItem('pos_active_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          clientName = session.name || 'Store Admin';
          clientRole = session.role || 'admin';
        }
      } catch (e) {
        // ignore
      }

      // Send to server /api/sync safely
      const apiRes = await safeFetchJson<any>('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: payload.transactions,
          stockMovements: payload.stockMovements,
          resetRequests: payload.resetRequests,
          products: payload.products,
          cashiers: payload.cashiers,
          categories: payload.categories,
          customers: payload.customers,
          settings: currentSettings,
          clientName,
          clientRole,
        }),
      });

      if (!apiRes.success) {
        throw new Error(apiRes.message || 'Sync failed on server');
      }

      const resData = apiRes.data || apiRes;

      // Mark locally sent items as synced
      await markPendingDataAsSynced({
        txIds: payload.transactions.map((t) => t.id),
        smIds: payload.stockMovements.map((s) => s.id),
        reqIds: payload.resetRequests.map((r) => r.id),
      });

      // Synchronize back any updated server records (cashiers, products, categories, transactions, stockMovements, customers, reset requests, settings, notifications)
      if (resData.serverData) {
        const {
          cashiers = [],
          products = [],
          categories = [],
          transactions = [],
          stockMovements = [],
          customers = [],
          resetRequests = [],
          settings: remoteSettings,
          notifications: remoteNotifs = [],
        } = resData.serverData;

        // Apply remote settings if updated (such as Admin PIN modified remotely)
        if (remoteSettings) {
          const updatedSettings = {
            ...currentSettings,
            ...remoteSettings,
            isSetup: true,
          };
          await saveSettings(updatedSettings);
        }

        // Apply remote notifications if any
        if (remoteNotifs && remoteNotifs.length > 0) {
          setNotifications(remoteNotifs);
          try {
            localStorage.setItem('pos_notifications', JSON.stringify(remoteNotifs));
          } catch (e) {
            // ignore
          }
        }

        // Apply updated cashiers (e.g. Admin reset PIN or created new cashier remotely)
        const localCashiers = await getAllCashiers();
        const localCashierMap = new Map(localCashiers.map((c) => [c.id, c]));
        for (const remoteCashier of cashiers as Cashier[]) {
          const local = localCashierMap.get(remoteCashier.id);
          if (!local || (remoteCashier.updatedAt && new Date(remoteCashier.updatedAt) > new Date(local.updatedAt))) {
            await saveCashier(remoteCashier);
          }
        }

        // Apply updated reset requests
        for (const req of resetRequests as CashierResetRequest[]) {
          await saveResetRequest(req);
        }

        // Apply remote products (including stock/price changes from other terminals)
        const localProds = await getAllProducts();
        const localProdMap = new Map(localProds.map((p) => [p.id, p]));
        for (const remoteProd of products as Product[]) {
          const local = localProdMap.get(remoteProd.id);
          if (!local || (remoteProd.updatedAt && new Date(remoteProd.updatedAt) >= new Date(local.updatedAt)) || local.stock !== remoteProd.stock) {
            await saveProduct({ ...remoteProd, syncStatus: 'synced' });
          }
        }

        // Apply remote categories
        const localCats = await getAllCategories();
        const localCatIds = new Set(localCats.map((c) => c.id));
        for (const remoteCat of categories as Category[]) {
          if (!localCatIds.has(remoteCat.id)) {
            await saveCategory(remoteCat);
          }
        }

        // Apply remote transactions (so Admin sees Cashier sales and Cashier sees historical data)
        const localTxs = await getAllTransactions();
        const localTxMap = new Map(localTxs.map((t) => [t.id, t]));
        for (const remoteTx of transactions as Transaction[]) {
          const local = localTxMap.get(remoteTx.id);
          if (!local || local.syncStatus !== 'synced') {
            await saveRawTransaction({ ...remoteTx, syncStatus: 'synced' });
          }
        }

        // Apply remote stock movements
        const localSms = await getAllStockMovements();
        const localSmMap = new Map(localSms.map((s) => [s.id, s]));
        for (const remoteSm of stockMovements as StockMovement[]) {
          if (!localSmMap.has(remoteSm.id)) {
            await saveRawStockMovement({ ...remoteSm, syncStatus: 'synced' });
          }
        }

        // Apply remote customers
        const localCusts = await getAllCustomers();
        const localCustMap = new Map(localCusts.map((c) => [c.id, c]));
        for (const remoteCust of customers as Customer[]) {
          if (!localCustMap.has(remoteCust.id)) {
            await saveCustomer(remoteCust);
          }
        }
      }

      const nowIso = new Date().toISOString();
      setLastSyncTime(nowIso);
      try {
        localStorage.setItem('pos_last_sync_time', nowIso);
      } catch (e) {
        // ignore
      }

      setSyncState('synced');
      setPendingCount(0);

      if (onDataUpdated) {
        onDataUpdated();
      }

      return true;
    } catch (err: any) {
      console.warn('Sync failed:', err);
      setSyncState('failed');
      setSyncError(err?.message || 'Sync connection failed');
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [onDataUpdated]);

  // Online / Offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto sync when connection returns
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState((prev) => (prev === 'syncing' ? 'failed' : prev));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    refreshPendingCount();

    // Auto sync interval if online (every 25 seconds)
    const interval = setInterval(() => {
      if (navigator.onLine) {
        triggerSync();
      } else {
        refreshPendingCount();
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    syncState,
    pendingCount,
    lastSyncTime,
    syncError,
    triggerSync,
    refreshPendingCount,
    notifications,
  };
}
