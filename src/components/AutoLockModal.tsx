import React, { useState } from 'react';
import { Lock, Unlock, AlertCircle, LogOut } from 'lucide-react';
import { AuthSession } from './LoginScreen';
import { Cashier, Settings } from '../db/indexedDB';
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
  cashiers,
  settings,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAttemptUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const isAdminMatch = await verifyAdminPin(pin, settings);

    if (currentSession.role === 'admin') {
      if (isAdminMatch) {
        onUnlock();
      } else {
        setError('Incorrect Admin PIN.');
      }
    } else {
      const cashier = cashiers.find((c) => c.id === currentSession.id);
      if (cashier && cashier.pin === pin) {
        onUnlock();
      } else if (isAdminMatch) {
        // Admin PIN also overrides unlock
        onUnlock();
      } else {
        setError('Incorrect Cashier PIN.');
      }
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Terminal Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            Locked due to inactivity. Enter PIN to resume.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-300 font-medium">
            <span>User:</span>
            <span className="font-bold text-white">{currentSession.name}</span>
            <span className="uppercase text-[10px] text-blue-400">({currentSession.role})</span>
          </div>
        </div>

        {/* PIN Display */}
        <div className="space-y-3">
          <input
            type="password"
            readOnly
            value={pin}
            placeholder="Enter PIN"
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden"
          />

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-base transition shadow-xs flex items-center justify-center"
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
              className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 font-medium text-xs transition flex items-center justify-center"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-base transition shadow-xs flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((prev) => prev.slice(0, -1))}
              className="h-11 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-medium text-xs transition flex items-center justify-center"
            >
              ⌫
            </button>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            <button
              type="button"
              onClick={() => handleAttemptUnlock()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock POS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
