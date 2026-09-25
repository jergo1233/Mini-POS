/**
 * Receipt Modal component
 */
import React from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { Transaction, Settings } from '../db/indexedDB';

interface ReceiptModalProps {
  transaction: Transaction;
  settings: Settings;
  onClose: () => void;
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  settings,
  onClose,
  onNewTransaction,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transaction Complete</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Slip */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 printable-receipt space-y-2">
          <div className="text-center space-y-0.5">
            <div className="font-bold text-sm">{settings.storeName}</div>
            <div>{settings.storeAddress}</div>
            <div>{settings.storeContact}</div>
          </div>

          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-2 space-y-1">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span className="font-bold">{transaction.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{new Date(transaction.date).toLocaleString()}</span>
            </div>
            {transaction.customerName && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{transaction.customerName}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-2">
            <div className="grid grid-cols-12 font-bold pb-1 border-b border-slate-200 dark:border-slate-700">
              <span className="col-span-6">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-4 text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700/50 my-1">
              {transaction.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 py-1">
                  <div className="font-medium truncate">{item.name}</div>
                  <div className="grid grid-cols-12 text-slate-500 dark:text-slate-400">
                    <span className="col-span-6">{settings.currency}{item.price.toFixed(2)} ea</span>
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
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{settings.currency}{transaction.subtotal.toFixed(2)}</span>
            </div>
            {transaction.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-{settings.currency}{transaction.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Total:</span>
              <span>{settings.currency}{transaction.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Payment:</span>
              <span>{settings.currency}{transaction.payment.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600">
              <span>Change:</span>
              <span>{settings.currency}{transaction.change.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 my-2 pt-3 text-center text-[11px] text-slate-500">
            {settings.receiptFooter}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onNewTransaction}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          >
            New Transaction
          </button>
        </div>
      </div>
    </div>
  );
};
