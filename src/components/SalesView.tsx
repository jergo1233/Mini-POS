/**
 * Sales History View Component
 * Uses the enhanced ReceiptModal for thermal receipt preview and direct printing.
 * Preserves unit prices frozen at the time of sale and shows synchronization status.
 */
import React, { useState } from 'react';
import {
  ReceiptText,
  Search,
  FileSpreadsheet,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  User,
  Filter
} from 'lucide-react';
import { Transaction, Settings } from '../db/indexedDB';
import { ReceiptModal } from './ReceiptModal';
import * as XLSX from 'xlsx';

interface SalesViewProps {
  transactions: Transaction[];
  settings: Settings;
  userRole?: 'admin' | 'cashier';
  userName?: string;
  onRefresh?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  transactions,
  settings,
  userRole = 'admin',
  userName,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Unique cashier names list for filter dropdown
  const uniqueCashiers = Array.from(
    new Set(transactions.map((t) => t.cashier || settings.ownerName || 'Admin / Owner'))
  ).filter(Boolean);

  // If cashier and not allowed to view all sales, show their own transactions
  const roleFilteredTransactions =
    userRole === 'cashier' && !settings.cashierCanViewAllSales && userName
      ? transactions.filter((t) => !t.cashier || t.cashier === userName)
      : transactions;

  const filteredTransactions = roleFilteredTransactions.filter((tx) => {
    const q = searchQuery.toLowerCase();
    const matchesQ =
      tx.receiptNo.toLowerCase().includes(q) ||
      (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
      (tx.cashier && tx.cashier.toLowerCase().includes(q));
    const matchesDate = !dateFilter || tx.date.startsWith(dateFilter);
    const txCashierName = tx.cashier || settings.ownerName || 'Admin / Owner';
    const matchesCashier = cashierFilter === 'all' || txCashierName === cashierFilter;
    return matchesQ && matchesDate && matchesCashier;
  });

  const exportExcel = () => {
    const data = filteredTransactions.map((tx) => ({
      'Receipt #': tx.receiptNo,
      'Date & Time': new Date(tx.date).toLocaleString(),
      Cashier: tx.cashier || 'Cashier',
      'Items Count': tx.items.reduce((sum, item) => sum + item.quantity, 0),
      Subtotal: tx.subtotal,
      Discount: tx.discount,
      Total: tx.total,
      Payment: tx.payment,
      Change: tx.change,
      Status: (tx.status || 'completed').toUpperCase(),
      'Transaction ID': tx.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales History');
    XLSX.writeFile(
      workbook,
      `sales-history-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const totalSalesRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-7 h-7 text-blue-600" />
            <span>Sales History & Records</span>
          </h2>
          <p className="text-sm text-slate-500">
            {userRole === 'admin'
              ? 'Review all completed store transactions, unit prices, and sync status'
              : `Viewing transactions processed by ${userName || 'Cashier'}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Sales (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-sm font-medium text-slate-500">Total Transactions</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {filteredTransactions.length}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-sm font-medium text-slate-500">Total Revenue</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {settings.currency}
            {totalSalesRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt #, cashier or customer name..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden"
          >
            <option value="all">All Cashiers</option>
            {uniqueCashiers.map((c) => (
              <option key={c} value={c}>
                👤 {c}
              </option>
            ))}
          </select>

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items Sold</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ReceiptText className="w-10 h-10 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Completed checkout transactions will appear here
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {tx.receiptNo}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {new Date(tx.date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{tx.cashier || 'Cashier'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-900 dark:text-slate-200">
                        {tx.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>{' '}
                      <span className="text-xs text-slate-400">items</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {settings.currency}
                      {tx.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                            tx.status === 'refunded'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          }`}
                        >
                          {tx.status === 'refunded' ? 'Refunded' : 'Completed'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                            tx.syncStatus === 'pending'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {tx.syncStatus === 'pending' ? 'Pending Sync' : 'Synced'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal for viewing and direct printing */}
      {selectedTx && (
        <ReceiptModal
          transaction={selectedTx}
          settings={settings}
          onClose={() => setSelectedTx(null)}
          isReprint={true}
          userRole={userRole}
          userName={userName}
          onRefundComplete={onRefresh}
        />
      )}
    </div>
  );
};
