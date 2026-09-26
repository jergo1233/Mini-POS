/**
 * Desktop Sidebar Navigation Component
 */
import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  ReceiptText,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  Download,
  Store
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type TabType = 'dashboard' | 'pos' | 'products' | 'inventory' | 'sales' | 'reports' | 'customers' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  storeName: string;
  ownerName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, storeName, ownerName }) => {
  const { isInstallable, install, isInstalled } = usePWAInstall();

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos' as TabType, label: 'POS Terminal', icon: ShoppingCart },
    { id: 'products' as TabType, label: 'Products', icon: Package },
    { id: 'inventory' as TabType, label: 'Inventory', icon: Boxes },
    { id: 'sales' as TabType, label: 'Sales History', icon: ReceiptText },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
    { id: 'customers' as TabType, label: 'Customers', icon: Users },
    { id: 'settings' as TabType, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="relative z-20 hidden md:flex w-64 flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80 shrink-0 transition-colors">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 overflow-hidden p-1.5 shrink-0">
          <img src="/icon.svg" alt="App Logo" className="w-full h-full object-contain" />
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold text-slate-900 dark:text-white truncate text-sm">
            {storeName || 'Mini POS'}
          </h1>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
            Owner: {ownerName || 'Jerome Urbano'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {!isInstalled && isInstallable && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={install}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 py-2.5 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Install PWA App
          </button>
        </div>
      )}
    </aside>
  );
};
