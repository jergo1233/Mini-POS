/**
 * Inventory Management View Component
 */
import React, { useState } from 'react';
import {
  Boxes,
  Search,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Minus
} from 'lucide-react';
import { Product, Category, Settings, saveProduct } from '../db/indexedDB';
import * as XLSX from 'xlsx';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  settings: Settings;
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  settings,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    const matchesStock = !filterLowStock || p.stock <= settings.lowStockThreshold;
    return matchesQ && matchesStock;
  });

  const handleAdjustStock = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    const updated: Product = {
      ...product,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProduct(updated);
      onRefresh();
    } catch (err) {
      console.error('Adjust stock error:', err);
    }
  };

  const exportExcel = () => {
    const data = products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return {
        'SKU': p.sku,
        'Barcode': p.barcode,
        'Product Name': p.name,
        'Category': cat?.name || 'Uncategorized',
        'Price': p.price,
        'Cost': p.cost || 0,
        'Stock': p.stock,
        'Status': p.stock <= settings.lowStockThreshold ? 'Low Stock' : 'Healthy',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(workbook, `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const lowStockCount = products.filter(p => p.stock <= settings.lowStockThreshold).length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory Management</h2>
          <p className="text-sm text-slate-500">Monitor stock levels, adjustments, and export reports</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-500">Total Tracked Items</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{products.length}</div>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3 text-blue-600">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-500">Low Stock Items</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</div>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-3 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory by name, SKU or barcode..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            filterLowStock
              ? 'bg-amber-600 text-white shadow-sm'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          {filterLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock'}
        </button>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4 text-right">Stock Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No inventory records match your filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const cat = categories.find(c => c.id === product.categoryId);
                  const isLow = product.stock <= settings.lowStockThreshold;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {product.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="text-slate-700 dark:text-slate-300">{product.sku}</div>
                        <div className="text-slate-500">{product.barcode}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {cat?.name || 'Uncategorized'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {settings.currency}{product.price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isLow
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}>
                          {product.stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAdjustStock(product, -1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="Decrease Stock"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{product.stock}</span>
                          <button
                            onClick={() => handleAdjustStock(product, 1)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            title="Increase Stock"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
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
  );
};
