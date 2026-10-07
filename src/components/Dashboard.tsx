/**
 * Dashboard View Component
 */
import React, { useState } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  Boxes,
  ReceiptText,
  Award,
  Users,
  Calendar
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
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState<'today' | '7days' | 'month'>('today');

  const todayStr = new Date().toISOString().split('T')[0];

  // OVERALL STORE METRICS (Always Store-Wide)
  const storeTodayTransactions = transactions.filter((t) => t.date.startsWith(todayStr));
  const storeTodaySales = storeTodayTransactions.reduce((sum, t) => sum + t.total, 0);
  const storeTotalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);

  // CASHIER SPECIFIC METRICS (Separated for Cashier Session)
  const myTransactions = transactions.filter((t) => t.cashier === userName);
  const myTodayTransactions = myTransactions.filter((t) => t.date.startsWith(todayStr));
  const myTodaySales = myTodayTransactions.reduce((sum, t) => sum + t.total, 0);
  const myTotalSales = myTransactions.reduce((sum, t) => sum + t.total, 0);
  const myStarRating = myTransactions.length >= 20 ? '⭐⭐⭐⭐⭐' : myTransactions.length >= 10 ? '⭐⭐⭐⭐' : myTransactions.length >= 5 ? '⭐⭐⭐' : myTransactions.length >= 1 ? '⭐⭐' : '⭐';

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= settings.lowStockThreshold);

  // Cashier ratings calculations for Dashboard (Admin & Overview)
  const now = new Date();
  const filteredForRatings = transactions.filter(t => {
    const txDate = new Date(t.date);
    if (dashboardTimeFilter === 'today') {
      return t.date.startsWith(todayStr);
    } else if (dashboardTimeFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return txDate >= sevenDaysAgo;
    } else if (dashboardTimeFilter === 'month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const cashierSalesMap: { [name: string]: { qty: number; revenue: number; txCount: number } } = {};
  filteredForRatings.forEach(tx => {
    const cName = tx.cashier || settings.ownerName || 'Admin / Owner';
    if (!cashierSalesMap[cName]) {
      cashierSalesMap[cName] = { qty: 0, revenue: 0, txCount: 0 };
    }
    const qty = tx.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    cashierSalesMap[cName].qty += qty;
    cashierSalesMap[cName].revenue += tx.total;
    cashierSalesMap[cName].txCount += 1;
  });

  const dashboardCashierLeaderboard = Object.entries(cashierSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

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

      {/* Top Metrics Grid (Store-Wide) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Store Today's Total Sales
            </span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}
            {storeTodaySales.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {storeTodayTransactions.length} store sales receipts today
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Store Total Revenue
            </span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}
            {storeTotalRevenue.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {transactions.length} total store transactions
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

      {/* SEPARATED SECTION: My Individual Cashier Shift Sales (Cashier Session Only) */}
      {isCashier && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 text-amber-400 backdrop-blur-xs">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <span>My Individual Cashier Sales</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-bold">
                    👤 {userName || 'Cashier'} Shift
                  </span>
                </h3>
                <p className="text-xs text-blue-200/80">
                  Separated sales and performance processed specifically by your cashier account
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-amber-400 font-bold tracking-wider">{myStarRating}</div>
              <div className="text-[10px] text-blue-200">Performance Rating</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
              <div className="text-xs text-blue-200 font-medium">My Sales Today</div>
              <div className="text-2xl font-black text-emerald-400">
                {settings.currency}{myTodaySales.toFixed(2)}
              </div>
              <div className="text-[11px] text-blue-200/70">
                {myTodayTransactions.length} receipts issued by me today
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 space-y-1">
              <div className="text-xs text-blue-200 font-medium">My Total Cumulative Sales</div>
              <div className="text-2xl font-black text-white">
                {settings.currency}{myTotalSales.toFixed(2)}
              </div>
              <div className="text-[11px] text-blue-200/70">
                {myTransactions.length} total receipts processed
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Performance & Ratings Leaderboard */}
      {!isCashier && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Cashier Performance & Ratings</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold">
                    🏆 Admin View
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time sales ratings, rankings, and transaction activity for counter staff
                </p>
              </div>
            </div>

            {/* Time period filter buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDashboardTimeFilter('today')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  dashboardTimeFilter === 'today'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Today (1D)
              </button>
              <button
                type="button"
                onClick={() => setDashboardTimeFilter('7days')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  dashboardTimeFilter === '7days'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDashboardTimeFilter('month')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  dashboardTimeFilter === 'month'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          {dashboardCashierLeaderboard.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No sales transactions recorded for this selected time period.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dashboardCashierLeaderboard.map((c, index) => {
                const stars = index === 0 ? '⭐⭐⭐⭐⭐' : index === 1 ? '⭐⭐⭐⭐' : index === 2 ? '⭐⭐⭐' : '⭐⭐';
                const rankBadge = index === 0 ? '🥇 #1 Top Sales' : index === 1 ? '🥈 #2 Runner Up' : index === 2 ? '🥉 #3 Top Performer' : `#${index + 1} Cashier`;
                return (
                  <div
                    key={c.name}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {c.name}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          index === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          index === 1 ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {rankBadge}
                        </span>
                      </div>
                      <div className="text-xs text-amber-500 font-bold tracking-wider">
                        {stars}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {c.txCount} transactions ({c.qty} items)
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {settings.currency}{c.revenue.toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('reports')}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1 font-semibold"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
