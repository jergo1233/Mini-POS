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
  UserCheck,
  Settings as SettingsIcon,
  Download,
  Lock,
  LogOut,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type TabType =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'reports'
  | 'customers'
  | 'cashiers'
  | 'backup'
  | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  storeName: string;
  ownerName: string;
  userRole?: 'admin' | 'cashier';
  userName?: string;
  pendingResetRequestsCount?: number;
  onLock?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  storeName,
  ownerName,
  userRole = 'admin',
  userName,
  pendingResetRequestsCount = 0,
  onLock,
  onLogout,
}) => {
  const { isInstallable, install, isInstalled } = usePWAInstall();

  const allNavItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'cashier'] },
    { id: 'pos' as TabType, label: 'POS Terminal', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { id: 'sales' as TabType, label: 'Sales History', icon: ReceiptText, roles: ['admin', 'cashier'] },
    { id: 'products' as TabType, label: 'Products', icon: Package, roles: ['admin'] },
    { id: 'inventory' as TabType, label: 'Inventory', icon: Boxes, roles: ['admin'] },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3, roles: ['admin'] },
    { id: 'cashiers' as TabType, label: 'Cashier Access', icon: UserCheck, roles: ['admin'], badge: pendingResetRequestsCount },
    { id: 'customers' as TabType, label: 'Customers', icon: Users, roles: ['admin', 'cashier'] },
    { id: 'backup' as TabType, label: 'Backup & Transfer', icon: Download, roles: ['admin', 'cashier'] },
    { id: 'settings' as TabType, label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
  ];

  const visibleNavItems = allNavItems.filter((item) =>
    item.roles.includes(userRole)
  );

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
            {userRole === 'admin' ? `Admin: ${ownerName || 'Owner'}` : `Cashier: ${userName || 'Active'}`}
          </p>
        </div>
      </div>

      {/* Role Badge Indicator */}
      <div className="px-4 pt-3 pb-1">
        <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
          userRole === 'admin'
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-900/50'
            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50'
        }`}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="capitalize">{userRole} Session</span>
          </span>
          {userRole === 'cashier' && (
            <span className="text-[10px] bg-blue-200/80 dark:bg-blue-800/80 px-1.5 py-0.5 rounded-sm">
              Restricted
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Lock and Logout Footer Buttons */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          {onLock && userRole === 'cashier' && (
            <button
              type="button"
              onClick={onLock}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
              title="Lock Terminal"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock POS</span>
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-xs font-semibold transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          )}
        </div>

        {!isInstalled && isInstallable && (
          <button
            onClick={install}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 py-2.5 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Install PWA App
          </button>
        )}
      </div>
    </aside>
  );
};
