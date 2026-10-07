/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useCallback } from 'react';
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
import { BackupTransferView } from './components/BackupTransferView';
import { AnimatedBackground } from './components/AnimatedBackground';
import { LoginScreen, AuthSession } from './components/LoginScreen';
import { AutoLockModal } from './components/AutoLockModal';
import { SyncStatusHeader } from './components/SyncStatusHeader';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authentication & Session State (Persisted in both sessionStorage & localStorage)
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('pos_active_session') || localStorage.getItem('pos_active_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Terminal Lock state — persistent for Cashiers across page refreshes
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem('pos_terminal_locked') || localStorage.getItem('pos_terminal_locked');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Keep storage in sync whenever isLocked changes
  useEffect(() => {
    try {
      if (currentSession?.role === 'cashier') {
        if (isLocked) {
          sessionStorage.setItem('pos_terminal_locked', 'true');
          localStorage.setItem('pos_terminal_locked', 'true');
        } else {
          sessionStorage.removeItem('pos_terminal_locked');
          localStorage.removeItem('pos_terminal_locked');
        }
      }
    } catch (e) {
      // ignore
    }
  }, [isLocked, currentSession]);

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
      const activeStoreId = currentSession?.storeId || 'store-main';
      await seedInitialData();
      const [prods, cats, txs, custs, sets, cashList, reqList] = await Promise.all([
        getAllProducts(activeStoreId),
        getAllCategories(),
        getAllTransactions(activeStoreId),
        getAllCustomers(),
        getSettings(activeStoreId),
        getAllCashiers(activeStoreId),
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
  }, [currentSession?.storeId]);

  useEffect(() => {
    loadData();

    // Listen for cross-component navigation events
    const handleNavigate = (e: any) => {
      if (e.detail) {
        setCurrentTab(e.detail as TabType);
      }
    };
    window.addEventListener('pos-navigate', handleNavigate);

    // Listen for store switching events
    const handleSwitchStore = (e: any) => {
      setCurrentSession(null);
      setIsLocked(false);
      try {
        sessionStorage.removeItem('pos_active_session');
        localStorage.removeItem('pos_active_session');
        if (e.detail) {
          localStorage.setItem('pos_preferred_store_id', e.detail);
        }
      } catch (err) {}
    };
    window.addEventListener('pos-switch-store', handleSwitchStore);

    // Register PWA service worker for offline caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.debug('Service worker registration failed:', err);
      });
    }
    return () => {
      window.removeEventListener('pos-navigate', handleNavigate);
      window.removeEventListener('pos-switch-store', handleSwitchStore);
    };
  }, [loadData]);

  // Inactivity Auto-Lock Timer — STRICTLY active for Cashier role
  useEffect(() => {
    if (!currentSession || currentSession.role !== 'cashier' || isLocked) return;

    const timeoutMinutes = settings.autoLockMinutes ?? 5;
    if (timeoutMinutes <= 0) return; // 0 = disabled

    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        try {
          sessionStorage.setItem('pos_terminal_locked', 'true');
          localStorage.setItem('pos_terminal_locked', 'true');
        } catch (e) {
          // ignore
        }
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
      localStorage.setItem('pos_active_session', JSON.stringify(session));
      sessionStorage.removeItem('pos_terminal_locked');
      localStorage.removeItem('pos_terminal_locked');
    } catch (e) {
      console.debug('Storage warning:', e);
    }

    // Role-based initial tab
    if (session.role === 'cashier') {
      setCurrentTab('pos');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    
    setCurrentSession(null);
    setIsLocked(false);
    try {
      sessionStorage.removeItem('pos_active_session');
      localStorage.removeItem('pos_active_session');
      sessionStorage.removeItem('pos_terminal_locked');
      localStorage.removeItem('pos_terminal_locked');
    } catch (e) {
      // ignore
    }
  };

  const handleManualLock = () => {
    // Only lock terminal for Cashier role
    if (currentSession?.role === 'cashier') {
      setIsLocked(true);
      try {
        sessionStorage.setItem('pos_terminal_locked', 'true');
        localStorage.setItem('pos_terminal_locked', 'true');
      } catch (e) {
        // ignore
      }
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    try {
      sessionStorage.removeItem('pos_terminal_locked');
      localStorage.removeItem('pos_terminal_locked');
    } catch (e) {
      // ignore
    }
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
        isOnline={true}
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

      {/* Inactivity & Manual Terminal Lock Overlay for Cashier */}
      {isLocked && currentSession.role === 'cashier' && (
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
                  : currentTab === 'backup'
                  ? 'Backup & Data Transfer'
                  : currentTab.replace('-', ' ')}
              </span>
              <div className="md:hidden text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                {settings.storeName || 'Mini POS'}
              </div>
            </div>
          </div>

          {/* User Session & Offline Status Header */}
          <SyncStatusHeader
            currentSession={currentSession}
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
              }}
              activeCashierName={currentSession.name}
              isOnline={true}
              onRefreshCustomers={loadData}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              settings={settings}
              onRefresh={loadData}
              isOnline={true}
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
              isOnline={true}
            />
          )}

          {currentTab === 'sales' && (
            <SalesView
              transactions={transactions}
              settings={settings}
              userRole={currentSession.role}
              userName={currentSession.name}
              onRefresh={loadData}
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
              isOnline={true}
            />
          )}

          {currentTab === 'cashiers' && (
            <CashierManagementView
              cashiers={cashiers}
              resetRequests={resetRequests}
              transactions={transactions}
              settings={settings}
              onRefresh={loadData}
              isOnline={true}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'backup' && (
            <BackupTransferView
              settings={settings}
              onRefresh={loadData}
              userRole={currentSession.role}
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
