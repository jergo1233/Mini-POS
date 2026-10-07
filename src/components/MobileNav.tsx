/**
 * Mobile Bottom Navigation Component
 */
import React from 'react';
import { LayoutDashboard, ShoppingCart, Package, ReceiptText, Menu } from 'lucide-react';
import { TabType } from './Sidebar';

interface MobileNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenMore: () => void;
  userRole?: 'admin' | 'cashier';
  pendingBadgeCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenMore,
  userRole = 'admin',
  pendingBadgeCount = 0,
}) => {
  const isMoreActive = ['inventory', 'sales', 'reports', 'customers', 'settings', 'cashiers', 'backup'].includes(currentTab);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-around py-2 px-2 shadow-lg transition-colors">
      <button
        onClick={() => onSelectTab('dashboard')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
          currentTab === 'dashboard' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px]">Home</span>
      </button>

      <button
        onClick={() => onSelectTab('pos')}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
          currentTab === 'pos' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ShoppingCart className="w-5 h-5" />
        <span className="text-[10px]">POS</span>
      </button>

      {userRole === 'admin' ? (
        <button
          onClick={() => onSelectTab('products')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'products' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">Products</span>
        </button>
      ) : (
        <button
          onClick={() => onSelectTab('sales')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            currentTab === 'sales' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span className="text-[10px]">Sales</span>
        </button>
      )}

      <button
        onClick={onOpenMore}
        className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
          isMoreActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px]">More</span>
        {pendingBadgeCount > 0 && (
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        )}
      </button>
    </div>
  );
};
