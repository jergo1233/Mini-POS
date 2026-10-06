import React, { useState, useEffect } from 'react';
import {
  Lock,
  UserCheck,
  ShieldAlert,
  KeyRound,
  Store,
  Wifi,
  WifiOff,
  RefreshCw,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  PhoneCall,
  QrCode,
  Download,
  Printer,
  Cloud,
} from 'lucide-react';
import {
  Cashier,
  Settings,
  getAllCashiers,
  saveResetRequest,
  CashierResetRequest,
  saveSettings,
  openDB,
} from '../db/indexedDB';
import { QRScannerModal } from './QRScannerModal';
import { QRCodeCanvas } from 'qrcode.react';

export interface AuthSession {
  role: 'admin' | 'cashier';
  id: string;
  name: string;
  loginTime: string;
  isOfflineLogin: boolean;
}

interface LoginScreenProps {
  settings: Settings;
  onLoginSuccess: (session: AuthSession) => void;
  isOnline: boolean;
  onTriggerSync?: () => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  onLoginSuccess,
  isOnline,
  onTriggerSync,
}) => {
  const [roleTab, setRoleTab] = useState<'cashier' | 'admin'>('cashier');
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset Request Modal States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetCashierId, setResetCashierId] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  // Admin PIN Recovery States
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showResetAdminModal, setShowResetAdminModal] = useState(false);
  const [newAdminPin, setNewAdminPin] = useState('');
  const [confirmAdminPin, setConfirmAdminPin] = useState('');

  // First-time Setup states
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [setupStoreName, setSetupStoreName] = useState(settings.storeName || 'Mini Universal POS Store');
  const [setupOwnerName, setSetupOwnerName] = useState(settings.ownerName || 'Jerome Urbano');
  const [generatedToken, setGeneratedToken] = useState('');
  const [setupStep, setSetupStep] = useState<'form' | 'qr'>('form');
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [forceShowLogin, setForceShowLogin] = useState(false);

  const handleLoadFromCloud = async () => {
    setIsConnectingCloud(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/sync/state');
      if (!response.ok) {
        throw new Error(`Failed to contact server: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Invalid server response');
      }

      const storeData = result.data;
      const db = await openDB();

      // Clear existing local collections so we can do a clean remote import
      const txClear = db.transaction([
        'products',
        'categories',
        'cashiers',
        'reset_requests',
        'settings'
      ], 'readwrite');
      txClear.objectStore('products').clear();
      txClear.objectStore('categories').clear();
      txClear.objectStore('cashiers').clear();
      txClear.objectStore('reset_requests').clear();
      txClear.objectStore('settings').clear();

      await new Promise<void>((resolve, reject) => {
        txClear.oncomplete = () => resolve();
        txClear.onerror = () => reject(txClear.error);
      });

      // 1. Save Settings
      let remoteSettings = storeData.settings || {};
      if (!remoteSettings.adminPin) {
        remoteSettings.adminPin = '1234'; // Safe fallback
      }
      const finalSettings: Settings = {
        ...settings,
        ...remoteSettings,
        isSetup: true, // Mark setup as completed
      };
      await saveSettings(finalSettings);

      // 2. Save Cashiers
      if (storeData.cashiers && storeData.cashiers.length > 0) {
        const txCashier = db.transaction('cashiers', 'readwrite');
        const cashierStore = txCashier.objectStore('cashiers');
        for (const cashier of storeData.cashiers) {
          cashierStore.put(cashier);
        }
        await new Promise<void>((resolve, reject) => {
          txCashier.oncomplete = () => resolve();
          txCashier.onerror = () => reject(txCashier.error);
        });
      }

      // 3. Save Products
      if (storeData.products && storeData.products.length > 0) {
        const txProd = db.transaction('products', 'readwrite');
        const prodStore = txProd.objectStore('products');
        for (const prod of storeData.products) {
          prodStore.put(prod);
        }
        await new Promise<void>((resolve, reject) => {
          txProd.oncomplete = () => resolve();
          txProd.onerror = () => reject(txProd.error);
        });
      }

      // 4. Save Categories
      if (storeData.categories && storeData.categories.length > 0) {
        const txCat = db.transaction('categories', 'readwrite');
        const catStore = txCat.objectStore('categories');
        for (const cat of storeData.categories) {
          catStore.put(cat);
        }
        await new Promise<void>((resolve, reject) => {
          txCat.oncomplete = () => resolve();
          txCat.onerror = () => reject(txCat.error);
        });
      }

      // 5. Save Reset Requests
      if (storeData.resetRequests && storeData.resetRequests.length > 0) {
        const txReq = db.transaction('reset_requests', 'readwrite');
        const reqStore = txReq.objectStore('reset_requests');
        for (const req of storeData.resetRequests) {
          reqStore.put(req);
        }
        await new Promise<void>((resolve, reject) => {
          txReq.oncomplete = () => resolve();
          txReq.onerror = () => reject(txReq.error);
        });
      }

      alert('Cloud connection successful! Your store data has been retrieved. You can now login using your existing PIN.');
      window.location.reload();
    } catch (err: any) {
      console.error('Cloud load failed:', err);
      setErrorMsg(err.message || 'Connection failed. Please check your internet connection.');
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const loadCashiers = async () => {
    try {
      const list = await getAllCashiers();
      setCashiers(list);
      if (list.length > 0 && !selectedCashierId) {
        setSelectedCashierId(list[0].id);
      }
    } catch (e) {
      console.error('Failed loading cashiers:', e);
    }
  };

  useEffect(() => {
    loadCashiers();
  }, []);

  const handleCashierLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cashier = cashiers.find((c) => c.id === selectedCashierId);
    if (!cashier) {
      setErrorMsg('Please select a valid cashier profile.');
      return;
    }

    if (!enteredPin) {
      setErrorMsg('Please enter your 4-digit PIN.');
      return;
    }

    if (cashier.pin !== enteredPin) {
      setErrorMsg('Incorrect Cashier PIN. Please try again or request a reset.');
      return;
    }

    if (!cashier.active) {
      setErrorMsg('This cashier account is inactive. Please contact your Admin.');
      return;
    }

    onLoginSuccess({
      role: 'cashier',
      id: cashier.id,
      name: cashier.name,
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!enteredPin) {
      setErrorMsg('Please enter the Admin PIN.');
      return;
    }

    if (enteredPin !== settings.adminPin) {
      setErrorMsg('Invalid Admin PIN. Please verify credentials.');
      return;
    }

    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: settings.ownerName || 'Store Administrator',
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  const handlePinClear = () => {
    setEnteredPin('');
    setErrorMsg(null);
  };

  const handleSubmitResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashier = cashiers.find((c) => c.id === resetCashierId);
    if (!cashier) return;

    const newRequest: CashierResetRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      cashierId: cashier.id,
      cashierName: cashier.name,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      notes: resetReason.trim() || 'Forgot PIN / Requested reset from login screen',
      syncStatus: isOnline ? 'synced' : 'pending',
    };

    try {
      await saveResetRequest(newRequest);
      if (isOnline && onTriggerSync) {
        onTriggerSync().catch(() => {});
      }
      setResetSuccessNotice(
        `Reset request registered for ${cashier.name}! Please contact the Admin directly via Phone Call, SMS, or Messenger to receive your temporary PIN.`
      );
      setResetReason('');
    } catch (err) {
      console.error('Failed submitting reset request:', err);
    }
  };

  const handleVerifyAdminQR = (token: string | null) => {
    setShowQRScanner(false);
    if (token === settings.recoveryToken) {
      setShowResetAdminModal(true);
    } else {
      setErrorMsg('Invalid recovery QR code.');
    }
  };

  const handleSaveNewAdminPin = async () => {
    if (newAdminPin.length < 4) {
      setErrorMsg('PIN must be at least 4 digits.');
      return;
    }
    if (newAdminPin !== confirmAdminPin) {
      setErrorMsg('PINs do not match.');
      return;
    }

    const newToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    await saveSettings({ ...settings, adminPin: newAdminPin, recoveryToken: newToken });
    setShowResetAdminModal(false);
    setNewAdminPin('');
    setConfirmAdminPin('');
    alert('PIN reset successful! A new Recovery QR has been generated in Settings.');
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (setupPin.length < 4 || setupPin.length > 6 || !/^\d+$/.test(setupPin)) {
      setErrorMsg('Admin PIN must be between 4 to 6 numeric digits.');
      return;
    }

    if (setupPin !== setupConfirmPin) {
      setErrorMsg('Admin PINs do not match.');
      return;
    }

    if (!setupStoreName.trim()) {
      setErrorMsg('Store Name is required.');
      return;
    }

    if (!setupOwnerName.trim()) {
      setErrorMsg('Store Owner Name is required.');
      return;
    }

    const newToken = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    const updatedSettings: Settings = {
      ...settings,
      adminPin: setupPin,
      storeName: setupStoreName.trim(),
      ownerName: setupOwnerName.trim(),
      recoveryToken: newToken,
      isSetup: true,
    };

    try {
      await saveSettings(updatedSettings);
      setGeneratedToken(newToken);
      setSetupStep('qr');
    } catch (err) {
      console.error('Failed to complete Admin Setup:', err);
      setErrorMsg('Failed to save settings. Please try again.');
    }
  };

  const handleFinishSetupAndLogin = () => {
    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: setupOwnerName.trim(),
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 px-4 py-8 relative overflow-hidden select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl p-6 md:p-8 relative z-10 space-y-6">
        
        {(!settings.isSetup && !forceShowLogin) ? (
          // FIRST-TIME ADMIN SETUP FLOW
          setupStep === 'form' ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4 text-left">
              <div className="text-center pb-2">
                <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-2">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Create Admin Account</h3>
                <p className="text-xs text-slate-400">Set up your security PIN and store profile to start</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={setupStoreName}
                  onChange={(e) => setSetupStoreName(e.target.value)}
                  placeholder="e.g. My Awesome Store"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Owner Name</label>
                <input
                  type="text"
                  required
                  value={setupOwnerName}
                  onChange={(e) => setSetupOwnerName(e.target.value)}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Create Admin PIN (4-6 digits)</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={setupPin}
                  onChange={(e) => setSetupPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Admin PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={setupConfirmPin}
                  onChange={(e) => setSetupConfirmPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Generate Recovery QR & Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative flex py-1 items-center shrink-0">
                <div className="flex-grow border-t border-slate-700/60"></div>
                <span className="flex-shrink mx-3 text-slate-500 text-[10px] font-semibold tracking-wider uppercase">Or Sync Existing Cloud Store</span>
                <div className="flex-grow border-t border-slate-700/60"></div>
              </div>

              <button
                type="button"
                disabled={isConnectingCloud}
                onClick={handleLoadFromCloud}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 font-bold text-slate-300 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Cloud className={`w-4 h-4 text-sky-400 ${isConnectingCloud ? 'animate-pulse' : ''}`} />
                <span>{isConnectingCloud ? 'Connecting to Cloud...' : 'Retrieve Existing Store from Cloud'}</span>
              </button>

              <div className="text-center pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setForceShowLogin(true)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white hover:underline transition-all cursor-pointer"
                >
                  Already set up? Skip directly to Login Screen
                </button>
              </div>
            </form>
          ) : (
            // SETUP RECOVERY QR SCREEN
            <div className="space-y-4 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Setup Successful!</h3>
              <p className="text-xs text-slate-400">
                Your Admin PIN has been configured. We have automatically generated your unique Admin Recovery QR code.
              </p>

              <div className="bg-slate-900 p-6 rounded-2xl flex flex-col items-center border border-slate-700 justify-center">
                <QRCodeCanvas id="setup-qr-canvas" value={generatedToken} size={180} includeMargin={true} />
                
                <p className="text-[10px] text-amber-400 font-semibold mt-4 text-center max-w-xs leading-relaxed">
                  "Keep your Admin Recovery QR Code in a safe place. Anyone who has access to this recovery QR may be able to recover the Admin account."
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.getElementById('setup-qr-canvas') as HTMLCanvasElement;
                    if (canvas) {
                      const url = canvas.toDataURL('image/png');
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'admin-recovery-qr.png';
                      a.click();
                    }
                  }}
                  className="py-2.5 rounded-xl border border-slate-700 font-semibold text-slate-300 hover:bg-slate-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Download PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="py-2.5 rounded-xl border border-slate-700 font-semibold text-slate-300 hover:bg-slate-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-400" />
                  <span>Print QR</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleFinishSetupAndLogin}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Finish Setup & Enter POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )
        ) : (
          <>
            {/* Brand Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 p-2.5">
                <img src="/icon.svg" alt="POS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {settings.storeName || 'Mini Universal POS'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Secure Offline-First Terminal • Multi-User System
                </p>
              </div>
            </div>

            {/* Network & Offline Status Banner */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-xs">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5" /> Online Cloud Sync
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-amber-400 flex items-center gap-1">
                      <WifiOff className="w-3.5 h-3.5" /> Offline Mode (Local Auth)
                    </span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {isOnline ? 'Realtime Connected' : 'Works 100% Offline'}
              </span>
            </div>

            {/* Role Segmented Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setRoleTab('cashier');
                  setEnteredPin('');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
                  roleTab === 'cashier'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Cashier Terminal</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleTab('admin');
                  setEnteredPin('');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all ${
                  roleTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin Portal</span>
              </button>
            </div>

            {/* Login Form */}
            <div className="space-y-4">
              {roleTab === 'cashier' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Cashier Account
                  </label>
                  {cashiers.length > 0 ? (
                    <select
                      value={selectedCashierId}
                      onChange={(e) => {
                        setSelectedCashierId(e.target.value);
                        setEnteredPin('');
                        setErrorMsg(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-hidden focus:border-blue-500"
                    >
                      {cashiers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {!c.active ? '(Inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-400">
                      Default Cashier (PIN: 0000)
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/50 text-xs text-indigo-300 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-white">Full Admin Access</span>
                    <span>Manage products, cashiers, stock, reports & data</span>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
                </div>
              )}

              {/* PIN Input Display */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {roleTab === 'cashier' ? 'Cashier Security PIN' : 'Admin Security PIN'}
                  </label>
                  {roleTab === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setShowQRScanner(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      Forgot Admin PIN?
                    </button>
                  )}
                  {roleTab === 'cashier' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetCashierId(selectedCashierId || (cashiers[0]?.id ?? ''));
                        setResetSuccessNotice(null);
                        setShowResetModal(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                    >
                      Forgot PIN?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (roleTab === 'cashier') handleCashierLogin();
                        else handleAdminLogin();
                      }
                    }}
                    placeholder="Enter PIN"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-center text-xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 shadow-inner"
                  />
                  {enteredPin.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePinClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Action Button */}
              <button
                type="button"
                onClick={roleTab === 'cashier' ? () => handleCashierLogin() : () => handleAdminLogin()}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-white text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  roleTab === 'cashier'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                <span>{roleTab === 'cashier' ? 'Enter POS Terminal' : 'Enter Admin Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Footer Hint */}
            <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80 space-y-2">
              <div>System Creator: Jerome Urbano • Version 5.0 (Offline-Capable)</div>
              {forceShowLogin && (
                <button
                  type="button"
                  onClick={() => setForceShowLogin(false)}
                  className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-all cursor-pointer block w-full text-center"
                >
                  Back to Setup / Cloud Import
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cashier Forgot PIN / Reset Request Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Request Cashier PIN Reset</h3>
                <p className="text-xs text-slate-400">Submit an access reset request to the Store Admin</p>
              </div>
            </div>

            {resetSuccessNotice ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Request Registered
                  </div>
                  <p>{resetSuccessNotice}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1">
                    <PhoneCall className="w-3.5 h-3.5 text-blue-400" /> Next Step:
                  </p>
                  <p>
                    Please call or text the Store Admin. Once approved in the Admin Dashboard, the Admin will provide you with a temporary PIN.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitResetRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Your Cashier Profile
                  </label>
                  <select
                    value={resetCashierId}
                    onChange={(e) => setResetCashierId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  >
                    {cashiers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Reason / Note for Admin (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    placeholder="e.g. Forgot PIN after shift change"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-900/60 text-xs text-amber-300">
                  <span className="font-bold block mb-0.5">Note:</span>
                  Cashiers cannot directly reset their own credentials. This request will notify the Admin. Contact the Admin separately via Phone, SMS, or Messenger to receive your new PIN.
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-200 font-semibold text-xs hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Admin PIN Recovery - QR Scanner */}
      {showQRScanner && (
        <QRScannerModal
          onScan={handleVerifyAdminQR}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* Admin PIN Recovery - Reset PIN Modal */}
      {showResetAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Reset Admin PIN</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveNewAdminPin();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-center font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={confirmAdminPin}
                  onChange={(e) => setConfirmAdminPin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-center font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition"
              >
                Save New PIN
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
