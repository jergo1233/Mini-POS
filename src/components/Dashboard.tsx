/**
 * Dashboard View Component
 */
import React from 'react';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  Boxes,
  ReceiptText
} from 'lucide-react';
import { Product, Transaction, Settings } from '../db/indexedDB';
import { TabType } from './Sidebar';

interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  settings: Settings;
  onNavigate: (tab: TabType) => void;
  userRole?: 'admin' | 'cashier';
  userName?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  transactions,
  settings,
  onNavigate,
  userRole = 'admin',
  userName,
}) => {
  const isCashier = userRole === 'cashier';

  // Compute metrics (if cashier and restricted, filter to their shift)
  const todayStr = new Date().toISOString().split('T')[0];
  const relevantTransactions =
    isCashier && !settings.cashierCanViewAllSales && userName
      ? transactions.filter((t) => !t.cashier || t.cashier === userName)
      : transactions;

  const todayTransactions = relevantTransactions.filter((t) => t.date.startsWith(todayStr));
  const todaySales = todayTransactions.reduce((sum, t) => sum + t.total, 0);

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= settings.lowStockThreshold);

  const totalRevenue = relevantTransactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isCashier
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
              }`}
            >
              {userRole} Session
            </span>
            <span className="text-xs text-slate-500">
              Logged in as: <strong>{userName || (isCashier ? 'Cashier' : 'Admin')}</strong>
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h2>
          <p className="text-sm text-slate-500">Welcome to {settings.storeName}</p>
        </div>
        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Open POS Terminal</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {isCashier ? "My Today's Sales" : "Today's Total Sales"}
            </span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}
            {todaySales.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {todayTransactions.length} sales receipts today
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              {isCashier ? 'Shift Total Sales' : 'Total Revenue'}
            </span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}
            {totalRevenue.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {relevantTransactions.length} transactions recorded
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
          <div className="mt-1 text-xs text-slate-500">In inventory catalog</div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Low Stock Alert</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-amber-600">
            {lowStockProducts.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            ≤ {settings.lowStockThreshold} units remaining
          </div>
        </div>
      </div>

      {/* Quick Access Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center justify-between p-5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition text-left"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-base">Point of Sale Terminal</div>
              <div className="text-xs text-blue-100 mt-0.5">
                Scan barcodes, search products, manage cart and issue receipts
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>

        <button
          onClick={() => onNavigate('sales')}
          className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition text-left shadow-xs"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 dark:text-white">
                Sales Records & Slips
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                View transactions, print slips, and verify sync status
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
        </button>
      </div>
    </div>
  );
};
