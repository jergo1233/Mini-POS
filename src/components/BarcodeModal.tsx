/**
 * Enhanced Barcode Modal Component
 * Full-viewport modal (z-[100]), no clipping behind desktop sidebar,
 * with search, category filtering, copies multiplier, grid layout switcher, and guaranteed print support.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  LayoutGrid,
  Columns,
  Maximize2,
  Tag
} from 'lucide-react';
import { Product, Settings, Category } from '../db/indexedDB';
import { BarcodeRenderer } from './BarcodeRenderer';

interface BarcodeModalProps {
  products: Product[];
  categories?: Category[];
  settings: Settings;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  products,
  categories = [],
  settings,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(products.map((p) => p.id))
  );
  const [copiesPerItem, setCopiesPerItem] = useState<number>(1);
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(3);
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q));
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const toggleSelectProduct = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProductIds(next);
  };

  const handleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Build the list of labels to render based on selection and copies multiplier
  const printableItems: Product[] = [];
  filteredProducts.forEach((product) => {
    if (selectedProductIds.has(product.id)) {
      for (let i = 0; i < copiesPerItem; i++) {
        printableItems.push(product);
      }
    }
  });

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 md:p-8 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container Card with Full Viewport Clearance */}
      <div className="relative w-full max-w-5xl flex flex-col h-full max-h-[calc(100dvh-2.5rem)] sm:max-h-[92vh] rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 dark:bg-slate-900 transition-all">
        
        {/* 1. Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 shrink-0">
              <Tag className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Print Product Barcode Labels
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thermal & A4 Sticker Sheet Ready • {printableItems.length} label{printableItems.length === 1 ? '' : 's'} queued
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printableItems.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition cursor-pointer ${
                printableItems.length === 0
                  ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 active:scale-98'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print {printableItems.length} Labels</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Controls & Filter Bar (Screen only) */}
        <div className="no-print p-3 sm:p-4 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products to print barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <div className="w-full sm:w-48">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Select All Toggle Button */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </span>
            </button>
          </div>

          {/* Label Customizations: Copies, Grid, Display Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
            {/* Copies per item */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Copies per item:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopiesPerItem(num)}
                    className={`px-2 py-0.5 rounded-lg font-bold transition ${
                      copiesPerItem === num
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Columns */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Grid Layout:</span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setGridColumns(2)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    gridColumns === 2 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  2 Col
                </button>
                <button
                  type="button"
                  onClick={() => setGridColumns(3)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    gridColumns === 3 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  3 Col
                </button>
                <button
                  type="button"
                  onClick={() => setGridColumns(4)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    gridColumns === 4 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  4 Col
                </button>
              </div>
            </div>

            {/* Price & Store toggles */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Show Price</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Show Store Name</span>
              </label>
            </div>
          </div>
        </div>

        {/* 3. Barcode Labels Preview & Printable Grid Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-100/60 dark:bg-slate-950/60 overscroll-contain">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Tag className="w-12 h-12 stroke-1 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No products matching filter</p>
              <p className="text-xs text-slate-400">Try changing your search or category filter above</p>
            </div>
          ) : (
            <div
              className={`printable-barcode-sheet grid gap-3 sm:gap-4 ${
                gridColumns === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : gridColumns === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
              }`}
            >
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleSelectProduct(product.id)}
                    className={`printable-barcode-item relative rounded-2xl p-4 bg-white dark:bg-slate-800 border transition cursor-pointer flex flex-col items-center text-center shadow-xs page-break-inside-avoid ${
                      isSelected
                        ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    {/* Screen Selection Checkbox */}
                    <div className="no-print absolute top-3 right-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    {/* Store Name Header */}
                    {showStoreName && (
                      <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate max-w-[85%]">
                        {settings.storeName || 'MINI POS'}
                      </div>
                    )}

                    {/* Product Name */}
                    <div className="mt-1 font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 leading-tight">
                      {product.name}
                    </div>

                    {/* Price Badge */}
                    {showPrice && (
                      <div className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">
                        {settings.currency}{product.price.toFixed(2)}
                      </div>
                    )}

                    {/* Rendered Barcode Graphic */}
                    <div className="my-2 p-2 bg-white rounded-lg border border-slate-100 w-full flex items-center justify-center overflow-hidden">
                      <BarcodeRenderer
                        value={product.barcode || product.sku || '000000'}
                        width={gridColumns === 4 ? 1.3 : 1.7}
                        height={38}
                      />
                    </div>

                    {/* Human-Readable Code */}
                    <div className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tracking-wider">
                      {product.barcode || product.sku}
                    </div>

                    {/* Multiplier Tag (Screen Only) */}
                    {copiesPerItem > 1 && isSelected && (
                      <div className="no-print mt-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px]">
                        x{copiesPerItem} copies
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Bottom Footer Bar */}
        <div className="no-print px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Selected: <span className="font-bold text-slate-900 dark:text-white">{selectedProductIds.size}</span> of {filteredProducts.length} products ({printableItems.length} total labels)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={printableItems.length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs text-white shadow-md transition cursor-pointer ${
                printableItems.length === 0
                  ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-98'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {printableItems.length} Labels</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
