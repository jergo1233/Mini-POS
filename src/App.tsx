/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  seedInitialData,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  getSettings,
  getAllCashiers,
  getAllResetRequests,
  Product,
  Category,
  Transaction,
  Customer,
  Settings,
  Cashier,
  CashierResetRequest,
  DEFAULT_SETTINGS
} from './db/indexedDB';
import { Sidebar, TabType } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { MoreMenuModal } from './components/MoreMenuModal';
import { Dashboard } from './components/Dashboard';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { InventoryView } from './components/InventoryView';
import { SalesView } from './components/SalesView';
import { ReportsView } from './components/ReportsView';
import { CustomersView } from './components/CustomersView';
import { SettingsView } from './components/SettingsView';
import { CashierManagementView } from './components/CashierManagementView';
import { AnimatedBackground } from './components/AnimatedBackground';
import { LoginScreen, AuthSession } from './components/LoginScreen';
import { AutoLockModal } from './components/AutoLockModal';
import { SyncStatusHeader } from './components/SyncStatusHeader';
import { useSyncManager } from './hooks/useSyncManager';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authentication & Session State (Persisted in sessionStorage)
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('pos_active_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLocked, setIsLocked] = useState(false);

  // App data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [resetRequests, setResetRequests] = useState<CashierResetRequest[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const loadData = useCallback(async () => {
    try {
      await seedInitialData();
      const [prods, cats, txs, custs, sets, cashList, reqList] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllTransactions(),
        getAllCustomers(),
        getSettings(),
        getAllCashiers(),
        getAllResetRequests(),
      ]);

      setProducts(prods);
      setCategories(cats);
      setTransactions(txs);
      setCustomers(custs);
      setSettings(sets || DEFAULT_SETTINGS);
      setCashiers(cashList);
      setResetRequests(reqList);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronization manager hook
  const {
    isOnline,
    syncState,
    pendingCount,
    triggerSync,
    refreshPendingCount,
  } = useSyncManager(loadData);

  useEffect(() => {
    loadData();

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.debug('Service worker registration failed:', err);
      });
    }
  }, [loadData]);

  // Inactivity Auto-Lock Timer
  useEffect(() => {
    if (!currentSession || isLocked) return;

    const timeoutMinutes = settings.autoLockMinutes ?? 5;
    if (timeoutMinutes <= 0) return; // 0 = disabled

    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentSession, isLocked, settings.autoLockMinutes]);

  const handleLoginSuccess = (session: AuthSession) => {
    setCurrentSession(session);
    setIsLocked(false);
    try {
      sessionStorage.setItem('pos_active_session', JSON.stringify(session));
    } catch (e) {
      console.debug('sessionStorage warning:', e);
    }

    // Role-based initial tab
    if (session.role === 'cashier') {
      setCurrentTab('pos');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentSession(null);
    setIsLocked(false);
    try {
      sessionStorage.removeItem('pos_active_session');
    } catch (e) {
      // ignore
    }
  };

  const handleManualLock = () => {
    setIsLocked(true);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  // Enforce role-based tab restrictions
  useEffect(() => {
    if (currentSession?.role === 'cashier') {
      const allowedTabs: TabType[] = ['pos', 'sales', 'dashboard', 'customers'];
      if (!allowedTabs.includes(currentTab)) {
        setCurrentTab('pos');
      }
    }
  }, [currentTab, currentSession]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Loading Mini Universal POS...
          </p>
        </div>
      </div>
    );
  }

  // 1. Unauthenticated Gate: Opens login screen first
  if (!currentSession) {
    return (
      <LoginScreen
        settings={settings}
        onLoginSuccess={handleLoginSuccess}
        isOnline={isOnline}
        onTriggerSync={triggerSync}
      />
    );
  }

  const pendingResetRequests = resetRequests.filter((r) => r.status === 'pending');

  return (
    <div
      className={`relative flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-500 ${
        settings.darkMode ? 'dark' : ''
      }`}
    >
      {/* Animated Ambient POS Background */}
      <AnimatedBackground
        enabled={settings.animatedBackground !== false}
        darkMode={settings.darkMode}
      />

      {/* Inactivity Auto-Lock Overlay */}
      {isLocked && (
        <AutoLockModal
          currentSession={currentSession}
          cashiers={cashiers}
          settings={settings}
          onUnlock={handleUnlock}
          onLogout={handleLogout}
        />
      )}

      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        storeName={settings.storeName}
        ownerName={settings.ownerName}
        userRole={currentSession.role}
        userName={currentSession.name}
        pendingResetRequestsCount={pendingResetRequests.length}
        onLock={handleManualLock}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-4 md:px-6 shrink-0 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs overflow-hidden p-1 shrink-0">
              <img src="/icon.svg" alt="App Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base text-slate-900 dark:text-white capitalize truncate block">
                {currentTab === 'pos'
                  ? 'POS Terminal'
                  : currentTab === 'cashiers'
                  ? 'Cashier Access'
                  : currentTab.replace('-', ' ')}
              </span>
              <div className="md:hidden text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                {settings.storeName || 'Mini POS'}
              </div>
            </div>
          </div>

          {/* Sync Status & User Session Header */}
          <SyncStatusHeader
            isOnline={isOnline}
            syncState={syncState}
            pendingCount={pendingCount}
            currentSession={currentSession}
            onManualSync={triggerSync}
            onLock={handleManualLock}
            onLogout={handleLogout}
          />
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10">
          {currentTab === 'dashboard' && (
            <Dashboard
              products={products}
              transactions={transactions}
              settings={settings}
              onNavigate={(tab) => setCurrentTab(tab)}
              userRole={currentSession.role}
              userName={currentSession.name}
            />
          )}

          {currentTab === 'pos' && (
            <POSView
              products={products}
              categories={categories}
              settings={settings}
              customers={customers}
              onTransactionComplete={() => {
                loadData();
                refreshPendingCount();
                if (isOnline) triggerSync().catch(() => {});
              }}
              activeCashierName={currentSession.name}
              isOnline={isOnline}
              onRefreshCustomers={loadData}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              settings={settings}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              products={products}
              categories={categories}
              settings={settings}
              onRefresh={loadData}
              userRole={currentSession.role}
              userName={currentSession.name}
              isOnline={isOnline}
              onTriggerSync={triggerSync}
            />
          )}

          {currentTab === 'sales' && (
            <SalesView
              transactions={transactions}
              settings={settings}
              userRole={currentSession.role}
              userName={currentSession.name}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              transactions={transactions}
              products={products}
              settings={settings}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView
              customers={customers}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'cashiers' && (
            <CashierManagementView
              cashiers={cashiers}
              resetRequests={resetRequests}
              onRefresh={loadData}
              isOnline={isOnline}
              onTriggerSync={triggerSync}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onRefresh={loadData}
              isOnline={isOnline}
              onTriggerSync={triggerSync}
              pendingCount={pendingCount}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenMore={() => setShowMoreModal(true)}
        userRole={currentSession.role}
        pendingBadgeCount={pendingResetRequests.length}
      />

      {/* Mobile More Menu Modal */}
      {showMoreModal && (
        <MoreMenuModal
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          onClose={() => setShowMoreModal(false)}
          userRole={currentSession.role}
          pendingResetRequestsCount={pendingResetRequests.length}
          onLock={handleManualLock}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
