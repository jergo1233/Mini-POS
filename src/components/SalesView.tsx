/**
 * Sales History View Component
 */
import React, { useState } from 'react';
import {
  ReceiptText,
  Search,
  FileSpreadsheet,
  Calendar,
  Eye,
  X,
  Printer
} from 'lucide-react';
import { Transaction, Settings } from '../db/indexedDB';
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

  const handlePrint = () => {
    window.print();
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
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
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
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
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
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const totalQty = tx.items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {tx.receiptNo}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                        {new Date(tx.date).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {totalQty} items
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400">
                        {settings.currency}{tx.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        <div>Paid: {settings.currency}{tx.payment.toFixed(2)}</div>
                        <div className="text-emerald-600">Change: {settings.currency}{tx.change.toFixed(2)}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg"
                          title="View Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Details</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 space-y-2">
              <div className="text-center font-bold text-sm">{settings.storeName}</div>
              <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">{selectedTx.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(selectedTx.date).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-2">
                <div className="grid grid-cols-12 font-bold pb-1 border-b border-slate-200">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Amount</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700/50 my-1">
                  {selectedTx.items.map((item, idx) => (
                    <div key={idx} className="py-1">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="grid grid-cols-12 text-slate-500">
                        <span className="col-span-6">{settings.currency}{item.price.toFixed(2)}</span>
                        <span className="col-span-2 text-center">x{item.quantity}</span>
                        <span className="col-span-4 text-right font-semibold text-slate-900 dark:text-white">
                          {settings.currency}{item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-2 space-y-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>Total:</span>
                  <span>{settings.currency}{selectedTx.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span>{settings.currency}{selectedTx.payment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Change:</span>
                  <span>{settings.currency}{selectedTx.change.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
