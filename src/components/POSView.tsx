/**
 * POS Checkout Terminal View Component
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle,
  Tag
} from 'lucide-react';
import { Product, Category, CartItem, Settings, Transaction, TransactionItem, saveTransaction } from '../db/indexedDB';
import { CameraScannerModal } from './CameraScannerModal';
import { ReceiptModal } from './ReceiptModal';

interface POSViewProps {
  products: Product[];
  categories: Category[];
  settings: Settings;
  onTransactionComplete: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  categories,
  settings,
  onTransactionComplete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [payment, setPayment] = useState<number>(0);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // USB Barcode Scanner listener (keyboard input accumulation)
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input field (other than search), ignore
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl !== searchInputRef.current) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim().length > 3) {
          const barcode = barcodeBuffer.trim();
          const matchedProd = products.find(p => p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase());
          if (matchedProd) {
            addToCart(matchedProd);
            setSearchQuery('');
          }
        }
        barcodeBuffer = '';
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    const q = searchQuery.toLowerCase();
    const matchesQuery = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q);
    return matchesCategory && matchesQuery;
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // Check exact barcode or SKU match
    const matched = products.find(p => p.barcode.toLowerCase() === q || p.sku.toLowerCase() === q);
    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`${product.name} is out of stock!`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Cannot add more. Exceeds available stock (${product.stock}).`);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) {
            alert(`Exceeds available stock (${item.product.stock}).`);
            return item;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, payment - total);

  const handleScanBarcode = (barcode: string) => {
    const matched = products.find(p => p.barcode === barcode || p.sku.toLowerCase() === barcode.toLowerCase());
    if (matched) {
      addToCart(matched);
    } else {
      alert(`No product found for barcode: ${barcode}`);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (payment < total) {
      alert('Insufficient payment amount.');
      return;
    }

    const txItems: TransactionItem[] = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      receiptNo,
      date: new Date().toISOString(),
      items: txItems,
      subtotal,
      discount,
      total,
      payment,
      change,
    };

    try {
      await saveTransaction(newTx);
      setCompletedTransaction(newTx);
      onTransactionComplete();
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to complete transaction.');
    }
  };

  const resetCart = () => {
    setCart([]);
    setDiscount(0);
    setPayment(0);
    setCompletedTransaction(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 md:pb-6 h-[calc(100vh-7rem)]">
      {/* Left: Product Catalog & Search (7 cols) */}
      <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs overflow-hidden">
        {/* Search & Camera Barcode Scan */}
        <div className="flex gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name, SKU or barcode..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
          <button
            onClick={() => setShowCameraScanner(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition shrink-0 shadow-sm"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Barcode</span>
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCategoryId === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategoryId === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock <= 0;
            return (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={isOutOfStock}
                className={`flex flex-col text-left rounded-2xl border p-3 transition relative group ${
                  isOutOfStock
                    ? 'opacity-50 border-slate-200 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md bg-white dark:bg-slate-800'
                }`}
              >
                <div className="aspect-square w-full rounded-xl bg-slate-100 dark:bg-slate-700 mb-2 overflow-hidden flex items-center justify-center">
                  {product.image ? (
                    <img
                      src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)}
                      alt={product.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <Tag className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white truncate w-full">
                  {product.name}
                </div>
                <div className="flex items-center justify-between w-full mt-1">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {settings.currency}{product.price.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    Stock: {product.stock}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart & Checkout Panel (5 cols) */}
      <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">Current Cart</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={resetCart}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Clear Cart
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto my-3 divide-y divide-slate-100 dark:divide-slate-800 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
              <ShoppingCart className="w-12 h-12 stroke-1" />
              <p className="text-sm">Cart is empty. Select products or scan barcode.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                    {item.product.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {settings.currency}{item.product.price.toFixed(2)} x {item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 text-xs font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Payment Section */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{settings.currency}{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>Discount</span>
            <input
              type="number"
              min="0"
              value={discount || ''}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-right text-sm dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
            <span>Total Amount</span>
            <span className="text-blue-600 dark:text-blue-400">{settings.currency}{total.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-400">Cash Tendered</span>
            <input
              type="number"
              min="0"
              value={payment || ''}
              onChange={(e) => setPayment(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-right font-bold text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between text-sm font-semibold text-emerald-600">
            <span>Change</span>
            <span>{settings.currency}{change.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || payment < total}
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition flex items-center justify-center gap-2 ${
              cart.length === 0 || payment < total
                ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            Complete Checkout
          </button>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          onScan={handleScanBarcode}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* Receipt Modal */}
      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction}
          settings={settings}
          onClose={() => {
            setCompletedTransaction(null);
            resetCart();
            onTransactionComplete();
          }}
          onNewTransaction={() => {
            setCompletedTransaction(null);
            resetCart();
            onTransactionComplete();
          }}
        />
      )}
    </div>
  );
};
