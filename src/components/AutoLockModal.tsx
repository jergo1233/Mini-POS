import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, AlertCircle, LogOut, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { AuthSession } from './LoginScreen';
import { Cashier, Settings, getAllCashiers, getSettings } from '../db/indexedDB';
import { verifyAdminPin } from '../utils/cryptoAuth';

interface AutoLockModalProps {
  currentSession: AuthSession;
  cashiers: Cashier[];
  settings: Settings;
  onUnlock: () => void;
  onLogout: () => void;
}

export const AutoLockModal: React.FC<AutoLockModalProps> = ({
  currentSession,
  cashiers: propCashiers,
  settings: propSettings,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAttemptUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your PIN.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Ensure we have the latest settings & cashiers even if initial prop was empty
      let activeSettings = propSettings;
      if (!activeSettings || !activeSettings.adminPin) {
        try {
          activeSettings = await getSettings();
        } catch {
          // ignore
        }
      }

      let activeCashiers = propCashiers;
      if (!activeCashiers || activeCashiers.length === 0) {
        try {
          activeCashiers = await getAllCashiers();
        } catch {
          // ignore
        }
      }

      const isAdminMatch = await verifyAdminPin(pin, activeSettings || propSettings);

      if (currentSession.role === 'admin') {
        if (isAdminMatch) {
          onUnlock();
          return;
        } else {
          setError('Incorrect Admin PIN.');
        }
      } else {
        const cashier = (activeCashiers || []).find((c) => c.id === currentSession.id);
        if (cashier && cashier.pin === pin) {
          onUnlock();
          return;
        } else if (isAdminMatch) {
          // Administrator PIN can also unlock a locked cashier terminal
          onUnlock();
          return;
        } else {
          setError('Incorrect Cashier PIN. Enter your Cashier PIN or Admin PIN.');
        }
      }
    } catch (err) {
      console.error('Unlock verification error:', err);
      setError('Verification error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAttemptUnlock();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Cashier Terminal Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            Terminal is secured. Enter your Cashier PIN to resume.
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-300 font-medium border border-slate-700">
            <span>Cashier:</span>
            <span className="font-bold text-white">{currentSession.name}</span>
            <span className="uppercase text-[9px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-mono">
              {currentSession.role}
            </span>
          </div>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={handleAttemptUnlock} className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              maxLength={8}
              autoFocus
              value={pin}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) {
                  setPin(val);
                  setError(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-amber-500 shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-rose-950/60 border border-rose-900/60 text-rose-300 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* On-Screen Keypad for Touch Terminals */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-base transition shadow-xs flex items-center justify-center cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError(null);
              }}
              className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 font-medium text-xs transition flex items-center justify-center cursor-pointer"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-base transition shadow-xs flex items-center justify-center cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                setPin((prev) => prev.slice(0, -1));
                setError(null);
              }}
              className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-medium text-xs transition flex items-center justify-center cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
              title="Logout from Cashier session"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
            <button
              type="submit"
              disabled={verifying || !pin}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-40"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{verifying ? 'Verifying...' : 'Unlock Terminal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
