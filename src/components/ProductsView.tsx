/**
 * Product Management View Component
 */
import React, { useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Edit,
  Trash2,
  Tag,
  Upload,
  RefreshCw,
  X
} from 'lucide-react';
import { Product, Category, Settings, saveProduct, deleteProduct, generateUniqueBarcode } from '../db/indexedDB';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [description, setDescription] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string>('');

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    const q = searchQuery.toLowerCase();
    const matchesQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    return matchesCat && matchesQ;
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
    setDescription(product.description || '');
    setImageBlob(product.image);
    if (product.image) {
      setImagePreview(typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image));
    } else {
      setImagePreview('');
    }
    setShowModal(true);
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
    const newProduct: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: barcode.trim(),
      name: name.trim(),
      price: Number(price) || 0,
      cost: Number(cost) || 0,
      stock: Number(stock) || 0,
      categoryId,
      description: description.trim(),
      image: imageBlob,
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now,
    };

    try {
      await saveProduct(newProduct);
      setShowModal(false);
      onRefresh();
    } catch (err) {
      console.error('Save product error:', err);
      alert('Failed to save product.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        onRefresh();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete product.');
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Product Management</h2>
          <p className="text-sm text-slate-500">Add, edit, and print barcodes for store products</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBarcodeModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Print Barcodes
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU or barcode..."
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
                    No products found.
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
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          product.stock <= settings.lowStockThreshold
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}>
                          {product.stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="bg-white dark:bg-slate-800 p-1 rounded inline-block border border-slate-200 dark:border-slate-700">
                          <BarcodeRenderer value={product.barcode} width={1.2} height={28} displayValue={false} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
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
                    Initial Stock *
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
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
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
          products={filteredProducts.length > 0 ? filteredProducts : products}
          settings={settings}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
};
