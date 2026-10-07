import React from 'react';
import {
  Lock,
  LogOut,
  ShieldCheck,
  Database,
  User,
  Store,
} from 'lucide-react';
import { AuthSession } from './LoginScreen';

interface SyncStatusHeaderProps {
  currentSession: AuthSession | null;
  onLock: () => void;
  onLogout: () => void;
  isOnline?: boolean;
}

export const SyncStatusHeader: React.FC<SyncStatusHeaderProps> = ({
  currentSession,
  onLock,
  onLogout,
}) => {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* 100% Offline Local Database Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 md:py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 transition-all">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Offline POS</span>
          <span className="text-[10px] opacity-85">• Local DB</span>
        </span>
      </div>

      {/* Active Store Badge */}
      {currentSession?.storeName && (
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60" title={`Active Store: ${currentSession.storeName}`}>
          <Store className="w-3.5 h-3.5 text-indigo-500" />
          <span className="max-w-[130px] truncate">{currentSession.storeName}</span>
        </div>
      )}

      {/* Current User Session Pill */}
      {currentSession && (
        <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-900 dark:text-white max-w-[100px] truncate">
              {currentSession.name}
            </span>
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-md ${
                currentSession.role === 'admin'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {currentSession.role}
            </span>
          </div>

          {/* Backup & Transfer Shortcut (Admin Only) */}
          {currentSession.role === 'admin' && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('pos-navigate', { detail: 'backup' }))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200/50 dark:border-indigo-800/50 transition cursor-pointer shadow-2xs group"
              title="Backup & Transfer Data"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition" />
              <span className="hidden lg:inline">Backup & ZIP</span>
              <span className="lg:hidden hidden sm:inline">Backup</span>
            </button>
          )}

          {/* Terminal Lock Button — Specifically for Cashiers */}
          {currentSession.role === 'cashier' && (
            <button
              type="button"
              onClick={onLock}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800 transition cursor-pointer shadow-2xs"
              title="Lock Cashier Terminal"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden md:inline">Lock POS</span>
            </button>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
