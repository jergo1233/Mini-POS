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
  Settings as SettingsIcon
} from 'lucide-react';
import { TabType } from './Sidebar';

interface MoreMenuModalProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onClose: () => void;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({ onSelectTab, onClose }) => {
  const items = [
    { id: 'inventory' as TabType, label: 'Inventory Management', icon: Boxes },
    { id: 'sales' as TabType, label: 'Sales History', icon: ReceiptText },
    { id: 'reports' as TabType, label: 'Business Reports', icon: BarChart3 },
    { id: 'customers' as TabType, label: 'Customers', icon: Users },
    { id: 'settings' as TabType, label: 'Settings & Backup', icon: SettingsIcon },
  ];

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">More Options</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-2">
          {/* Creator Statement Card */}
          <div className="mb-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-center">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">System Creator</p>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mt-0.5">Jerome Urbano</p>
          </div>

          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Icon className="w-5 h-5 text-blue-600" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
