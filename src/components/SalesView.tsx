/**
 * Sales History View Component
 * Uses the enhanced ReceiptModal for full thermal receipt preview and direct printing.
 */
import React, { useState } from 'react';
import {
  ReceiptText,
  Search,
  FileSpreadsheet,
  Calendar,
  Eye
} from 'lucide-react';
import { Transaction, Settings } from '../db/indexedDB';
import { ReceiptModal } from './ReceiptModal';
import * as XLSX from 'xlsx';

interface SalesViewProps {
  transactions: Transaction[];
  settings: Settings;
}

export const SalesView: React.FC<SalesViewProps> = ({ transactions, settings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filteredTransactions = transactions.filter(tx => {
    const q = searchQuery.toLowerCase();
    const matchesQ = tx.receiptNo.toLowerCase().includes(q) || (tx.customerName && tx.customerName.toLowerCase().includes(q));
    const matchesDate = !dateFilter || tx.date.startsWith(dateFilter);
    return matchesQ && matchesDate;
  });

  const exportExcel = () => {
    const data = transactions.map(tx => ({
      'Receipt #': tx.receiptNo,
      'Date & Time': new Date(tx.date).toLocaleString(),
      'Items Count': tx.items.reduce((sum, item) => sum + item.quantity, 0),
      'Subtotal': tx.subtotal,
      'Discount': tx.discount,
      'Total': tx.total,
      'Payment': tx.payment,
      'Change': tx.change,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales History');
    XLSX.writeFile(workbook, `sales-history-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sales History</h2>
          <p className="text-sm text-slate-500">Review completed transactions, receipts, and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Search & Date Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt number or customer..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            Clear Date
          </button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Payment / Change</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <ReceiptText className="w-10 h-10 stroke-1 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold">No transactions found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Completed checkout transactions will appear here</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {tx.receiptNo}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {new Date(tx.date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-900 dark:text-slate-200">
                        {tx.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>{' '}
                      <span className="text-xs text-slate-400">items</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {settings.currency}{tx.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                      Paid: {settings.currency}{tx.payment.toFixed(2)} • Change: {settings.currency}{tx.change.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View / Print Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgraded Universal Thermal Receipt Modal */}
      {selectedTx && (
        <ReceiptModal
          transaction={selectedTx}
          settings={settings}
          onClose={() => setSelectedTx(null)}
          isReprint={true}
        />
      )}
    </div>
  );
};
