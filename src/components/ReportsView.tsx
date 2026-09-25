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
  Calendar
} from 'lucide-react';
import { Transaction, Product, Settings } from '../db/indexedDB';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  transactions: Transaction[];
  products: Product[];
  settings: Settings;
}

type TimeFilter = '7days' | 'month' | 'year' | 'all';

export const ReportsView: React.FC<ReportsViewProps> = ({ transactions, products, settings }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Filter transactions based on timeFilter
  const now = new Date();
  const filteredTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    if (timeFilter === '7days') {
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

    const workbook = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsBestSellers = XLSX.utils.json_to_sheet(bestSellerData);

    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(workbook, wsBestSellers, 'Best Sellers');

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

      {/* Time Filter Segmented Control */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs w-fit">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400">
          <Calendar className="w-4 h-4" />
          <span>Period:</span>
        </div>
        <button
          onClick={() => setTimeFilter('7days')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            timeFilter === '7days'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setTimeFilter('month')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            timeFilter === 'month'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          This Month
        </button>
        <button
          onClick={() => setTimeFilter('year')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            timeFilter === 'year'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          This Year
        </button>
        <button
          onClick={() => setTimeFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            timeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Time
        </button>
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
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-6">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
          Best-Selling Products ({timeFilter === '7days' ? 'Last 7 Days' : timeFilter === 'month' ? 'This Month' : timeFilter === 'year' ? 'This Year' : 'All Time'})
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
    </div>
  );
};
