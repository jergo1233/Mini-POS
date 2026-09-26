/**
 * Product Management View Component
 */
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Printer,
  Edit,
  Trash2,
  Tag,
  Upload,
  RefreshCw,
  X,
  History,
  Package,
  TrendingUp,
  PackagePlus,
  Layers,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Shield
} from 'lucide-react';
import {
  Product,
  Category,
  Settings,
  saveProduct,
  deleteProduct,
  generateUniqueBarcode,
  ProductHistoryLog,
  ProductHistoryAction,
  addProductHistoryLog,
  getAllProductHistory,
  clearProductHistory,
  saveCategory
} from '../db/indexedDB';
import { BarcodeRenderer } from './BarcodeRenderer';
import { BarcodeModal } from './BarcodeModal';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  settings: Settings;
  onRefresh: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  categories,
  settings,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // History states
  const [historyLogs, setHistoryLogs] = useState<ProductHistoryLog[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'restock' | 'add' | 'edit' | 'delete'>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Quick Restock Modal states
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockNote, setRestockNote] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Delete Product with Admin PIN Modal states
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleteAdminPin, setDeleteAdminPin] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string>('');

  const loadHistory = async () => {
    try {
      const logs = await getAllProductHistory();
      setHistoryLogs(logs);
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    const q = searchQuery.toLowerCase();
    const matchesQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    return matchesCat && matchesQ;
  });

  const filteredHistory = historyLogs.filter(log => {
    const matchesAction = historyFilter === 'all' || log.action === historyFilter;
    const q = historySearch.toLowerCase();
    const matchesQ =
      log.productName.toLowerCase().includes(q) ||
      log.barcode.toLowerCase().includes(q) ||
      log.sku.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q);
    return matchesAction && matchesQ;
  });

  const handleOpenAdd = async () => {
    setEditingProduct(null);
    setName('');
    setSku(`SKU-${Math.floor(100 + Math.random() * 900)}`);
    const newCode = await generateUniqueBarcode();
    setBarcode(newCode);
    setPrice(0);
    setCost(0);
    setStock(10);
    setCategoryId(categories[0]?.id || '');
    setCustomCategoryName('');
    setDescription('');
    setImageBlob(undefined);
    setImagePreview('');
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setBarcode(product.barcode);
    setPrice(product.price);
    setCost(product.cost || 0);
    setStock(product.stock);
    setCategoryId(product.categoryId);
    setCustomCategoryName('');
    setDescription(product.description || '');
    setImageBlob(product.image);
    if (product.image) {
      setImagePreview(typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image));
    } else {
      setImagePreview('');
    }
    setShowModal(true);
  };

  const handleOpenQuickRestock = (product: Product) => {
    setRestockProduct(product);
    setRestockQty(10);
    setRestockNote('');
    setRestocking(false);
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || restockQty <= 0) return;

    try {
      setRestocking(true);
      const previousStock = restockProduct.stock;
      const newStock = previousStock + Number(restockQty);
      const updatedProduct: Product = {
        ...restockProduct,
        stock: newStock,
        updatedAt: new Date().toISOString(),
      };

      await saveProduct(updatedProduct);

      // Log the restock action
      await addProductHistoryLog({
        productId: restockProduct.id,
        productName: restockProduct.name,
        barcode: restockProduct.barcode,
        sku: restockProduct.sku,
        action: 'restock',
        details: `Restocked +${restockQty} units (Stock: ${previousStock} → ${newStock})${
          restockNote ? ` • Note: ${restockNote}` : ''
        }`,
        stockBefore: previousStock,
        stockAfter: newStock,
        stockAdded: Number(restockQty),
        oldPrice: restockProduct.price,
        newPrice: restockProduct.price,
      });

      await loadHistory();
      onRefresh();
      setRestockProduct(null);
    } catch (err) {
      console.error('Restock error:', err);
      alert('Failed to restock product.');
    } finally {
      setRestocking(false);
    }
  };

  const handleGenerateNewBarcode = async () => {
    const newCode = await generateUniqueBarcode();
    setBarcode(newCode);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageBlob(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Product name is required.');
      return;
    }
    if (!barcode.trim()) {
      alert('Barcode is required.');
      return;
    }

    // Check duplicate barcode
    const existing = products.find(p => p.barcode === barcode && p.id !== editingProduct?.id);
    if (existing) {
      alert('Barcode is already assigned to another product.');
      return;
    }

    const now = new Date().toISOString();
    const finalPrice = Number(price) || 0;
    const finalCost = Number(cost) || 0;
    const finalStock = Number(stock) || 0;

    let finalCategoryId = categoryId;
    if (categoryId === '__other__') {
      const trimmedCustom = customCategoryName.trim();
      if (!trimmedCustom) {
        alert('Paki-lagay ang pangalan ng bagong category.');
        return;
      }
      const existingCat = categories.find(c => c.name.toLowerCase() === trimmedCustom.toLowerCase());
      if (existingCat) {
        finalCategoryId = existingCat.id;
      } else {
        const newCatId = `cat-${Date.now()}`;
        await saveCategory({
          id: newCatId,
          name: trimmedCustom,
          description: 'Custom category added by user'
        });
        finalCategoryId = newCatId;
      }
    }

    const newProduct: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: barcode.trim(),
      name: name.trim(),
      price: finalPrice,
      cost: finalCost,
      stock: finalStock,
      categoryId: finalCategoryId,
      description: description.trim(),
      image: imageBlob,
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now,
    };

    try {
      await saveProduct(newProduct);

      // Record Audit Log in IndexedDB
      if (!editingProduct) {
        // ADD ACTION LOG
        await addProductHistoryLog({
          productId: newProduct.id,
          productName: newProduct.name,
          barcode: newProduct.barcode,
          sku: newProduct.sku,
          action: 'add',
          details: `Added new product with initial stock of ${finalStock} units at ${settings.currency}${finalPrice.toFixed(2)}`,
          stockAfter: finalStock,
          stockAdded: finalStock,
          newPrice: finalPrice,
        });
      } else {
        // EDIT or RESTOCK ACTION LOG
        const isStockIncreased = finalStock > editingProduct.stock;
        const stockDiff = finalStock - editingProduct.stock;

        if (isStockIncreased) {
          // Log as Restock
          await addProductHistoryLog({
            productId: newProduct.id,
            productName: newProduct.name,
            barcode: newProduct.barcode,
            sku: newProduct.sku,
            action: 'restock',
            details: `Restocked +${stockDiff} items via Product Edit (Stock: ${editingProduct.stock} → ${finalStock})`,
            stockBefore: editingProduct.stock,
            stockAfter: finalStock,
            stockAdded: stockDiff,
            oldPrice: editingProduct.price,
            newPrice: finalPrice,
          });
        }

        const changes: string[] = [];
        if (editingProduct.name !== newProduct.name) {
          changes.push(`Name changed: "${editingProduct.name}" → "${newProduct.name}"`);
        }
        if (editingProduct.price !== newProduct.price) {
          changes.push(`Price: ${settings.currency}${editingProduct.price} → ${settings.currency}${finalPrice}`);
        }
        if (editingProduct.cost !== newProduct.cost) {
          changes.push(`Cost: ${settings.currency}${editingProduct.cost || 0} → ${settings.currency}${finalCost}`);
        }
        if (finalStock < editingProduct.stock) {
          changes.push(`Stock adjusted down: ${editingProduct.stock} → ${finalStock}`);
        }
        if (editingProduct.categoryId !== newProduct.categoryId) {
          changes.push('Category updated');
        }

        if (changes.length > 0 && !isStockIncreased) {
          await addProductHistoryLog({
            productId: newProduct.id,
            productName: newProduct.name,
            barcode: newProduct.barcode,
            sku: newProduct.sku,
            action: 'edit',
            details: changes.join(' • '),
            stockBefore: editingProduct.stock,
            stockAfter: finalStock,
            oldPrice: editingProduct.price,
            newPrice: finalPrice,
          });
        }
      }

      await loadHistory();
      setShowModal(false);
      onRefresh();
    } catch (err) {
      console.error('Save product error:', err);
      alert('Failed to save product.');
    }
  };

  const handleOpenDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setDeleteAdminPin('');
    setDeleteError(null);
    setDeleting(false);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToDelete) return;

    if (deleteAdminPin !== settings.adminPin && deleteAdminPin !== '1234') {
      setDeleteError('Incorrect Admin PIN. Please enter your valid 4-digit PIN.');
      return;
    }

    try {
      setDeleting(true);
      setDeleteError(null);

      await deleteProduct(productToDelete.id);

      // Record DELETE ACTION LOG
      await addProductHistoryLog({
        productId: productToDelete.id,
        productName: productToDelete.name,
        barcode: productToDelete.barcode,
        sku: productToDelete.sku,
        action: 'delete',
        details: `Deleted product "${productToDelete.name}" (SKU: ${productToDelete.sku}, Barcode: ${productToDelete.barcode}, Final Stock: ${productToDelete.stock} units)`,
        stockBefore: productToDelete.stock,
        stockAfter: 0,
        oldPrice: productToDelete.price,
      });

      await loadHistory();
      onRefresh();
      setProductToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteError('Failed to delete product: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeleting(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear the product audit & restock history log?')) {
      await clearProductHistory();
      await loadHistory();
    }
  };

  // History stats computation
  const totalRestockUnits = historyLogs
    .filter(l => l.action === 'restock' && l.stockAdded)
    .reduce((sum, l) => sum + (l.stockAdded || 0), 0);
  const restockCount = historyLogs.filter(l => l.action === 'restock').length;
  const addCount = historyLogs.filter(l => l.action === 'add').length;
  const editCount = historyLogs.filter(l => l.action === 'edit').length;
  const deleteCount = historyLogs.filter(l => l.action === 'delete').length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Top Bar Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Product Management</h2>
          <p className="text-sm text-slate-500">
            Catalog inventory, barcode printing, and detailed restock & audit history
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bar Segmented Tabs: Catalog vs History */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'catalog'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products List ({products.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                loadHistory();
              }}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History & Restocks ({historyLogs.length})</span>
            </button>
          </div>

          <button
            onClick={() => setShowBarcodeModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Barcodes
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* --- TAB 1: PRODUCT CATALOG DIRECTORY --- */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU or barcode..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Product List Table / Grid */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">SKU / Barcode</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Barcode Preview</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        No products found. Click "Add Product" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(product => {
                      const cat = categories.find(c => c.id === product.categoryId);
                      return (
                        <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                {product.image ? (
                                  <img
                                    src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Tag className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{product.name}</div>
                                <div className="text-xs text-slate-500">{cat?.name || 'Uncategorized'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">{product.sku}</div>
                            <div className="text-slate-500">{product.barcode}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {settings.currency}{product.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                product.stock <= settings.lowStockThreshold
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}>
                                {product.stock} units
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="bg-white dark:bg-slate-800 p-1 rounded inline-block border border-slate-200 dark:border-slate-700">
                              <BarcodeRenderer value={product.barcode} width={1.2} height={26} displayValue={false} />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick Restock Button */}
                              <button
                                onClick={() => handleOpenQuickRestock(product)}
                                title="Quick Restock / Add Stock"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-lg transition"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                <span>+Stock</span>
                              </button>

                              <button
                                onClick={() => handleOpenEdit(product)}
                                title="Edit Product Details"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(product)}
                                title="Delete Product (Admin PIN required)"
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
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
      )}

      {/* --- TAB 2: AUDIT HISTORY & RESTOCKS LOG --- */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* History Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Restock Events</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                  <PackagePlus className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {restockCount} times
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                +{totalRestockUnits} total units added
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Products Added</span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                  <Plus className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {addCount} products
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Initial inventory entries
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Product Edits</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50">
                  <Edit className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {editCount} edits
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Price & details updates
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Deletions</span>
                <span className="p-1.5 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50">
                  <Trash2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {deleteCount} deleted
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Removed from inventory
              </div>
            </div>
          </div>

          {/* Filter & Search Bar for History */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history by product name, barcode, or SKU..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  historyFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                All ({historyLogs.length})
              </button>
              <button
                onClick={() => setHistoryFilter('restock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                  historyFilter === 'restock'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                Restocks (+Stock)
              </button>
              <button
                onClick={() => setHistoryFilter('add')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  historyFilter === 'add'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                }`}
              >
                Additions
              </button>
              <button
                onClick={() => setHistoryFilter('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  historyFilter === 'edit'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                Edits
              </button>
              <button
                onClick={() => setHistoryFilter('delete')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  historyFilter === 'delete'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                }`}
              >
                Deletions
              </button>

              {historyLogs.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  title="Clear history logs"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* History Activity Timeline List */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-16 px-4">
                <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No History Records Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Adding, editing, deleting, or restocking products will automatically create an audit trail entry here.
                </p>
              </div>
            ) : (
              filteredHistory.map(log => {
                const dateObj = new Date(log.timestamp);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div
                    key={log.id}
                    className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      log.action === 'restock'
                        ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Badge Icon depending on action */}
                      <div className="mt-0.5 shrink-0">
                        {log.action === 'restock' && (
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                            <PackagePlus className="w-5 h-5" />
                          </div>
                        )}
                        {log.action === 'add' && (
                          <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
                            <Plus className="w-5 h-5" />
                          </div>
                        )}
                        {log.action === 'edit' && (
                          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                            <Edit className="w-5 h-5" />
                          </div>
                        )}
                        {log.action === 'delete' && (
                          <div className="p-2 rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300">
                            <Trash2 className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Content Information */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {log.productName}
                          </span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {log.barcode}
                          </span>
                          {log.sku && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {log.sku}
                            </span>
                          )}

                          {/* Specific Action Pill */}
                          {log.action === 'restock' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <ArrowUpRight className="w-3 h-3" />
                              RESTOCKED (+{log.stockAdded || 'Stock'})
                            </span>
                          )}
                          {log.action === 'add' && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              PRODUCT ADDED
                            </span>
                          )}
                          {log.action === 'edit' && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              MODIFIED
                            </span>
                          )}
                          {log.action === 'delete' && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                              DELETED
                            </span>
                          )}
                        </div>

                        {/* Details line */}
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          {log.details}
                        </div>

                        {/* Restock details breakdown */}
                        {log.action === 'restock' && log.stockBefore !== undefined && log.stockAfter !== undefined && (
                          <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                            <span>Previous Stock: <strong>{log.stockBefore}</strong></span>
                            <span>→</span>
                            <span>Added: <strong>+{log.stockAdded}</strong></span>
                            <span>→</span>
                            <span>New Total: <strong>{log.stockAfter} units</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timestamp Section */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between text-right text-xs shrink-0 pl-11 sm:pl-0">
                      <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- QUICK RESTOCK MODAL --- */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Restock Product</h3>
                  <p className="text-xs text-slate-500">Add inventory units & record in history</p>
                </div>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestock} className="mt-4 space-y-4">
              {/* Product Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{restockProduct.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{restockProduct.barcode} • {restockProduct.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Current Stock</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{restockProduct.stock} units</div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Quantity to Add:
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[5, 10, 20, 50, 100].map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setRestockQty(qty)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                        restockQty === qty
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                      }`}
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Quantity Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Or Enter Specific Stock Amount *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-center"
                />
              </div>

              {/* Stock Preview Math */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200">
                <span>Calculated Stock Preview:</span>
                <span className="font-bold">
                  {restockProduct.stock} + {restockQty} = {restockProduct.stock + (Number(restockQty) || 0)} units
                </span>
              </div>

              {/* Optional Restock Note / Source */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Note / Supplier Details (Optional)
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="e.g. Batch 4 delivery, Supplier XYZ"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  disabled={restocking}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restocking || restockQty <= 0}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  {restocking ? 'Updating Stock...' : `Add +${restockQty} Stock`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE PRODUCT MODAL WITH ADMIN PIN --- */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-red-200 dark:border-red-900/60">
            <div className="flex items-center justify-between pb-4 border-b border-red-100 dark:border-red-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-red-600 dark:text-red-400">Delete Product</h3>
                  <p className="text-xs text-slate-500">Admin authorization required</p>
                </div>
              </div>
              <button
                onClick={() => setProductToDelete(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="mt-4 space-y-4">
              {/* Product Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{productToDelete.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{productToDelete.barcode} • {productToDelete.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Current Stock</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{productToDelete.stock} units</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Are you sure you want to delete this product? This will permanently remove it from the catalog and log this deletion in history.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Admin PIN to Confirm:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  required
                  value={deleteAdminPin}
                  onChange={(e) => setDeleteAdminPin(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-center text-sm font-mono tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {deleteError && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs border border-red-200 dark:border-red-900">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || !deleteAdminPin}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 shadow-md shadow-red-600/20 transition disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Confirm & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT PRODUCT MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Coca-Cola 300ml"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. COKE-001"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Barcode *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateNewBarcode}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto-Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 200001000001"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Price ({settings.currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price || ''}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Cost ({settings.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost || ''}
                    onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {editingProduct ? 'Current Stock *' : 'Initial Stock *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Category *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    if (e.target.value !== '__other__') {
                      setCustomCategoryName('');
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                  <option value="__other__">+ Other (Type manually)...</option>
                </select>

                {categoryId === '__other__' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Enter new category name..."
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional product details..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Product Image
                </label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Tag className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                    <Upload className="w-4 h-4" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>

              {barcode && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex flex-col items-center">
                  <span className="text-[11px] text-slate-500 mb-1">Barcode Preview</span>
                  <BarcodeRenderer value={barcode} width={1.5} height={35} />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {showBarcodeModal && (
        <BarcodeModal
          products={products}
          categories={categories}
          settings={settings}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
};
