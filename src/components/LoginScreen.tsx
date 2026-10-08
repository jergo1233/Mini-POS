import React, { useState, useEffect } from 'react';
import {
  Lock,
  UserCheck,
  ShieldAlert,
  KeyRound,
  Store,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Printer,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
  LogIn,
  PlusCircle,
  User,
  PhoneCall,
} from 'lucide-react';
import {
  Cashier,
  Settings,
  StoreAccount,
  DEFAULT_SETTINGS,
  getAllCashiers,
  getAllStoreAccounts,
  saveStoreAccount,
  getSettings,
  saveSettings,
  saveResetRequest,
  CashierResetRequest,
  getAppState,
  saveAppState,
} from '../db/indexedDB';
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
  // Top-level mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login Role Tab: 'cashier' | 'admin'
  const [roleTab, setRoleTab] = useState<'cashier' | 'admin'>('cashier');

  // Input credentials (Username / Store Name are treated as one)
  const [enteredStoreName, setEnteredStoreName] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cashier Selection
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [selectedCashierId, setSelectedCashierId] = useState<string>('');

  // Multi-Store registered accounts list held in memory for auth matching
  const [storeAccounts, setStoreAccounts] = useState<StoreAccount[]>([]);

  // Cashier Forgot PIN Request Modal
  const [showCashierResetModal, setShowCashierResetModal] = useState(false);
  const [resetCashierId, setResetCashierId] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  // Admin Forgot PIN & Offline Recovery Modal States
  const [showForgotAdminModal, setShowForgotAdminModal] = useState(false);
  const [recoveryStoreName, setRecoveryStoreName] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'enterCode' | 'newPin' | 'saveReplacement'>('enterCode');
  const [recoveryEnteredCode, setRecoveryEnteredCode] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [replacementCode, setReplacementCode] = useState('');
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryConfirmedSaved, setRecoveryConfirmedSaved] = useState(false);
  const [recoveryFailedAttempts, setRecoveryFailedAttempts] = useState(0);
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState(0);

  // Registration states (Only Username/Store Name + PIN)
  const [setupStep, setSetupStep] = useState<'form' | 'recoveryCode'>('form');
  const [setupStoreName, setSetupStoreName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirmPin, setSetupConfirmPin] = useState('');
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState('');
  const [registeredStoreId, setRegisteredStoreId] = useState('');
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

  // Load all registered store accounts into memory
  const refreshStoreAccounts = async () => {
    try {
      const accounts = await getAllStoreAccounts();
      setStoreAccounts(accounts);

      // If zero stores registered, default mode to 'register' (initial setup)
      if (accounts.length === 0) {
        setAuthMode('register');
        setSetupStep('form');
        setEnteredStoreName('');
      } else {
        const lastStore = await getAppState<string>('last_store_name');
        if (lastStore && accounts.some((a) => a.storeName.trim().toLowerCase() === lastStore.trim().toLowerCase())) {
          setEnteredStoreName(lastStore);
        } else if (accounts.length === 1) {
          setEnteredStoreName(accounts[0].storeName);
        }
      }
    } catch (e) {
      console.warn('Failed loading store accounts:', e);
    }
  };

  useEffect(() => {
    refreshStoreAccounts();
  }, []);

  // Whenever enteredStoreName changes, attempt to load cashiers for that store
  useEffect(() => {
    const clean = enteredStoreName.trim().toLowerCase();
    if (!clean || storeAccounts.length === 0) {
      if (storeAccounts.length === 1) {
        getAllCashiers(storeAccounts[0].id).then((list) => {
          setCashiers(list);
          if (list.length > 0 && !selectedCashierId) {
            setSelectedCashierId(list[0].id);
          }
        });
      } else {
        setCashiers([]);
        setSelectedCashierId('');
      }
      return;
    }

    const matchedStore = storeAccounts.find((s) => s.storeName.trim().toLowerCase() === clean);
    if (matchedStore) {
      getAllCashiers(matchedStore.id).then((list) => {
        setCashiers(list);
        if (list.length > 0) {
          setSelectedCashierId(list[0].id);
        } else {
          setSelectedCashierId('');
        }
      });
    } else {
      setCashiers([]);
      setSelectedCashierId('');
    }
  }, [enteredStoreName, storeAccounts]);

  // ----------------------------------------------------
  // ADMIN LOGIN (Credentials & PIN Matching Verification)
  // ----------------------------------------------------
  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleanPin = enteredPin.trim();
    const cleanName = enteredStoreName.trim().toLowerCase();

    if (!cleanPin) {
      setErrorMsg('Please enter your Admin PIN.');
      return;
    }

    setLoading(true);
    try {
      const accounts = await getAllStoreAccounts();
      if (accounts.length === 0) {
        setErrorMsg('No registered accounts found. Please register an account first.');
        setAuthMode('register');
        setLoading(false);
        return;
      }

      let targetStore: StoreAccount | null = null;

      if (cleanName) {
        // User typed a Username / Store Name: verify against that specific account
        targetStore = accounts.find((s) => s.storeName.trim().toLowerCase() === cleanName) || null;
        if (!targetStore) {
          setErrorMsg(`Username / Store Name "${enteredStoreName.trim()}" not found. Please check spelling.`);
          setLoading(false);
          return;
        }

        const storeSettings = await getSettings(targetStore.id);
        const isMatch = await verifyAdminPin(cleanPin, {
          adminPin: storeSettings.adminPin || (targetStore as any).adminPin,
          adminPinHash: storeSettings.adminPinHash || targetStore.adminPinHash,
          adminPinSalt: storeSettings.adminPinSalt || targetStore.adminPinSalt,
        });

        if (!isMatch) {
          setErrorMsg(`Incorrect PIN for "${targetStore.storeName}". Please try again.`);
          setLoading(false);
          return;
        }
      } else {
        // Username / Store Name field left blank:
        // Test entered PIN across all registered store accounts
        const matchingStores: StoreAccount[] = [];
        for (const store of accounts) {
          const storeSettings = await getSettings(store.id);
          const isMatch = await verifyAdminPin(cleanPin, {
            adminPin: storeSettings.adminPin || (store as any).adminPin,
            adminPinHash: storeSettings.adminPinHash || store.adminPinHash,
            adminPinSalt: storeSettings.adminPinSalt || store.adminPinSalt,
          });
          if (isMatch) {
            matchingStores.push(store);
          }
        }

        if (matchingStores.length === 1) {
          targetStore = matchingStores[0];
        } else if (matchingStores.length > 1) {
          setErrorMsg('Multiple accounts match this PIN. Please enter your Username / Store Name.');
          setLoading(false);
          return;
        } else {
          setErrorMsg('Incorrect PIN. Please check your PIN or enter your Username / Store Name.');
          setLoading(false);
          return;
        }
      }

      // Successful Admin Authentication
      try {
        await saveAppState('last_store_name', targetStore.storeName);
        await saveAppState('last_store_id', targetStore.id);
      } catch {}

      const storeSettings = await getSettings(targetStore.id);

      onLoginSuccess({
        role: 'admin',
        id: 'admin',
        name: storeSettings.ownerName || targetStore.ownerName || targetStore.storeName,
        storeId: targetStore.id,
        storeName: targetStore.storeName,
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

  // ----------------------------------------------------
  // CASHIER LOGIN (Credentials Verification)
  // ----------------------------------------------------
  const handleCashierLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleanPin = enteredPin.trim();
    if (!cleanPin) {
      setErrorMsg('Please enter your Cashier PIN.');
      return;
    }

    setLoading(true);
    try {
      const accounts = await getAllStoreAccounts();
      const cleanName = enteredStoreName.trim().toLowerCase();
      let targetStore: StoreAccount | null = null;

      if (cleanName) {
        targetStore = accounts.find((s) => s.storeName.trim().toLowerCase() === cleanName) || null;
        if (!targetStore) {
          setErrorMsg(`Username / Store Name "${enteredStoreName.trim()}" not found. Please check spelling.`);
          setLoading(false);
          return;
        }
      } else if (accounts.length === 1) {
        targetStore = accounts[0];
      }

      if (!targetStore) {
        const allCashiers = await getAllCashiers();
        const matching = allCashiers.filter((c) => c.pin === cleanPin && c.active);
        if (matching.length === 1) {
          const matchedCashier = matching[0];
          const foundStore = accounts.find((s) => s.id === matchedCashier.storeId) || accounts[0];
          try {
            await saveAppState('last_store_name', foundStore.storeName);
            await saveAppState('last_store_id', foundStore.id);
          } catch {}

          onLoginSuccess({
            role: 'cashier',
            id: matchedCashier.id,
            name: matchedCashier.name,
            storeId: foundStore.id,
            storeName: foundStore.storeName,
            loginTime: new Date().toISOString(),
            isOfflineLogin: !isOnline,
          });
          return;
        } else if (matching.length > 1) {
          setErrorMsg('Multiple cashiers match this PIN. Please enter your Username / Store Name.');
          setLoading(false);
          return;
        } else {
          setErrorMsg('Please enter your Username / Store Name to identify your cashier profile.');
          setLoading(false);
          return;
        }
      }

      // Store identified: find cashier for this specific store
      const storeCashiers = await getAllCashiers(targetStore.id);
      let cashier = storeCashiers.find((c) => c.id === selectedCashierId);

      if (!cashier) {
        cashier = storeCashiers.find((c) => c.pin === cleanPin);
      }

      if (!cashier) {
        setErrorMsg('Incorrect Cashier PIN or profile not found.');
        setLoading(false);
        return;
      }

      if (cashier.pin !== cleanPin) {
        setErrorMsg('Incorrect Cashier PIN. Please try again or request a reset.');
        setLoading(false);
        return;
      }

      if (!cashier.active) {
        setErrorMsg('This cashier account is inactive. Please contact your Store Administrator.');
        setLoading(false);
        return;
      }

      try {
        await saveAppState('last_store_name', targetStore.storeName);
        await saveAppState('last_store_id', targetStore.id);
      } catch {}

      onLoginSuccess({
        role: 'cashier',
        id: cashier.id,
        name: cashier.name,
        storeId: targetStore.id,
        storeName: targetStore.storeName,
        loginTime: new Date().toISOString(),
        isOfflineLogin: !isOnline,
      });
    } catch (err) {
      console.error('Cashier login error:', err);
      setErrorMsg('Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // STORE REGISTRATION (New Account Registration)
  // ----------------------------------------------------
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanStoreName = setupStoreName.trim();

    if (!cleanStoreName) {
      setErrorMsg('Username / Store Name is required.');
      return;
    }

    if (setupPin.length < 4 || setupPin.length > 6 || !/^\d+$/.test(setupPin)) {
      setErrorMsg('PIN must be between 4 to 6 numeric digits.');
      return;
    }

    if (setupPin !== setupConfirmPin) {
      setErrorMsg('PINs do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);

      // Check if Username / Store Name is already registered
      const existingAccounts = await getAllStoreAccounts();
      const duplicate = existingAccounts.find(
        (a) => a.storeName.trim().toLowerCase() === cleanStoreName.toLowerCase()
      );
      if (duplicate) {
        setErrorMsg(`Username / Store Name "${cleanStoreName}" is already registered. Please choose a unique name.`);
        setLoading(false);
        return;
      }

      const creds = await createAdminAuthCredentials(setupPin);
      const newStoreId = `store-${Date.now()}`;

      // Save new store settings
      const newStoreSettings: Settings = {
        ...DEFAULT_SETTINGS,
        storeId: newStoreId,
        storeName: cleanStoreName,
        ownerName: cleanStoreName,
        adminPin: setupPin,
        adminPinHash: creds.adminPinHash,
        adminPinSalt: creds.adminPinSalt,
        recoveryCodeHash: creds.recoveryCodeHash,
        recoveryCodeSalt: creds.recoveryCodeSalt,
        recoveryCodeCreatedAt: creds.recoveryCodeCreatedAt,
        isSetup: true,
      };

      await saveSettings(newStoreSettings, newStoreId);

      // Save new store account
      const newStoreAccount: StoreAccount = {
        id: newStoreId,
        storeName: cleanStoreName,
        ownerName: cleanStoreName,
        adminPinHash: creds.adminPinHash,
        adminPinSalt: creds.adminPinSalt,
        recoveryCodeHash: creds.recoveryCodeHash,
        recoveryCodeSalt: creds.recoveryCodeSalt,
        recoveryCodeCreatedAt: creds.recoveryCodeCreatedAt,
        createdAt: new Date().toISOString(),
        isSetup: true,
      };

      await saveStoreAccount(newStoreAccount);

      // Refresh store accounts in state
      const updatedAccounts = await getAllStoreAccounts();
      setStoreAccounts(updatedAccounts);

      setRegisteredStoreId(newStoreId);
      setGeneratedRecoveryCode(creds.recoveryCode);
      setSetupStep('recoveryCode');
      setSetupConfirmedSaved(false);
    } catch (err) {
      console.error('Failed to register store:', err);
      setErrorMsg('Failed to create account credentials. Please try again.');
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
      setupStoreName
    );
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-code-${setupStoreName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
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
      setupStoreName
    );
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recovery Code — ${setupStoreName}</title>
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

  const handleCompleteSetupAndLogin = async () => {
    if (!setupConfirmedSaved) return;

    try {
      await saveAppState('last_store_name', setupStoreName.trim());
      await saveAppState('last_store_id', registeredStoreId);
    } catch {}

    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: setupStoreName.trim(),
      storeId: registeredStoreId || 'store-main',
      storeName: setupStoreName.trim(),
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  // ----------------------------------------------------
  // CASHIER FORGOT PIN REQUEST
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
        `Reset request registered for ${cashier.name}. Please inform your Store Administrator to approve and receive a temporary PIN.`
      );
      setResetReason('');
    } catch (err) {
      console.error('Failed submitting reset request:', err);
    }
  };

  // ----------------------------------------------------
  // ADMIN FORGOT PIN & OFFLINE RECOVERY FLOW
  // ----------------------------------------------------
  const handleOpenForgotAdminModal = () => {
    setErrorMsg(null);
    setRecoveryStoreName(enteredStoreName.trim());
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
      const accounts = await getAllStoreAccounts();
      let targetStore: StoreAccount | null = null;
      const cleanName = recoveryStoreName.trim().toLowerCase();

      if (cleanName) {
        targetStore = accounts.find((s) => s.storeName.trim().toLowerCase() === cleanName) || null;
      } else if (accounts.length === 1) {
        targetStore = accounts[0];
      }

      if (!targetStore) {
        for (const s of accounts) {
          const isValid = await verifyRecoveryCode(recoveryEnteredCode.trim(), {
            recoveryCodeHash: s.recoveryCodeHash,
            recoveryCodeSalt: s.recoveryCodeSalt,
          });
          if (isValid) {
            targetStore = s;
            setRecoveryStoreName(s.storeName);
            break;
          }
        }
      }

      if (!targetStore) {
        const nextAttempts = recoveryFailedAttempts + 1;
        setRecoveryFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutRemainingSecs(30);
          setErrorMsg('Too many invalid attempts. Temporary security lockout active (30s).');
        } else {
          setErrorMsg(`Invalid Recovery Code or Account not found. (${5 - nextAttempts} attempts remaining)`);
        }
        setLoading(false);
        return;
      }

      const isValid = await verifyRecoveryCode(recoveryEnteredCode.trim(), {
        recoveryCodeHash: targetStore.recoveryCodeHash,
        recoveryCodeSalt: targetStore.recoveryCodeSalt,
      });

      if (!isValid) {
        const nextAttempts = recoveryFailedAttempts + 1;
        setRecoveryFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutRemainingSecs(30);
          setErrorMsg('Too many invalid attempts. Temporary security lockout active (30s).');
        } else {
          setErrorMsg(`Invalid Recovery Code. Please verify your code. (${5 - nextAttempts} attempts remaining)`);
        }
        setLoading(false);
        return;
      }

      setRecoveryFailedAttempts(0);
      setRecoveryStep('newPin');
    } catch (err) {
      console.error('Recovery validation error:', err);
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
      const accounts = await getAllStoreAccounts();
      const cleanName = recoveryStoreName.trim().toLowerCase();
      let targetStore = accounts.find((s) => s.storeName.trim().toLowerCase() === cleanName) || null;

      if (!targetStore && accounts.length === 1) {
        targetStore = accounts[0];
      }

      if (!targetStore) {
        setErrorMsg('Account not found.');
        setLoading(false);
        return;
      }

      const newCreds = await createAdminAuthCredentials(recoveryNewPin);

      const currentSettings = await getSettings(targetStore.id);
      const updatedSettings: Settings = {
        ...currentSettings,
        storeId: targetStore.id,
        adminPin: recoveryNewPin,
        adminPinHash: newCreds.adminPinHash,
        adminPinSalt: newCreds.adminPinSalt,
        recoveryCodeHash: newCreds.recoveryCodeHash,
        recoveryCodeSalt: newCreds.recoveryCodeSalt,
        recoveryCodeCreatedAt: newCreds.recoveryCodeCreatedAt,
      };

      await saveSettings(updatedSettings, targetStore.id);

      const updatedAcc: StoreAccount = {
        ...targetStore,
        adminPinHash: newCreds.adminPinHash,
        adminPinSalt: newCreds.adminPinSalt,
        recoveryCodeHash: newCreds.recoveryCodeHash,
        recoveryCodeSalt: newCreds.recoveryCodeSalt,
        recoveryCodeCreatedAt: newCreds.recoveryCodeCreatedAt,
      };

      await saveStoreAccount(updatedAcc);
      await refreshStoreAccounts();

      setReplacementCode(newCreds.recoveryCode);
      setRecoveryStep('saveReplacement');
      setRecoveryConfirmedSaved(false);
    } catch (err) {
      console.error('Failed to save new PIN:', err);
      setErrorMsg('Failed to update Admin PIN. Please try again.');
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
      recoveryStoreName,
      recoveryStoreName
    );
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replacement-recovery-code-${new Date().toISOString().slice(0, 10)}.txt`;
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
      recoveryStoreName,
      recoveryStoreName
    );
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Replacement Recovery Code</title>
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

  const handleFinishRecoveryAndLogin = async () => {
    if (!recoveryConfirmedSaved) return;
    setShowForgotAdminModal(false);

    const accounts = await getAllStoreAccounts();
    const cleanName = recoveryStoreName.trim().toLowerCase();
    const targetStore = accounts.find((s) => s.storeName.trim().toLowerCase() === cleanName) || accounts[0];

    try {
      if (targetStore) {
        await saveAppState('last_store_name', targetStore.storeName);
        await saveAppState('last_store_id', targetStore.id);
      }
    } catch {}

    onLoginSuccess({
      role: 'admin',
      id: 'admin',
      name: targetStore?.ownerName || targetStore?.storeName || 'Store Account',
      storeId: targetStore?.id || 'store-main',
      storeName: targetStore?.storeName || 'Store Account',
      loginTime: new Date().toISOString(),
      isOfflineLogin: !isOnline,
    });
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 px-4 py-8 relative overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphism Card */}
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl p-6 md:p-8 relative z-10 space-y-6">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 p-2.5">
            <img src="/icon.svg" alt="POS Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Mini Universal POS
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              IndexedDB Storage • 100% Offline
            </p>
          </div>
        </div>

        {/* Top Segmented Navigation: Sign In vs Register Account */}
        {storeAccounts.length > 0 && (
          <div className="grid grid-cols-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMsg(null);
                setEnteredPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setSetupStep('form');
                setErrorMsg(null);
                setSetupStoreName('');
                setSetupPin('');
                setSetupConfirmPin('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register Account</span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: REGISTER ACCOUNT (Only Username/Store Name & PIN)  */}
        {/* ========================================================= */}
        {authMode === 'register' || storeAccounts.length === 0 ? (
          setupStep === 'form' ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4 text-left">
              <div className="text-center pb-2">
                <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-2">
                  <Store className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {storeAccounts.length === 0 ? 'First-Time Setup' : 'Register Account'}
                </h3>
                <p className="text-xs text-slate-400">
                  {storeAccounts.length === 0
                    ? 'Set up your Username / Store Name and Security PIN'
                    : 'Create an account with a unique Username / Store Name and PIN'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username / Store Name
                </label>
                <input
                  type="text"
                  required
                  value={setupStoreName}
                  onChange={(e) => setSetupStoreName(e.target.value)}
                  placeholder="Enter Username / Store Name"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  PIN (4–6 digits)
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm PIN
                </label>
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
                <span>{loading ? 'Registering...' : 'Register Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {storeAccounts.length > 0 && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-white hover:underline transition-all cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              )}
            </form>
          ) : (
            // ==========================================
            // RECOVERY CODE SAVE SCREEN
            // ==========================================
            <div className="space-y-4 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 text-emerald-400">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Save Account Recovery Code</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Credentials for <strong>{setupStoreName}</strong> have been registered. Keep this <strong>Recovery Code</strong> in case you forget your PIN.
              </p>

              <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/40 space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Official Recovery Code
                </span>
                <div className="text-lg md:text-xl font-mono font-black text-amber-300 tracking-wider select-all py-1">
                  {generatedRecoveryCode}
                </div>
                <p className="text-[10px] text-slate-400">
                  Store this code safely. It will not be shown again.
                </p>
              </div>

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
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintSetupDocument}
                  className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print</span>
                </button>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-left cursor-pointer hover:border-slate-600 transition">
                <input
                  type="checkbox"
                  checked={setupConfirmedSaved}
                  onChange={(e) => setSetupConfirmedSaved(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                />
                <span className="text-[11px] text-slate-300 leading-snug">
                  I confirm that I have safely copied or saved this Recovery Code.
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
          // =========================================================
          // VIEW 2: SIGN IN / LOGIN FLOW (Username / Store Name + PIN)
          // =========================================================
          <>
            {/* Role Access Switcher: Cashier vs Admin */}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (roleTab === 'cashier') handleCashierLogin();
                else handleAdminLogin();
              }}
              className="space-y-4 text-left"
            >
              {/* Field 1: Username / Store Name Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username / Store Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={enteredStoreName}
                    onChange={(e) => {
                      setEnteredStoreName(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Enter Username / Store Name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Cashier profile selection if applicable */}
              {roleTab === 'cashier' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Cashier Profile
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
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-900/50 text-xs text-amber-300">
                      {enteredStoreName.trim()
                        ? 'No cashier profiles found for this account. Admin can create cashier profiles in Settings.'
                        : 'Enter your Username / Store Name above to load cashier profiles.'}
                    </div>
                  )}
                </div>
              )}

              {/* Field 2: PIN Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {roleTab === 'cashier' ? 'Cashier PIN' : 'Admin PIN'}
                  </label>
                  {roleTab === 'admin' ? (
                    <button
                      type="button"
                      onClick={handleOpenForgotAdminModal}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                    >
                      Forgot Admin PIN?
                    </button>
                  ) : (
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
                    required
                    value={enteredPin}
                    maxLength={6}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="••••"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500"
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

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Main Submit Action */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-xl font-bold text-white text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  roleTab === 'cashier'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                }`}
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : roleTab === 'cashier'
                    ? 'Unlock POS Terminal'
                    : 'Unlock Admin Dashboard'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Footer Notice */}
            <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-800/80 space-y-1">
              <div>IndexedDB Encrypted Credentials • Offline Operations</div>
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
                    Enter the Recovery Code generated when your account was registered.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username / Store Name
                  </label>
                  <input
                    type="text"
                    value={recoveryStoreName}
                    onChange={(e) => setRecoveryStoreName(e.target.value)}
                    placeholder="Enter Username / Store Name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
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
                      setRecoveryEnteredCode(e.target.value.toUpperCase());
                      setErrorMsg(null);
                    }}
                    placeholder="RC-XXXX-XXXX-XXXX"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-3 text-center text-sm font-mono tracking-wider text-amber-300 placeholder-slate-600 focus:outline-hidden focus:border-amber-500 uppercase disabled:opacity-40"
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
                  disabled={loading || lockoutRemainingSecs > 0}
                  className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? 'Verifying Code...' : 'Verify Offline Recovery Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
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
                      Step 2 of 3: Enter your new Admin PIN
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
                <h3 className="font-bold text-lg text-white">Save Replacement Recovery Code</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your new PIN is saved! Save your new replacement recovery code below:
                </p>

                <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    New Active Recovery Code
                  </span>
                  <div className="text-lg md:text-xl font-mono font-black text-amber-300 tracking-wider select-all py-1">
                    {replacementCode}
                  </div>
                </div>

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
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReplacementDocument}
                    className="py-2.5 px-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-700/60 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Print</span>
                  </button>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-left cursor-pointer hover:border-slate-600 transition">
                  <input
                    type="checkbox"
                    checked={recoveryConfirmedSaved}
                    onChange={(e) => setRecoveryConfirmedSaved(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer h-4 w-4"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I have safely saved this replacement Recovery Code offline.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!recoveryConfirmedSaved}
                  onClick={handleFinishRecoveryAndLogin}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Finish Recovery & Unlock Dashboard</span>
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
                    Please inform your Store Administrator to approve and generate a temporary PIN.
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
                    placeholder="e.g. Forgot my PIN..."
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
