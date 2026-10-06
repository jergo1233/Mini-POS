/**
 * Inventory Management & Stock Movements Audit View Component
 */
import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Minus,
  History,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Lock,
  ArrowRight,
  Filter
} from 'lucide-react';
import {
  Product,
  Category,
  Settings,
  saveProduct,
  addProductHistoryLog,
  StockMovement,
  getAllStockMovements,
  addStockMovement
} from '../db/indexedDB';
import * as XLSX from 'xlsx';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  settings: Settings;
  onRefresh: () => void;
  userRole?: 'admin' | 'cashier';
  userName?: string;
  isOnline?: boolean;
  onTriggerSync?: () => Promise<boolean>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  settings,
  onRefresh,
  userRole = 'admin',
  userName = 'Admin',
  isOnline = true,
  onTriggerSync,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'movements'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [movementFilter, setMovementFilter] = useState<'all' | 'restock' | 'sale' | 'adjustment'>('all');
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'restock' | 'adjustment'>('restock');

  const loadMovements = async () => {
    try {
      const list = await getAllStockMovements();
      setStockMovements(list);
    } catch (err) {
      console.error('Failed loading stock movements:', err);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [products]);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesQ =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode.includes(q);
    const matchesStock = !filterLowStock || p.stock <= settings.lowStockThreshold;
    return matchesQ && matchesStock;
  });

  const filteredMovements = stockMovements.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesQ =
      m.productName.toLowerCase().includes(q) ||
      m.user.toLowerCase().includes(q) ||
      (m.referenceId && m.referenceId.toLowerCase().includes(q));
    const matchesType = movementFilter === 'all' || m.type === movementFilter;
    return matchesQ && matchesType;
  });

  const handleAdjustStock = async (product: Product, delta: number, customType?: 'restock' | 'adjustment') => {
    if (userRole !== 'admin') {
      alert('Only Store Administrators can adjust or restock inventory.');
      return;
    }

    const newStock = Math.max(0, product.stock + delta);
    const updated: Product = {
      ...product,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveProduct(updated);

      const mType = customType || (delta > 0 ? 'restock' : 'adjustment');

      // Record atomic Stock Movement
      await addStockMovement({
        productId: product.id,
        productName: product.name,
        quantityChange: delta,
        type: mType,
        user: userName || 'Admin',
        role: 'admin',
        syncStatus: isOnline ? 'synced' : 'pending',
        referenceId: `manual-${Date.now()}`,
        stockBefore: product.stock,
        stockAfter: newStock,
      });

      await addProductHistoryLog({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        sku: product.sku,
        action: delta > 0 ? 'restock' : 'edit',
        details:
          delta > 0
            ? `Restocked +${delta} units by ${userName} (Stock: ${product.stock} → ${newStock})`
            : `Adjusted stock by ${delta} units by ${userName} (Stock: ${product.stock} → ${newStock})`,
        stockBefore: product.stock,
        stockAfter: newStock,
        stockAdded: delta > 0 ? delta : undefined,
      });

      onRefresh();
      loadMovements();
      if (onTriggerSync) onTriggerSync().catch(() => {});
    } catch (err) {
      console.error('Adjust stock error:', err);
    }
  };

  const handleSaveModalAdjustment = () => {
    if (!adjustModalProduct) return;
    const delta = adjustType === 'restock' ? Math.abs(adjustQty) : -Math.abs(adjustQty);
    handleAdjustStock(adjustModalProduct, delta, adjustType);
    setAdjustModalProduct(null);
  };

  const exportCurrentInventoryExcel = () => {
    const data = products.map((p) => {
      const cat = categories.find((c) => c.id === p.categoryId);
      return {
        SKU: p.sku,
        Barcode: p.barcode,
        'Product Name': p.name,
        Category: cat?.name || 'Uncategorized',
        Price: p.price,
        Cost: p.cost || 0,
        Stock: p.stock,
        Status: p.stock <= settings.lowStockThreshold ? 'Low Stock' : 'Healthy',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    XLSX.writeFile(
      workbook,
      `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const exportStockMovementsExcel = () => {
    const data = stockMovements.map((m) => ({
      'Date & Time': new Date(m.timestamp).toLocaleString(),
      'Product Name': m.productName,
      'Quantity Change': m.quantityChange,
      'Movement Type': m.type.toUpperCase(),
      User: m.user,
      Role: m.role.toUpperCase(),
      'Stock Before': m.stockBefore ?? 'N/A',
      'Stock After': m.stockAfter ?? 'N/A',
      'Reference ID': m.referenceId || 'N/A',
      'Sync Status': m.syncStatus.toUpperCase(),
      'Movement ID': m.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Movements');
    XLSX.writeFile(
      workbook,
      `stock-movements-audit-${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const lowStockCount = products.filter((p) => p.stock <= settings.lowStockThreshold).length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-7 h-7 text-blue-600" />
            <span>Inventory Management</span>
          </h2>
          <p className="text-sm text-slate-500">
            Atomic stock tracking, audit movement history, restock & sync verification
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'current' ? (
            <button
              onClick={exportCurrentInventoryExcel}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Stock (.xlsx)</span>
            </button>
          ) : (
            <button
              onClick={exportStockMovementsExcel}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Movements (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher: Current Stock vs Stock Movements */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('current')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'current'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Current Stock Levels ({products.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movements Audit Log ({stockMovements.length})</span>
        </button>
      </div>

      {activeTab === 'current' ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500">Total Tracked Products</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {products.length}
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3 text-blue-600">
                <Boxes className="w-6 h-6" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500">Low Stock Warning</div>
                <div className="text-2xl font-bold text-amber-600 mt-1">{lowStockCount}</div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 p-3 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500">Movement Events Logged</div>
                <div className="text-2xl font-bold text-indigo-600 mt-1">
                  {stockMovements.length}
                </div>
              </div>
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/50 p-3 text-indigo-600">
                <History className="w-6 h-6" />
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
                placeholder="Search inventory by product name, SKU or barcode..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                filterLowStock
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {filterLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock'}
            </button>
          </div>

          {/* Current Stock Table */}
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
                    <th className="py-3 px-4 text-right">Admin Stock Restock / Adjust</th>
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
                    filteredProducts.map((product) => {
                      const cat = categories.find((c) => c.id === product.categoryId);
                      const isLow = product.stock <= settings.lowStockThreshold;
                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition"
                        >
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
                            {settings.currency}
                            {product.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isLow
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {product.stock} units
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {userRole === 'admin' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleAdjustStock(product, -1)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  title="Decrease 1"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-9 text-center font-bold text-sm">
                                  {product.stock}
                                </span>
                                <button
                                  onClick={() => handleAdjustStock(product, 1)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  title="Increase 1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setAdjustModalProduct(product);
                                    setAdjustQty(10);
                                    setAdjustType('restock');
                                  }}
                                  className="ml-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold transition"
                                >
                                  Restock +
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                Admin Managed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Stock Movements Audit View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movements by product, user, or receipt..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {(['all', 'restock', 'sale', 'adjustment'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMovementFilter(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                    movementFilter === type
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Quantity Change</th>
                    <th className="py-3 px-4">Stock Before → After</th>
                    <th className="py-3 px-4">User & Role</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-right">Sync Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        No stock movements recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(m.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {m.productName}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              m.type === 'restock'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : m.type === 'sale'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-sm">
                          <span
                            className={
                              m.quantityChange > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">
                          {m.stockBefore !== undefined && m.stockAfter !== undefined
                            ? `${m.stockBefore} → ${m.stockAfter}`
                            : 'Tracked'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {m.user}
                          </span>
                          <span className="text-[10px] text-slate-400 block uppercase">
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-500">
                          {m.referenceId || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              m.syncStatus === 'synced'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                m.syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span className="capitalize">{m.syncStatus}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Restock & Adjustment Modal */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Restock or Adjust Inventory
            </h3>
            <p className="text-xs text-slate-500">
              Product: <strong>{adjustModalProduct.name}</strong> • Current Stock:{' '}
              <strong>{adjustModalProduct.stock} units</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('restock')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      adjustType === 'restock'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Restock (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('adjustment')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      adjustType === 'adjustment'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>Decrease (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-base font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                {[5, 10, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdjustQty(preset)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalAdjustment}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md"
                >
                  Confirm Movement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
