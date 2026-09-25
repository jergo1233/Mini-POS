/**
 * Dashboard View Component
 */
import React from 'react';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { Product, Transaction, Settings } from '../db/indexedDB';
import { TabType } from './Sidebar';

interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  settings: Settings;
  onNavigate: (tab: TabType) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  transactions,
  settings,
  onNavigate,
}) => {
  // Compute metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(t => t.date.startsWith(todayStr));
  const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);

  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock <= settings.lowStockThreshold);

  const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h2>
          <p className="text-sm text-slate-500">Welcome back to {settings.storeName}</p>
        </div>
        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          <ShoppingCart className="w-4 h-4" />
          Open POS Terminal
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Today's Sales</span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}{todaySales.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {todayTransactions.length} transactions today
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Revenue</span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}{totalRevenue.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {transactions.length} total orders recorded
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Active Products</span>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/50 p-2 text-violet-600 dark:text-violet-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {totalProducts}
          </div>
          <div className="mt-1 text-xs text-slate-500">Items cataloged in store</div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Low Stock Alerts</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {lowStockProducts.length}
          </div>
          <div className="mt-1 text-xs text-amber-600 font-medium">Requires reordering</div>
        </div>
      </div>

      {/* Recent Transactions & Low Stock Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
            <button
              onClick={() => onNavigate('sales')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {transactions.slice(0, 5).length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No sales recorded yet.</p>
            ) : (
              transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{tx.receiptNo}</div>
                    <div className="text-xs text-slate-500">{new Date(tx.date).toLocaleTimeString()} · {tx.items.length} items</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{settings.currency}{tx.total.toFixed(2)}</div>
                    <div className="text-xs text-emerald-600 font-medium">Paid</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Low Stock Inventory</h3>
            <button
              onClick={() => onNavigate('inventory')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">All product inventory levels are healthy.</p>
            ) : (
              lowStockProducts.slice(0, 5).map(prod => (
                <div key={prod.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{prod.name}</div>
                    <div className="text-xs text-slate-500">SKU: {prod.sku}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      {prod.stock} left
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
