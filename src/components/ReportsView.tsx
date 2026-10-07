/**
 * Reports View Component with 7 Days, Month, Year, All Time filters
 */
import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  FileSpreadsheet,
  Calendar,
  User,
  X
} from 'lucide-react';
import { Transaction, Product, Settings } from '../db/indexedDB';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  transactions: Transaction[];
  products: Product[];
  settings: Settings;
}

type TimeFilter = 'today' | '7days' | 'month' | 'year' | 'all';

export const ReportsView: React.FC<ReportsViewProps> = ({ transactions, products, settings }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [customDate, setCustomDate] = useState<string>('');

  // Extract list of all unique cashiers who processed sales
  const uniqueCashiers = Array.from(
    new Set(transactions.map((t) => t.cashier || settings.ownerName || 'Admin / Owner'))
  ).filter(Boolean);

  // Filter transactions based on timeFilter, selectedCashier, and customDate
  const now = new Date();
  const filteredTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const todayStr = now.toISOString().split('T')[0];

    // Check cashier match
    const cName = t.cashier || settings.ownerName || 'Admin / Owner';
    if (selectedCashier !== 'all' && cName !== selectedCashier) {
      return false;
    }

    // Check custom date if chosen
    if (customDate) {
      return t.date.startsWith(customDate);
    }

    if (timeFilter === 'today') {
      return t.date.startsWith(todayStr);
    } else if (timeFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return txDate >= sevenDaysAgo;
    } else if (timeFilter === 'month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    } else if (timeFilter === 'year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    return true; // 'all'
  });

  // Calculations on filtered transactions
  const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = filteredTransactions.length;

  const todayStr = now.toISOString().split('T')[0];
  const todayTransactions = filteredTransactions.filter(t => t.date.startsWith(todayStr));
  const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);

  // Best selling products from filtered transactions
  const productSalesMap: { [name: string]: { qty: number; revenue: number } } = {};
  filteredTransactions.forEach(tx => {
    tx.items.forEach(item => {
      if (!productSalesMap[item.name]) {
        productSalesMap[item.name] = { qty: 0, revenue: 0 };
      }
      productSalesMap[item.name].qty += item.quantity;
      productSalesMap[item.name].revenue += item.subtotal;
    });
  });

  const bestSellers = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty);

  // Cashier Performance Grouping & Rating calculations
  const cashierSalesMap: { [name: string]: { qty: number; revenue: number; txCount: number } } = {};
  filteredTransactions.forEach(tx => {
    const cashierName = tx.cashier || settings.ownerName || 'Admin / Owner';
    if (!cashierSalesMap[cashierName]) {
      cashierSalesMap[cashierName] = { qty: 0, revenue: 0, txCount: 0 };
    }
    const qty = tx.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    cashierSalesMap[cashierName].qty += qty;
    cashierSalesMap[cashierName].revenue += tx.total;
    cashierSalesMap[cashierName].txCount += 1;
  });

  const cashierLeaderboard = Object.entries(cashierSalesMap)
    .map(([name, data]) => ({
      name,
      ...data,
      avgOrderValue: data.txCount > 0 ? data.revenue / data.txCount : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const exportReportExcel = () => {
    const summaryData = [
      { Metric: 'Filter Period', Value: timeFilter.toUpperCase() },
      { Metric: 'Total Revenue', Value: totalRevenue },
      { Metric: 'Total Transactions', Value: totalTransactions },
      { Metric: "Today's Revenue", Value: todayRevenue },
      { Metric: "Today's Transactions", Value: todayTransactions.length },
    ];

    const bestSellerData = bestSellers.map(b => ({
      'Product Name': b.name,
      'Units Sold': b.qty,
      'Total Revenue': b.revenue,
    }));

    const cashierLeaderboardData = cashierLeaderboard.map((c, index) => ({
      Rank: index + 1,
      'Cashier Name': c.name,
      'Sales Volume (Qty)': c.qty,
      'Transactions Count': c.txCount,
      'Total Revenue Generated': c.revenue,
      'Average Transaction Value': c.avgOrderValue,
      Rating: index === 0 ? '⭐⭐⭐⭐⭐' : index === 1 ? '⭐⭐⭐⭐' : index === 2 ? '⭐⭐⭐' : '⭐⭐'
    }));

    const workbook = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsBestSellers = XLSX.utils.json_to_sheet(bestSellerData);
    const wsCashiers = XLSX.utils.json_to_sheet(cashierLeaderboardData);

    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(workbook, wsBestSellers, 'Best Sellers');
    XLSX.utils.book_append_sheet(workbook, wsCashiers, 'Cashier Rankings');

    XLSX.writeFile(workbook, `pos-financial-report-${timeFilter}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Business Reports & Analytics</h2>
          <p className="text-sm text-slate-500">Sales performance, revenue summaries, and best-selling products</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportReportExcel}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Reports (.xlsx)
          </button>
        </div>
      </div>

      {/* Filter Control Bar: Period, Specific Date & Cashier Selection */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Period Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>Period:</span>
          </div>
          <button
            onClick={() => {
              setTimeFilter('today');
              setCustomDate('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              timeFilter === 'today' && !customDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              setTimeFilter('7days');
              setCustomDate('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              timeFilter === '7days' && !customDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              setTimeFilter('month');
              setCustomDate('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              timeFilter === 'month' && !customDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => {
              setTimeFilter('year');
              setCustomDate('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              timeFilter === 'year' && !customDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => {
              setTimeFilter('all');
              setCustomDate('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              timeFilter === 'all' && !customDate
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Specific Date & Cashier Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Specific Day Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 font-semibold">Specific Day:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-medium focus:outline-hidden cursor-pointer"
            />
            {customDate && (
              <button
                type="button"
                onClick={() => setCustomDate('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Cashier Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-semibold">Cashier:</span>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-bold focus:outline-hidden cursor-pointer"
            >
              <option value="all" className="dark:bg-slate-900">All Cashiers</option>
              {uniqueCashiers.map((c) => (
                <option key={c} value={c} className="dark:bg-slate-900">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Sales Revenue</span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-2 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}{totalRevenue.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500 uppercase tracking-wider font-medium">
            Period: {timeFilter}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total Transactions</span>
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/50 p-2 text-violet-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {totalTransactions}
          </div>
          <div className="mt-1 text-xs text-slate-500">Completed checkouts in period</div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Today's Revenue</span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-2 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {settings.currency}{todayRevenue.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">
            {todayTransactions.length} orders today
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Catalog Size</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-2 text-amber-600">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {products.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active products</div>
        </div>
      </div>

      {/* Best Selling Products Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-6">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
            Best-Selling Products ({timeFilter === 'today' ? 'Today' : timeFilter === '7days' ? 'Last 7 Days' : timeFilter === 'month' ? 'This Month' : timeFilter === 'year' ? 'This Year' : 'All Time'})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Units Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {bestSellers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      No sales data available for this time period.
                    </td>
                  </tr>
                ) : (
                  bestSellers.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-500">#{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.qty} units</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                        {settings.currency}{item.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cashier Performance Leaderboard and Ratings */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Cashier Performance Ratings ({timeFilter === 'today' ? 'Today' : timeFilter === '7days' ? 'Last 7 Days' : timeFilter === 'month' ? 'This Month' : timeFilter === 'year' ? 'This Year' : 'All Time'})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Cashier Name</th>
                  <th className="py-3 px-4">Orders (Qty)</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {cashierLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No cashier shift activity logged for this period.
                    </td>
                  </tr>
                ) : (
                  cashierLeaderboard.map((cashier, index) => {
                    const stars = index === 0 ? '⭐⭐⭐⭐⭐' : index === 1 ? '⭐⭐⭐⭐' : index === 2 ? '⭐⭐⭐' : '⭐⭐';
                    const badge = index === 0 ? '🏆 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `${index + 1}th`;
                    return (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 font-bold text-slate-500">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                            index === 1 ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' :
                            index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' :
                            'text-slate-500'
                          }`}>
                            {badge}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{cashier.name}</div>
                          <div className="text-[10px] text-slate-400">Avg ticket: {settings.currency}{cashier.avgOrderValue.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {cashier.txCount} ({cashier.qty} pcs)
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-500 text-xs tracking-wider">
                          {stars}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {settings.currency}{cashier.revenue.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
