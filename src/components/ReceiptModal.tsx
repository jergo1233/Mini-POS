/**
 * Enhanced POS Thermal Receipt Modal Component
 * Features realistic thermal receipt styling, barcode generation, paper size toggles (58mm/80mm),
 * custom store settings (TIN, logo, header/footer, cashier toggle), direct print, copy digital slip, native share, and file download.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  CheckCircle2,
  ShoppingBag,
  ArrowRight,
  Copy,
  Share2,
  Check,
  Download,
  Receipt,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  User,
  Hash,
  FileBadge
} from 'lucide-react';
import { Transaction, Settings } from '../db/indexedDB';

interface ReceiptModalProps {
  transaction: Transaction;
  settings: Settings;
  onClose: () => void;
  onNewTransaction?: () => void;
  isReprint?: boolean;
}

type PaperSize = '80mm' | '58mm' | 'full';

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  settings,
  onClose,
  onNewTransaction,
  isReprint = false,
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>(
    (settings.receiptPaperSize as PaperSize) || '80mm'
  );
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const totalItemsCount = transaction.items.reduce((sum, i) => sum + i.quantity, 0);
  const formattedDate = new Date(transaction.date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Handle direct window print with fallback
  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Print error:', e);
      handleDownload();
    }
  };

  // Generate plain text receipt format for clipboard & sharing
  const generateTextReceipt = () => {
    const divider = '------------------------------------------';
    const store = settings.storeName || 'MINI POS STORE';
    const address = settings.storeAddress ? `${settings.storeAddress}\n` : '';
    const contact = settings.storeContact ? `Tel: ${settings.storeContact}\n` : '';
    const tin = settings.storeTin ? `TIN: ${settings.storeTin}\n` : '';
    const header = settings.receiptHeader ? `${settings.receiptHeader}\n` : '';
    
    let itemsList = '';
    transaction.items.forEach((item) => {
      itemsList += `${item.name}\n  ${item.quantity} x ${settings.currency}${item.price.toFixed(2)} = ${settings.currency}${item.subtotal.toFixed(2)}\n`;
    });

    return `==========================================
${store.toUpperCase()}
${address}${contact}${tin}${header ? `\n${header}\n` : ''}==========================================
RECEIPT #: ${transaction.receiptNo}
DATE: ${formattedDate}
${settings.showCashierOnReceipt !== false ? `CASHIER: ${transaction.cashier || settings.ownerName || 'Admin'}\n` : ''}${transaction.customerName && settings.showCustomerOnReceipt !== false ? `CUSTOMER: ${transaction.customerName}\n` : ''}${divider}
ITEMS:
${itemsList}${divider}
Subtotal: ${settings.currency}${transaction.subtotal.toFixed(2)}
${transaction.discount > 0 ? `Discount: -${settings.currency}${transaction.discount.toFixed(2)}\n` : ''}TOTAL AMOUNT: ${settings.currency}${transaction.total.toFixed(2)}
Cash Tendered: ${settings.currency}${transaction.payment.toFixed(2)}
Change Due: ${settings.currency}${transaction.change.toFixed(2)}
==========================================
${settings.receiptFooter || 'Thank you for your business!'}
==========================================`;
  };

  // Copy plain text receipt to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateTextReceipt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Share receipt via Web Share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${transaction.receiptNo} - ${settings.storeName}`,
          text: generateTextReceipt(),
        });
      } catch (err) {
        console.debug('Share cancelled or not supported:', err);
      }
    } else {
      handleCopyText();
    }
  };

  // Download receipt as text file
  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([generateTextReceipt()], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Receipt_${transaction.receiptNo}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const isFontMono = settings.receiptFontFamily !== 'sans';

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 pb-20 sm:pb-6 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="relative w-full max-w-xl flex flex-col h-full max-h-[calc(100dvh-5.5rem)] sm:max-h-[90vh] rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-all">
        
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400 shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {isReprint ? 'Receipt Slip (Reprint)' : 'Transaction Complete'}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <Sparkles className="w-2.5 h-2.5" />
                  Paid
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Receipt #{transaction.receiptNo} • {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Receipt"
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Paper Size & View Format Toolbar */}
        <div className="px-4 sm:px-5 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Format:</span>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPaperSize('80mm')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                paperSize === '80mm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              80mm Thermal
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('58mm')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                paperSize === '58mm'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              58mm Portable
            </button>
            <button
              type="button"
              onClick={() => setPaperSize('full')}
              className={`hidden sm:block px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                paperSize === 'full'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Standard A4
            </button>
          </div>
        </div>

        {/* 3. Scrollable Receipt Slip Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-100/70 dark:bg-slate-950/60 overscroll-contain flex justify-center">
          
          {/* Printable Thermal Receipt Paper */}
          <div
            id="printable-receipt-slip"
            className={`w-full bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200/80 ${
              isFontMono ? 'font-mono' : 'font-sans'
            } text-xs printable-receipt space-y-3 relative transition-all duration-200 ${
              paperSize === '58mm'
                ? 'max-w-[310px] p-4 text-[11px] receipt-58mm'
                : paperSize === 'full'
                ? 'max-w-md p-6 text-xs receipt-full'
                : 'max-w-[380px] p-5 text-xs'
            }`}
          >
            {/* Top Zigzag / Sawtooth Paper Edge Accent (Screen only) */}
            <div className="no-print absolute -top-1 left-2 right-2 h-1 flex justify-between overflow-hidden opacity-30">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-300 rotate-45 shrink-0 -mt-0.5" />
              ))}
            </div>

            {/* Official Store Branding Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
              <div className="flex items-center justify-center gap-1.5 font-sans font-black text-base sm:text-lg text-slate-950 tracking-tight">
                {settings.showLogoOnReceipt !== false && <ShoppingBag className="w-5 h-5 text-blue-600" />}
                <span>{settings.storeName || 'MINI POS SYSTEM'}</span>
              </div>
              
              {settings.storeAddress && (
                <div className="text-slate-600 text-[11px] leading-tight flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{settings.storeAddress}</span>
                </div>
              )}
              {settings.storeContact && (
                <div className="text-slate-600 text-[11px] flex items-center justify-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Tel: {settings.storeContact}</span>
                </div>
              )}
              {settings.storeTin && (
                <div className="text-slate-600 text-[11px] flex items-center justify-center gap-1">
                  <FileBadge className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>TIN: {settings.storeTin}</span>
                </div>
              )}

              {settings.receiptHeader && (
                <div className="text-[11px] font-medium text-slate-600 italic mt-0.5">
                  {settings.receiptHeader}
                </div>
              )}

              <div className="inline-block mt-1 px-2.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold tracking-wider text-slate-700 uppercase">
                Official Sales Receipt
              </div>
            </div>

            {/* Transaction Metadata Details */}
            <div className="space-y-1 text-[11px] text-slate-700 py-1">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-500">
                  <Hash className="w-3 h-3" /> Receipt No:
                </span>
                <span className="font-bold font-mono text-slate-900">{transaction.receiptNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-500">
                  <Calendar className="w-3 h-3" /> Date & Time:
                </span>
                <span className="font-medium text-slate-900">{formattedDate}</span>
              </div>
              {settings.showCashierOnReceipt !== false && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-slate-500">
                    <User className="w-3 h-3" /> Cashier / Server:
                  </span>
                  <span className="font-medium text-slate-900">{transaction.cashier || settings.ownerName || 'Admin Cashier'}</span>
                </div>
              )}
              {transaction.customerName && settings.showCustomerOnReceipt !== false && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{transaction.customerName}</span>
                </div>
              )}
            </div>

            {/* Items Breakdown Table */}
            <div className="border-t-2 border-dashed border-slate-300 pt-2.5">
              <div className="grid grid-cols-12 font-bold text-[11px] pb-1.5 border-b border-slate-300 text-slate-900 uppercase">
                <span className="col-span-6">Item / Desc</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-4 text-right">Total</span>
              </div>
              
              <div className="divide-y divide-slate-100 my-1">
                {transaction.items.map((item, index) => (
                  <div key={index} className="py-2 space-y-0.5 page-break-inside-avoid">
                    <div className="font-bold text-slate-950 truncate leading-snug">
                      {item.name}
                    </div>
                    <div className="grid grid-cols-12 text-slate-600 text-[11px]">
                      <span className="col-span-6">
                        {settings.currency}{item.price.toFixed(2)} ea
                      </span>
                      <span className="col-span-2 text-center font-bold text-slate-800">
                        x{item.quantity}
                      </span>
                      <span className="col-span-4 text-right font-black text-slate-950">
                        {settings.currency}{item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals & Payment Breakdown */}
            <div className="border-t-2 border-dashed border-slate-300 pt-2.5 space-y-1.5 text-xs text-slate-800">
              <div className="flex justify-between text-slate-600">
                <span>Total Items Sold:</span>
                <span className="font-bold">{totalItemsCount} units</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{settings.currency}{transaction.subtotal.toFixed(2)}</span>
              </div>

              {transaction.discount > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Special Discount:</span>
                  <span>-{settings.currency}{transaction.discount.toFixed(2)}</span>
                </div>
              )}

              {settings.showTaxOnReceipt && settings.taxRate > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT / Tax ({settings.taxRate}%):</span>
                  <span>{settings.currency}{((transaction.total * settings.taxRate) / (100 + settings.taxRate)).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-base text-slate-950 pt-2 border-t-2 border-slate-900">
                <span>TOTAL AMOUNT:</span>
                <span>{settings.currency}{transaction.total.toFixed(2)}</span>
              </div>

              <div className="flex justify-between pt-1.5 text-slate-700">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase">Cash</span>
              </div>

              <div className="flex justify-between text-slate-700">
                <span>Cash Tendered:</span>
                <span className="font-bold">{settings.currency}{transaction.payment.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-bold text-slate-950 text-sm pt-1 border-t border-dashed border-slate-300">
                <span>CHANGE DUE:</span>
                <span className="text-emerald-700 font-black">{settings.currency}{transaction.change.toFixed(2)}</span>
              </div>
            </div>

            {/* Custom Thank-you Footer Note */}
            <div className="border-t border-dashed border-slate-200 pt-2 text-center text-[10px] text-slate-500 leading-normal">
              {settings.receiptFooter || 'Thank you for your purchase! Please come again.'}
            </div>

            {/* Bottom Sawtooth Paper Edge Accent (Screen only) */}
            <div className="no-print absolute -bottom-1 left-2 right-2 h-1 flex justify-between overflow-hidden opacity-30">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-300 rotate-45 shrink-0 -mb-0.5" />
              ))}
            </div>
          </div>
        </div>

        {/* 4. Bottom Action Bar (STICKY & ELEVATED) */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-20 shadow-[0_-8px_16px_rgba(0,0,0,0.04)] space-y-2">
          {/* Quick Sharing Toolbar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
              title="Copy text slip to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Slip!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
              title="Share receipt via SMS, WhatsApp, Messenger"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer"
              title="Save receipt slip as text file"
            >
              {downloaded ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloaded ? 'Saved!' : 'Save TXT'}</span>
            </button>
          </div>

          {/* Primary Print and New Sale / Close Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white py-3 text-xs sm:text-sm font-bold text-white transition active:scale-98 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            {onNewTransaction ? (
              <button
                type="button"
                onClick={onNewTransaction}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-blue-500/25 transition cursor-pointer"
              >
                <span>Next Sale</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-98 py-3 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <span>Close</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
