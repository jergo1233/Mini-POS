/**
 * Mobile More Menu Modal Component
 */
import React from 'react';
import {
  X,
  Boxes,
  ReceiptText,
  BarChart3,
  Users,
  UserCheck,
  Settings as SettingsIcon,
  Lock,
  LogOut,
  Package
} from 'lucide-react';
import { TabType } from './Sidebar';

interface MoreMenuModalProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onClose: () => void;
  userRole?: 'admin' | 'cashier';
  pendingResetRequestsCount?: number;
  onLock?: () => void;
  onLogout?: () => void;
}

interface MoreMenuItem {
  id: TabType;
  label: string;
  icon: any;
  badge?: number;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  onSelectTab,
  onClose,
  userRole = 'admin',
  pendingResetRequestsCount = 0,
  onLock,
  onLogout,
}) => {
  const adminItems: MoreMenuItem[] = [
    { id: 'inventory', label: 'Inventory Management', icon: Boxes },
    { id: 'sales', label: 'Sales History', icon: ReceiptText },
    { id: 'reports', label: 'Business Reports', icon: BarChart3 },
    { id: 'cashiers', label: 'Cashier Accounts & PINs', icon: UserCheck, badge: pendingResetRequestsCount },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'backup', label: 'Backup & ZIP Transfer', icon: Package },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const cashierItems: MoreMenuItem[] = [
    { id: 'sales', label: 'Sales History', icon: ReceiptText },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  const items = userRole === 'admin' ? adminItems : cashierItems;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">More Options</h3>
            <span className="text-xs text-blue-600 dark:text-blue-400 capitalize font-medium">
              {userRole} Session
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-2">
          {/* Creator Statement Card */}
          <div className="mb-3 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-center">
            <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">System Creator</p>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mt-0.5">Jerome Urbano</p>
          </div>

          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* Quick Lock & Logout */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
            {onLock && userRole === 'cashier' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLock();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              >
                <Lock className="w-4 h-4" />
                <span>Lock Terminal</span>
              </button>
            ) : (
              <div /> // Spacer if lock is hidden
            )}
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
