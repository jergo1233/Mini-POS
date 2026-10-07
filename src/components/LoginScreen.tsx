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
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Cashier,
  Settings,
  StoreAccount,
  getAllCashiers,
  getAllStoreAccounts,
  getSettings,
  saveSettings,
  saveResetRequest,
  CashierResetRequest,
  openDB,
} from '../db/indexedDB';
import { safeFetchJson } from '../utils/apiHelper';
import {
  createAdminAuthCredentials,
  verifyAdminPin,
  verifyRecoveryCode,
  generateRecoveryCodeDocument,
} from '../utils/cryptoAuth';

export interface AuthSession {
  role: 'admin' | 'cashier';
  id: string;
  name: string;
  storeId: string;
  storeName: string;
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
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Multi-Store states
  const [storeAccounts, setStoreAccounts] = useState<StoreAccount[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [activeStoreSettings, setActiveStoreSettings] = useState<Settings>(settings);
  const [isRegisteringNewStore, setIsRegisteringNewStore] = useState(false);

  // Cashier Forgot PIN Request Modal
  const [showCashierResetModal, setShowCashierResetModal] = useState(false);
  const [resetCashierId, setResetCashierId] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  // Admin Forgot PIN & Offline Recovery Modal States
  const [showForgotAdminModal, setShowForgotAdminModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'enterCode' | 'newPin' | 'saveReplacement'>('enterCode');
  const [recoveryEnteredCode, setRecoveryEnteredCode] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [replacementCode, setReplacementCode] = useState('');
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryConfirmedSaved, setRecoveryConfirmedSaved] = useState(false);
  const [recoveryFailedAttempts, setRecoveryFailedAttempts] = useState(0);
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState(0);

  // First-time Setup states
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [setupStoreName, setSetupStoreName] = useState('');
  const [setupOwnerName, setSetupOwnerName] = useState('');
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState('');
  const [setupStep, setSetupStep] = useState<'form' | 'recoveryCode'>('form');
  const [setupCopied, setSetupCopied] = useState(false);
  const [setupConfirmedSaved, setSetupConfirmedSaved] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemainingSecs <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemainingSecs]);

  // Load all registered store accounts
  const loadStoreAccounts = async () => {
    const list = await getAllStoreAccounts();
    setStoreAccounts(list);
    if (list.length > 0) {
      const current = selectedStoreId && list.some((s) => s.id === selectedStoreId) ? selectedStoreId : list[0].id;
      setSelectedStoreId(current);
    } else {
      setIsRegisteringNewStore(true);
    }
  };

  useEffect(() => {
    loadStoreAccounts();
  }, []);

  // Load settings and cashiers whenever selected store changes
  useEffect(() => {
    if (!selectedStoreId || isRegisteringNewStore) return;

    const loadStoreDetails = async () => {
      const sets = await getSettings(selectedStoreId);
      setActiveStoreSettings(sets);
      const cashList = await getAllCashiers(selectedStoreId);
      setCashiers(cashList);
      if (cashList.length > 0) {
        setSelectedCashierId(cashList[0].id);
      } else {
        setSelectedCashierId('');
      }
    };

    loadStoreDetails();
  }, [selectedStoreId, isRegisteringNewStore]);

  // ----------------------------------------------------
  // CASHIER LOGIN
  // ----------------------------------------------------
  const handleCashierLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cashier = cashiers.find((c) => c.id === selectedCashierId);

    if (!cashier) {
      setErrorMsg('Please select a cashier profile.');
      return;
    }

    if (!enteredPin) {
      setErrorMsg('Please enter your 4-digit Cashier PIN.');
      return;
    }

    if (cashier.pin !== enteredPin) {
      setErrorMsg('Incorrect Cashier PIN. Please try again or request a reset.');
      return;
    }

    if (!cashier.active) {
      setErrorMsg('This cashier account is inactive. Please contact the Store Administrator.');
      return;
    }

    onLoginSuccess({
      role: 'cashier',
      id: cashier.id,
      name: cashier.name,
      storeId: selectedStoreId || 'store-main',
      storeName: activeStoreSettings.storeName || 'Store Account',
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  // ----------------------------------------------------
  // ADMIN LOGIN (Salted Hash Verification)
  // ----------------------------------------------------
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (!enteredPin) {
      setErrorMsg('Please enter the Admin PIN.');
      return;
    }

    setLoading(true);
    try {
      const isMatch = await verifyAdminPin(enteredPin, activeStoreSettings);

      if (!isMatch) {
        setErrorMsg('Invalid Admin PIN. Please check your PIN or use Forgot Admin PIN.');
        setLoading(false);
        return;
      }

      onLoginSuccess({
        role: 'admin',
        id: 'admin',
        name: activeStoreSettings.ownerName || 'Store Administrator',
        storeId: selectedStoreId || 'store-main',
        storeName: activeStoreSettings.storeName || 'Store Account',
        loginTime: new Date().toISOString(),
        isOfflineLogin: !isOnline,
      });
    } catch (err) {
      console.error('Admin authentication error:', err);
      setErrorMsg('Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinClear = () => {
    setEnteredPin('');
    setErrorMsg(null);
  };

  // ----------------------------------------------------
  // CASHIER RESET REQUEST
  // ----------------------------------------------------
  const handleSubmitCashierResetRequest = async (e: React.FormEvent) => {
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
        `Reset request registered for ${cashier.name}. Please contact the Store Administrator to receive your temporary PIN.`
      );
      setResetReason('');
    } catch (err) {
      console.error('Failed submitting reset request:', err);
    }
  };

  // ----------------------------------------------------
  // FIRST-TIME & MULTI-STORE SETUP: SUBMIT & GENERATE RECOVERY CODE
  // ----------------------------------------------------
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (setupPin.length < 4 || setupPin.length > 6 || !/^\d+$/.test(setupPin)) {
      setErrorMsg('Admin PIN must be between 4 to 6 numeric digits.');
      return;
    }

    if (setupPin !== setupConfirmPin) {
      setErrorMsg('Admin PINs do not match. Please re-enter.');
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

    try {
      setLoading(true);
      const creds = await createAdminAuthCredentials(setupPin);
      const newStoreId = `store-${Date.now()}`;

      const newStoreSettings: Settings = {
        ...settings,
        storeId: newStoreId,
        storeName: setupStoreName.trim(),
        ownerName: setupOwnerName.trim(),
        adminPin: setupPin,
        adminPinHash: creds.adminPinHash,
        adminPinSalt: creds.adminPinSalt,
        recoveryCodeHash: creds.recoveryCodeHash,
        recoveryCodeSalt: creds.recoveryCodeSalt,
        recoveryCodeCreatedAt: creds.recoveryCodeCreatedAt,
        isSetup: true,
      };

      await saveSettings(newStoreSettings, newStoreId);

      const newStoreAccount: StoreAccount = {
        id: newStoreId,
        storeName: setupStoreName.trim(),
        ownerName: setupOwnerName.trim(),
        adminPinHash: creds.adminPinHash,
        adminPinSalt: creds.adminPinSalt,
        recoveryCodeHash: creds.recoveryCodeHash,
        recoveryCodeSalt: creds.recoveryCodeSalt,
        recoveryCodeCreatedAt: creds.recoveryCodeCreatedAt,
        createdAt: new Date().toISOString(),
        isSetup: true,
      };

      await saveStoreAccount(newStoreAccount);

      setGeneratedRecoveryCode(creds.recoveryCode);
      setSetupStep('recoveryCode');
      setSetupConfirmedSaved(false);
      setSelectedStoreId(newStoreId);
      setActiveStoreSettings(newStoreSettings);
      await loadStoreAccounts();
    } catch (err) {
      console.error('Failed to complete Admin Setup:', err);
      setErrorMsg('Failed to initialize Store Account credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySetupCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedRecoveryCode);
      setSetupCopied(true);
      setTimeout(() => setSetupCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadSetupDocument = () => {
    const content = generateRecoveryCodeDocument(
      generatedRecoveryCode,
      setupStoreName,
      setupOwnerName
    );
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-recovery-code-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintSetupDocument = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      window.print();
      return;
    }
    const docText = generateRecoveryCodeDocument(
      generatedRecoveryCode,
      setupStoreName,
      setupOwnerName
    );
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Admin Recovery Code — Mini Universal POS</title>
          <style>
            body { font-family: monospace; padding: 30px; line-height: 1.5; font-size: 13px; color: #000; background: #fff; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${docText}</pre>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCompleteSetupAndLogin = () => {
    if (!setupConfirmedSaved) return;
    setIsRegisteringNewStore(false);
    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: activeStoreSettings.ownerName || setupOwnerName.trim() || 'Store Administrator',
      storeId: selectedStoreId || 'store-main',
      storeName: activeStoreSettings.storeName || setupStoreName.trim() || 'Store Account',
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  // ----------------------------------------------------
  // FORGOT ADMIN PIN & OFFLINE RECOVERY FLOW
  // ----------------------------------------------------
  const handleOpenForgotAdminModal = () => {
    setErrorMsg(null);
    setRecoveryStep('enterCode');
    setRecoveryEnteredCode('');
    setRecoveryNewPin('');
    setRecoveryConfirmPin('');
    setReplacementCode('');
    setRecoveryCopied(false);
    setRecoveryConfirmedSaved(false);
    setShowForgotAdminModal(true);
  };

  const handleVerifyRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (lockoutRemainingSecs > 0) {
      setErrorMsg(`Too many failed attempts. Please wait ${lockoutRemainingSecs}s before retrying.`);
      return;
    }

    if (!recoveryEnteredCode.trim()) {
      setErrorMsg('Please enter your Recovery Code.');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyRecoveryCode(recoveryEnteredCode, activeStoreSettings);

      if (!isValid) {
        const nextAttempts = recoveryFailedAttempts + 1;
        setRecoveryFailedAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setLockoutRemainingSecs(30);
          setErrorMsg('Too many invalid attempts. Temporary security delay active (30s).');
        } else {
          setErrorMsg(`Invalid Recovery Code. Please verify your code. (${5 - nextAttempts} attempts remaining)`);
        }
        setLoading(false);
        return;
      }

      // Valid recovery code: advance to new PIN creation
      setRecoveryFailedAttempts(0);
      setRecoveryStep('newPin');
    } catch (err) {
      console.error('Recovery code validation error:', err);
      setErrorMsg('Failed to validate Recovery Code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewAdminPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (recoveryNewPin.length < 4 || recoveryNewPin.length > 6 || !/^\d+$/.test(recoveryNewPin)) {
      setErrorMsg('New Admin PIN must be 4 to 6 numeric digits.');
      return;
    }

    if (recoveryNewPin !== recoveryConfirmPin) {
      setErrorMsg('PINs do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      // 1. Generate new cryptographic credentials and replace old recovery code
      const newCreds = await createAdminAuthCredentials(recoveryNewPin);

      // 2. Update ONLY authentication records in settings (preserves all products, sales, reports, cashiers)
      const updatedSettings: Settings = {
        ...settings,
        adminPin: recoveryNewPin,
        adminPinHash: newCreds.adminPinHash,
        adminPinSalt: newCreds.adminPinSalt,
        recoveryCodeHash: newCreds.recoveryCodeHash,
        recoveryCodeSalt: newCreds.recoveryCodeSalt,
        recoveryCodeCreatedAt: newCreds.recoveryCodeCreatedAt,
        recoveryToken: undefined, // Invalidate old legacy token
        failedRecoveryAttempts: 0,
        recoveryLockoutUntil: undefined,
      };

      await saveSettings(updatedSettings);

      setReplacementCode(newCreds.recoveryCode);
      setRecoveryStep('saveReplacement');
      setRecoveryConfirmedSaved(false);
    } catch (err) {
      console.error('Failed to reset Admin PIN:', err);
      setErrorMsg('Failed to save new Admin PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReplacementCode = async () => {
    try {
      await navigator.clipboard.writeText(replacementCode);
      setRecoveryCopied(true);
      setTimeout(() => setRecoveryCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadReplacementDocument = () => {
    const content = generateRecoveryCodeDocument(
      replacementCode,
      settings.storeName,
      settings.ownerName
    );
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-replacement-recovery-code-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintReplacementDocument = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      window.print();
      return;
    }
    const docText = generateRecoveryCodeDocument(
      replacementCode,
      settings.storeName,
      settings.ownerName
    );
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Replacement Admin Recovery Code — Mini Universal POS</title>
          <style>
            body { font-family: monospace; padding: 30px; line-height: 1.5; font-size: 13px; color: #000; background: #fff; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <pre>${docText}</pre>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFinishRecoveryAndLogin = () => {
    if (!recoveryConfirmedSaved) return;
    setShowForgotAdminModal(false);
    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: settings.ownerName || 'Store Administrator',
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
        
        {isRegisteringNewStore || storeAccounts.length === 0 ? (
          // ==========================================
          // REGISTER NEW STORE ACCOUNT FLOW
          // ==========================================
          setupStep === 'form' ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4 text-left">
              <div className="text-center pb-2">
                <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-2">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Register Store Account</h3>
                <p className="text-xs text-slate-400">
                  Set up store profile and credentials for a new store account / branch
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Store Name / Branch</label>
                <input
                  type="text"
                  required
                  value={setupStoreName}
                  onChange={(e) => setSetupStoreName(e.target.value)}
                  placeholder="e.g. Main Store / Branch 1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Store Owner / Admin Name</label>
                <input
                  type="text"
                  required
                  value={setupOwnerName}
                  onChange={(e) => setSetupOwnerName(e.target.value)}
                  placeholder="e.g. Store Owner Name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Create Admin PIN (4–6 digits)</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={6}
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Admin PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  maxLength={6}
                  value={setupConfirmPin}
                  onChange={(e) => setSetupConfirmPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
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
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Creating Credentials...' : 'Register Store & Generate Recovery Code'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {storeAccounts.length > 0 && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisteringNewStore(false);
                      setErrorMsg(null);
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-white hover:underline transition-all cursor-pointer"
                  >
                    ← Back to Registered Store Accounts
                  </button>
                </div>
              )}
            </form>
          ) : (
            // ==========================================
            // SETUP: DEDICATED SAVE RECOVERY CODE SCREEN
            // ==========================================
            <div className="space-y-4 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Save Store Recovery Code</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Admin PIN for <strong>{setupStoreName}</strong> has been configured. In case you ever forget your Admin PIN, this unique <strong>Recovery Code</strong> is the <strong>only way</strong> to reset your PIN offline.
              </p>

              {/* Recovery Code Display Badge */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/40 space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Official Admin Recovery Code (Offline Only)
                </span>
                <div className="text-lg md:text-xl font-mono font-black text-amber-300 tracking-wider select-all py-1">
                  {generatedRecoveryCode}
                </div>
                <p className="text-[10px] text-slate-400">
                  This code will NOT be displayed again during normal POS usage.
                </p>
              </div>

              {/* Action Buttons: Copy, Download, Print */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleCopySetupCode}
                  className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {setupCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{setupCopied ? 'Copied!' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSetupDocument}
                  className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download .txt</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintSetupDocument}
                  className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Sheet</span>
                </button>
              </div>

              {/* Mandatory Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-left cursor-pointer hover:border-slate-600 transition">
                <input
                  type="checkbox"
                  checked={setupConfirmedSaved}
                  onChange={(e) => setSetupConfirmedSaved(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <span className="text-[11px] text-slate-300 leading-snug">
                  I confirm that I have copied, printed, or safely stored this Recovery Code offline.
                </span>
              </label>

              <button
                type="button"
                disabled={!setupConfirmedSaved}
                onClick={handleCompleteSetupAndLogin}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Complete Registration & Enter POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )
        ) : (
          // ==========================================
          // MAIN LOCAL PIN LOCK & ROLE-BASED ACCESS
          // ==========================================
          <>
            {/* Brand Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 p-2.5">
                <img src="/icon.svg" alt="POS Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {activeStoreSettings.storeName || 'Mini Universal POS'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-Store Credentials & Role Access • 100% Offline
                </p>
              </div>
            </div>

            {/* Store Account Selector */}
            <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 space-y-1.5 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-indigo-400" />
                  <span>Select Store Account / Branch</span>
                </span>
                {storeAccounts.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    {storeAccounts.length} Registered {storeAccounts.length === 1 ? 'Store' : 'Stores'}
                  </span>
                )}
              </div>
              <select
                value={selectedStoreId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setIsRegisteringNewStore(true);
                    setSetupStep('form');
                    setSetupStoreName('');
                    setSetupOwnerName('');
                    setSetupPin('');
                    setSetupConfirmPin('');
                    setErrorMsg(null);
                  } else {
                    setSelectedStoreId(e.target.value);
                    setEnteredPin('');
                    setErrorMsg(null);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs md:text-sm font-semibold text-white focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                {storeAccounts.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏢 {s.storeName || 'Store Account'} ({s.ownerName || 'Admin'})
                  </option>
                ))}
                <option value="__add_new__">+ Register New Store Account...</option>
              </select>
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
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  roleTab === 'cashier'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Cashier Access</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoleTab('admin');
                  setEnteredPin('');
                  setErrorMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                  roleTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin Access</span>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
                    >
                      {cashiers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {!c.active ? '(Inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-900/50 text-xs text-amber-300">
                      No cashier accounts registered yet. The Store Administrator can add cashier profiles in Admin Settings.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/50 text-xs text-indigo-300 flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-white">Full Administrator Access</span>
                    <span>Manage products, cashiers, stock, reports, and store data</span>
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
                      onClick={handleOpenForgotAdminModal}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
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
                        setShowCashierResetModal(true);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                    >
                      Forgot PIN?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    disabled={roleTab === 'cashier' && cashiers.length === 0}
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
                    placeholder={roleTab === 'cashier' && cashiers.length === 0 ? 'Disabled' : 'Enter PIN'}
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-center text-xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 shadow-inner disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {enteredPin.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePinClear}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md bg-slate-800 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
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
                disabled={(roleTab === 'cashier' && cashiers.length === 0) || loading}
                onClick={roleTab === 'cashier' ? () => handleCashierLogin() : () => handleAdminLogin()}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-white text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  roleTab === 'cashier'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                <span>{roleTab === 'cashier' ? 'Unlock POS Terminal' : 'Unlock Admin Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Footer Hint */}
            <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80 space-y-1.5">
              <div>Offline Local PIN Lock • Protected Business Records</div>
              {forceShowLogin && (
                <button
                  type="button"
                  onClick={() => setForceShowLogin(false)}
                  className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-all cursor-pointer block w-full text-center"
                >
                  Back to Setup Screen
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL: FORGOT ADMIN PIN & OFFLINE RECOVERY FLOW       */}
      {/* ==================================================== */}
      {showForgotAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5 text-left relative">
            <button
              type="button"
              onClick={() => setShowForgotAdminModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {recoveryStep === 'enterCode' && (
              <form onSubmit={handleVerifyRecoveryCodeSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Forgot Admin PIN?</h3>
                    <p className="text-xs text-slate-400">
                      Step 1 of 3: Enter your saved offline Recovery Code
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 leading-relaxed space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Offline Local Validation
                  </p>
                  <p>
                    Enter the Recovery Code generated during setup (e.g. <code>RC-XXXX-XXXX-XXXX</code>). Your business records and sales history will remain completely safe.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Enter Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    disabled={lockoutRemainingSecs > 0}
                    value={recoveryEnteredCode}
                    onChange={(e) => {
                      setRecoveryEnteredCode(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="RC-XXXX-XXXX-XXXX"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-base font-mono tracking-wider text-amber-300 uppercase placeholder-slate-600 focus:outline-hidden focus:border-amber-500 disabled:opacity-50"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotAdminModal(false)}
                    className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || lockoutRemainingSecs > 0}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{loading ? 'Verifying Code...' : 'Verify Recovery Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {recoveryStep === 'newPin' && (
              <form onSubmit={handleSaveNewAdminPinSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Set New Admin PIN</h3>
                    <p className="text-xs text-slate-400">
                      Step 2 of 3: Recovery Code verified. Enter your new Admin PIN
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Admin PIN (4–6 digits)
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={recoveryNewPin}
                    onChange={(e) => {
                      setRecoveryNewPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="••••"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm New Admin PIN
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={recoveryConfirmPin}
                    onChange={(e) => {
                      setRecoveryConfirmPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500"
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
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? 'Saving New PIN...' : 'Save PIN & Generate Replacement Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {recoveryStep === 'saveReplacement' && (
              <div className="space-y-4 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-white">Save Your Replacement Recovery Code</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your new Admin PIN is saved! Your previous Recovery Code has been <strong>invalidated</strong>. Save your new replacement code below:
                </p>

                <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    New Active Recovery Code (Single-Use)
                  </span>
                  <div className="text-lg md:text-xl font-mono font-black text-amber-300 tracking-wider select-all py-1">
                    {replacementCode}
                  </div>
                </div>

                {/* Actions: Copy, Download, Print */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReplacementCode}
                    className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    {recoveryCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{recoveryCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadReplacementDocument}
                    className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download .txt</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReplacementDocument}
                    className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print Sheet</span>
                  </button>
                </div>

                {/* Mandatory Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-left cursor-pointer hover:border-slate-600 transition">
                  <input
                    type="checkbox"
                    checked={recoveryConfirmedSaved}
                    onChange={(e) => setRecoveryConfirmedSaved(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I have safely copied, saved, or printed this replacement Recovery Code offline.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!recoveryConfirmedSaved}
                  onClick={handleFinishRecoveryAndLogin}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Finish Recovery & Unlock Admin Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CASHIER FORGOT PIN REQUEST                    */}
      {/* ==================================================== */}
      {showCashierResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in select-none">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Request Cashier PIN Reset</h3>
                <p className="text-xs text-slate-400">Submit an access reset request to the Store Administrator</p>
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
                    Please inform your Store Administrator. Once approved in the Admin Dashboard, the Admin will provide you with a temporary PIN.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCashierResetModal(false)}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCashierResetRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Cashier Profile
                  </label>
                  <select
                    value={resetCashierId}
                    onChange={(e) => setResetCashierId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white cursor-pointer"
                  >
                    {cashiers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Reason / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    placeholder="e.g. Forgot my 4-digit PIN..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCashierResetModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
