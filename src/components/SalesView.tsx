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
  CheckCircle2,
  Clock,
  User,
  Filter,
  RotateCcw,
  AlertTriangle,
  X
} from 'lucide-react';
import { Transaction, Settings, processRefund } from '../db/indexedDB';
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
  const [rowRefundTx, setRowRefundTx] = useState<Transaction | null>(null);
  const [isRefundingRow, setIsRefundingRow] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

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

  const activeTransactions = filteredTransactions.filter((tx) => tx.status !== 'refunded');
  const totalSalesRevenue = activeTransactions.reduce((sum, tx) => sum + tx.total, 0);
  const refundedCount = filteredTransactions.filter((tx) => tx.status === 'refunded').length;

  const handleConfirmRowRefund = async () => {
    if (!rowRefundTx || rowRefundTx.status === 'refunded') return;
    try {
      setIsRefundingRow(true);
      setRefundError(null);
      await processRefund(rowRefundTx.id, userName || 'Staff', userRole);
      setToastMessage(`Receipt #${rowRefundTx.receiptNo} refunded successfully! Items restocked.`);
      setRowRefundTx(null);
      if (onRefresh) onRefresh();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Row refund failed:', err);
      setRefundError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefundingRow(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[99999] flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl text-sm font-bold animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/80 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-7 h-7 text-blue-600" />
            <span>Sales History & Records</span>
          </h2>
          <p className="text-sm text-slate-500">
            {userRole === 'admin'
              ? 'Review all completed store transactions, print receipts, and manage refunds'
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
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-baseline gap-2">
            <span>{filteredTransactions.length}</span>
            {refundedCount > 0 && (
              <span className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                {refundedCount} refunded
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-sm font-medium text-slate-500">Net Sales Revenue</div>
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
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${
                          tx.status === 'refunded'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}
                      >
                        {tx.status === 'refunded' ? (
                          <>
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Refunded</span>
                          </>
                        ) : (
                          'Completed'
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Receipt Button */}
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer active:scale-95"
                          title="View official receipt slip & refund options"
                        >
                          <ReceiptText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>

                        {/* Direct Refund Button if not already refunded */}
                        {tx.status !== 'refunded' ? (
                          <button
                            onClick={() => {
                              setRefundError(null);
                              setRowRefundTx(tx);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer active:scale-95"
                            title="Refund this order and return items to stock"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Refund</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-500/80 px-2 py-1">
                            Refunded
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Direct Refund Confirmation Modal */}
      {rowRefundTx && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 shrink-0">
                <RotateCcw className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Refund Receipt #{rowRefundTx.receiptNo}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Amount: <strong className="text-slate-900 dark:text-white">{settings.currency}{rowRefundTx.total.toFixed(2)}</strong>. This will mark this order as <strong>Refunded</strong> and return <strong>{rowRefundTx.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</strong> back into store stock.
                </p>
              </div>
            </div>

            {refundError && (
              <div className="text-xs font-semibold text-rose-800 bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                {refundError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRowRefundTx(null);
                  setRefundError(null);
                }}
                disabled={isRefundingRow}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRowRefund}
                disabled={isRefundingRow}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-md shadow-rose-600/25 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isRefundingRow ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Refund...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Yes, Confirm Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal for viewing, direct printing, and refunding */}
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
