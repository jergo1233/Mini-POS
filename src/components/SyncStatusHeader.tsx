import React from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  User
} from 'lucide-react';
import { SyncState } from '../hooks/useSyncManager';
import { AuthSession } from './LoginScreen';

interface SyncStatusHeaderProps {
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  currentSession: AuthSession | null;
  onManualSync: () => void;
  onLock: () => void;
  onLogout: () => void;
}

export const SyncStatusHeader: React.FC<SyncStatusHeaderProps> = ({
  isOnline,
  syncState,
  pendingCount,
  currentSession,
  onManualSync,
  onLock,
  onLogout,
}) => {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Network & Sync Pill */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 md:py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md transition-all ${
          isOnline
            ? syncState === 'syncing'
              ? 'bg-blue-50/90 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
              : pendingCount > 0
              ? 'bg-amber-50/90 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              : 'bg-emerald-50/90 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
            : 'bg-rose-50/90 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
        }`}
      >
        {isOnline ? (
          <>
            <span
              className={`w-2 h-2 rounded-full ${
                syncState === 'syncing'
                  ? 'bg-blue-500 animate-ping'
                  : pendingCount > 0
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            {syncState === 'syncing' ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </span>
            ) : pendingCount > 0 ? (
              <span className="flex items-center gap-1">
                <span>Online</span>
                <span className="opacity-80">({pendingCount} pending)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span>Online</span>
                <span className="hidden sm:inline font-normal opacity-90">• Synced</span>
              </span>
            )}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              <span>Offline</span>
              {pendingCount > 0 && (
                <span className="font-bold">({pendingCount} waiting)</span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Manual Sync Button */}
      <button
        type="button"
        onClick={onManualSync}
        disabled={syncState === 'syncing' || !isOnline}
        className={`p-1.5 rounded-xl border transition ${
          isOnline
            ? 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            : 'bg-slate-100 dark:bg-slate-800/40 border-transparent text-slate-400 cursor-not-allowed'
        }`}
        title={isOnline ? 'Force Sync Now' : 'Cannot sync while offline'}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin text-blue-500' : ''}`} />
      </button>

      {/* Current User Session Pill */}
      {currentSession && (
        <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-slate-700">
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

          <button
            type="button"
            onClick={onLock}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            title="Lock POS Screen"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
            title="Logout User"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
