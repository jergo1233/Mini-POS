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
  Tag,
  LayoutGrid,
  List,
  ArrowRight,
  ArrowLeft,
  Package,
  Sparkles
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
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
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
    const cleanCode = barcode.trim();
    if (!cleanCode) {
      return { success: false, message: 'Invalid barcode' };
    }

    const matched = products.find(
      p => p.barcode === cleanCode || p.sku.toLowerCase() === cleanCode.toLowerCase()
    );

    if (!matched) {
      return {
        success: false,
        message: `No product found for barcode: ${cleanCode}`,
      };
    }

    if (matched.stock <= 0) {
      return {
        success: false,
        message: `Out of stock: ${matched.name}`,
        product: matched,
      };
    }

    const existing = cart.find(item => item.product.id === matched.id);
    if (existing && existing.quantity >= matched.stock) {
      return {
        success: false,
        message: `Exceeds stock limit (${matched.stock} available)`,
        product: matched,
      };
    }

    // Add product to cart
    setCart(prev => {
      const found = prev.find(item => item.product.id === matched.id);
      if (found) {
        return prev.map(item =>
          item.product.id === matched.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { product: matched, quantity: 1 }];
      }
    });

    const newQty = (existing?.quantity || 0) + 1;
    return {
      success: true,
      message: `${matched.name} (Qty: ${newQty}) • ${settings.currency}${matched.price.toFixed(2)}`,
      product: matched,
      quantity: newQty,
    };
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

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddCash = (amount: number) => {
    setPayment(prev => Math.round((prev + amount) * 100) / 100);
  };

  const handleExactCash = () => {
    setPayment(total);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100vh-7rem)] overflow-hidden">
      {/* Mobile Top Navigation Segmented Switcher (Visible only on mobile/tablet) */}
      <div className="lg:hidden flex items-center justify-between gap-2 p-1.5 mb-2 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl shrink-0 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition duration-200 ${
            mobileTab === 'catalog'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products ({filteredProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm transition duration-200 relative ${
            mobileTab === 'cart'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Cart ({totalItemsCount})</span>
          {total > 0 && (
            <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold">
              {settings.currency}{total.toFixed(0)}
            </span>
          )}
        </button>
      </div>

      {/* Main Grid: Responsive Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 min-h-0 overflow-hidden">
        {/* Left: Product Catalog Container (Enlarged for Mobile) */}
        <div
          className={`lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs overflow-hidden h-full min-h-0 ${
            mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search, Barcode Scan, & Layout View Toggles */}
          <div className="flex flex-col sm:flex-row gap-2.5 pb-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, SKU or barcode..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>

            <div className="flex items-center gap-2 shrink-0">
              {/* Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:scale-98 transition shadow-md shadow-blue-500/20 shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Camera</span>
              </button>

              {/* Grid vs List Layout Toggle */}
              <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  title="Grid View"
                  className={`p-1.5 rounded-xl transition ${
                    viewLayout === 'grid'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  title="List View"
                  className={`p-1.5 rounded-xl transition ${
                    viewLayout === 'list'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Categories Bar */}
          <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar shrink-0">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition duration-150 ${
                selectedCategoryId === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map(cat => {
              const count = products.filter(p => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition duration-150 ${
                    selectedCategoryId === cat.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Product Items Display Area */}
          <div className="flex-1 overflow-y-auto mt-1 pr-1 pb-16 lg:pb-2">
            {filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <Package className="w-12 h-12 stroke-1 mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold">No products found matching your search</p>
                <p className="text-xs text-slate-400 mt-1">Try searching a different SKU, name, or barcode</p>
              </div>
            ) : viewLayout === 'grid' ? (
              /* High-Visibility Large Grid Layout */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.stock <= 0;
                  const inCartItem = cart.find(i => i.product.id === product.id);
                  const isLowStock = !isOutOfStock && product.stock <= 5;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`group flex flex-col text-left rounded-2xl sm:rounded-3xl border p-3 sm:p-3.5 transition-all duration-200 relative select-none ${
                        isOutOfStock
                          ? 'opacity-50 border-slate-200 bg-slate-50 dark:bg-slate-800/30 cursor-not-allowed'
                          : inCartItem
                          ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20 shadow-sm'
                          : 'border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500 hover:shadow-md bg-white dark:bg-slate-800 active:scale-[0.98]'
                      }`}
                    >
                      {/* Product Image Preview */}
                      <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700/60 mb-2.5 overflow-hidden flex items-center justify-center">
                        {product.image ? (
                          <img
                            src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)}
                            alt={product.name}
                            className="h-full w-full object-cover group-hover:scale-108 transition duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Tag className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 dark:text-slate-500" />
                          </div>
                        )}

                        {/* Cart Quantity Badge (if in cart) */}
                        {inCartItem && (
                          <span className="absolute top-2 right-2 flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-black shadow-md">
                            {inCartItem.quantity}x
                          </span>
                        )}

                        {/* Stock Tag Pill */}
                        <div className="absolute bottom-2 left-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md shadow-xs ${
                              isOutOfStock
                                ? 'bg-rose-500/90 text-white'
                                : isLowStock
                                ? 'bg-amber-500/90 text-white'
                                : 'bg-slate-900/75 text-white dark:bg-slate-800/90'
                            }`}
                          >
                            {isOutOfStock ? 'Out of stock' : `Stock: ${product.stock}`}
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-2 leading-tight">
                            {product.name}
                          </div>
                          {product.barcode && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              {product.barcode}
                            </div>
                          )}
                        </div>

                        {/* Price & Add Indicator */}
                        <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
                            {settings.currency}{product.price.toFixed(2)}
                          </span>

                          <span
                            className={`flex items-center justify-center h-7 w-7 rounded-xl transition ${
                              isOutOfStock
                                ? 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                                : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950 dark:text-blue-400'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* High-Visibility Detailed List Layout */
              <div className="flex flex-col gap-2.5">
                {filteredProducts.map(product => {
                  const isOutOfStock = product.stock <= 0;
                  const inCartItem = cart.find(i => i.product.id === product.id);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`group flex items-center justify-between p-3 rounded-2xl border transition text-left ${
                        isOutOfStock
                          ? 'opacity-50 border-slate-200 bg-slate-50 dark:bg-slate-800/30 cursor-not-allowed'
                          : inCartItem
                          ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {product.image ? (
                            <img
                              src={typeof product.image === 'string' ? product.image : URL.createObjectURL(product.image)}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Tag className="w-6 h-6 text-slate-400" />
                          )}
                          {inCartItem && (
                            <span className="absolute top-1 right-1 h-5 min-w-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {inCartItem.quantity}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            SKU: {product.sku} {product.barcode ? `• Barcode: ${product.barcode}` : ''}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                            {isOutOfStock ? (
                              <span className="text-rose-500 font-bold">Out of stock</span>
                            ) : (
                              <span>Available: {product.stock} units</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-base font-black text-blue-600 dark:text-blue-400">
                          {settings.currency}{product.price.toFixed(2)}
                        </span>
                        <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Bottom Cart Action Bar on Mobile */}
          {cart.length > 0 && (
            <div className="lg:hidden absolute bottom-20 left-4 right-4 z-20">
              <button
                type="button"
                onClick={() => setMobileTab('cart')}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-500/30 animate-in slide-in-from-bottom duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white text-xs font-extrabold">
                    {totalItemsCount}
                  </div>
                  <span className="text-sm">Total: {settings.currency}{total.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold bg-white text-blue-700 px-3 py-1.5 rounded-xl shadow-xs">
                  <span>View Cart & Pay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right: Cart & Checkout Panel */}
        <div
          className={`lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-5 shadow-xs h-full min-h-0 overflow-hidden ${
            mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Cart Header with Back to Products for Mobile */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('catalog')}
                className="lg:hidden p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition mr-1"
                title="Back to products"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-none">
                  Order Summary
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'} in cart
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={resetCart}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline px-2 py-1 rounded-lg"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items List - Fully Scrollable Inner Container */}
          <div className="flex-1 min-h-0 overflow-y-auto my-2 space-y-2 sm:space-y-2.5 pr-1 overscroll-contain">
            {cart.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-400 space-y-2 py-8 text-center">
                <div className="p-3.5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600">
                  <ShoppingCart className="w-12 h-12 stroke-1" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Your cart is empty</p>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xs">
                    Tap on products from the catalog or use camera scanner to add items.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('catalog')}
                  className="lg:hidden mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                {cart.map(item => (
                  <div
                    key={item.product.id}
                    className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-2.5 transition hover:shadow-xs"
                  >
                    {/* Thumbnail Image */}
                    <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-slate-200/70 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-600">
                      {item.product.image ? (
                        <img
                          src={typeof item.product.image === 'string' ? item.product.image : URL.createObjectURL(item.product.image)}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Tag className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Product Name, Unit Price & Subtotal */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug line-clamp-1">
                        {item.product.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {settings.currency}{item.product.price.toFixed(2)} ea
                        </span>
                        <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded-md">
                          = {settings.currency}{(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      {item.product.barcode && (
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                          {item.product.barcode}
                        </div>
                      )}
                    </div>

                    {/* Quantity Modifier and Remove Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="h-7 w-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition active:scale-95"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="h-7 w-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition active:scale-95"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition"
                        title="Remove product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Generous bottom spacer for smooth scroll clearance */}
                <div className="h-3 w-full shrink-0" aria-hidden="true" />
              </>
            )}
          </div>

          {/* Compact, High-Efficiency Totals & Checkout Panel (Fixed at Bottom of Cart Panel) */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0 bg-white dark:bg-slate-900">
            {/* Subtotal & Discount Row */}
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Subtotal ({totalItemsCount} items):</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {settings.currency}{subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Discount:</span>
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-18 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-right text-xs font-semibold dark:bg-slate-800 dark:text-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Total Payable & Change Highlights */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/40">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block leading-tight">
                  Total Payable
                </span>
                <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 leading-tight">
                  {settings.currency}{total.toFixed(2)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block leading-tight">
                  Change
                </span>
                <span className={`text-sm sm:text-base font-black leading-tight ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {settings.currency}{change.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Cash Tendered Input & Quick Preset Buttons */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  Cash Tendered
                </span>
                <input
                  type="number"
                  min="0"
                  value={payment || ''}
                  onChange={(e) => setPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="flex-1 max-w-[140px] rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-right font-black text-sm dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Cash Presets */}
              {total > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                  <button
                    type="button"
                    onClick={handleExactCash}
                    className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-bold whitespace-nowrap shadow-xs hover:bg-blue-700 transition"
                  >
                    Exact ({settings.currency}{total.toFixed(0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCash(50)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-semibold whitespace-nowrap hover:bg-slate-200"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCash(100)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-semibold whitespace-nowrap hover:bg-slate-200"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCash(500)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-semibold whitespace-nowrap hover:bg-slate-200"
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddCash(1000)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-semibold whitespace-nowrap hover:bg-slate-200"
                  >
                    +1000
                  </button>
                </div>
              )}
            </div>

            {/* Complete Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || payment < total}
              className={`w-full py-3 rounded-2xl font-black text-sm sm:text-base text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                cart.length === 0 || payment < total
                  ? 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-500/25'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              <span>Complete Checkout ({settings.currency}{total.toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Continuous Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <CameraScannerModal
          onScan={handleScanBarcode}
          onClose={() => setShowCameraScanner(false)}
          settings={settings}
          cartItems={cart}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
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
