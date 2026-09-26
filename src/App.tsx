/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import {
  seedInitialData,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  getSettings,
  Product,
  Category,
  Transaction,
  Customer,
  Settings,
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
import { AnimatedBackground } from './components/AnimatedBackground';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // App data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const loadData = async () => {
    try {
      await seedInitialData();
      const [prods, cats, txs, custs, sets] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllTransactions(),
        getAllCustomers(),
        getSettings(),
      ]);

      setProducts(prods);
      setCategories(cats);
      setTransactions(txs);
      setCustomers(custs);
      setSettings(sets || DEFAULT_SETTINGS);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Register PWA service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.debug('Service worker registration failed:', err);
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Loading Mini Universal POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-500 ${settings.darkMode ? 'dark' : ''}`}>
      {/* Animated Ambient POS Background */}
      <AnimatedBackground
        enabled={settings.animatedBackground !== false}
        darkMode={settings.darkMode}
      />

      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        storeName={settings.storeName}
        ownerName={settings.ownerName}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-4 md:px-6 shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs overflow-hidden p-1 shrink-0">
              <img src="/icon.svg" alt="App Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 dark:text-white capitalize">
                {currentTab === 'pos' ? 'POS Terminal' : currentTab.replace('-', ' ')}
              </span>
              <div className="md:hidden text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                {settings.storeName || 'Mini POS'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 backdrop-blur-xs border border-blue-200/50 dark:border-blue-900/50">
              Offline-First POS
            </span>
          </div>
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10">
          {currentTab === 'dashboard' && (
            <Dashboard
              products={products}
              transactions={transactions}
              settings={settings}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'pos' && (
            <POSView
              products={products}
              categories={categories}
              settings={settings}
              onTransactionComplete={loadData}
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
            />
          )}

          {currentTab === 'sales' && (
            <SalesView
              transactions={transactions}
              settings={settings}
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

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onRefresh={loadData}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenMore={() => setShowMoreModal(true)}
      />

      {/* Mobile More Menu Modal */}
      {showMoreModal && (
        <MoreMenuModal
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          onClose={() => setShowMoreModal(false)}
        />
      )}
    </div>
  );
};
