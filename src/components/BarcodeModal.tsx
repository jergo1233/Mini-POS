/**
 * Barcode viewing and printing modal
 */
import React from 'react';
import { X, Printer } from 'lucide-react';
import { Product, Settings } from '../db/indexedDB';
import { BarcodeRenderer } from './BarcodeRenderer';

interface BarcodeModalProps {
  products: Product[];
  settings: Settings;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ products, settings, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Print Product Barcodes</h3>
            <p className="text-xs text-slate-500">Ready for thermal and standard label printing</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <Printer className="w-4 h-4" />
              Print Labels
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 p-2 printable-area">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 flex flex-col items-center text-center shadow-xs page-break-inside-avoid"
            >
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {settings.storeName}
              </div>
              <div className="mt-1 font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
                {product.name}
              </div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400 my-1">
                {settings.currency}{product.price.toFixed(2)}
              </div>
              <div className="my-2 bg-white p-2 rounded border border-slate-100">
                <BarcodeRenderer value={product.barcode} width={1.8} height={40} />
              </div>
              <div className="text-xs font-mono text-slate-500 tracking-widest">
                {product.barcode}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
