/**
 * Settings View Component
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings as SettingsIcon,
  Store,
  Shield,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Smartphone,
  Database,
  FileJson,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Package,
  Layers,
  Receipt,
  Users,
  Clock,
  Sparkles,
  Moon,
  Sun,
  Printer,
  ShoppingBag,
  Check,
  X,
  KeyRound,
  Copy,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Settings,
  saveSettings,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  clearAllData,
  DEFAULT_SETTINGS,
} from '../db/indexedDB';
import {
  createAdminAuthCredentials,
  verifyAdminPin,
  generateCryptoSalt,
  hashSecretWithSalt,
  generateRecoveryCodeDocument,
} from '../utils/cryptoAuth';
import {
  exportFullBusinessBackupZip,
  exportProductsOnlyTransferZip,
  inspectZipFile,
  executeFullRestore,
  executeProductsOnlyImport,
  executeSalesTransferImport,
  ZipInspection,
} from '../utils/zipTransfer';

interface SettingsViewProps {
  settings: Settings;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefresh,
}) => {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [ownerName, setOwnerName] = useState(settings.ownerName || 'Jerome Urbano');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storeContact, setStoreContact] = useState(settings.storeContact);
  const [storeTin, setStoreTin] = useState(settings.storeTin || '');
  const [receiptHeader, setReceiptHeader] = useState(settings.receiptHeader || 'Official Sales Receipt • Thank you for shopping with us!');
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [receiptPaperSize, setReceiptPaperSize] = useState<'80mm' | '58mm' | 'full'>(settings.receiptPaperSize || '80mm');
  const [receiptFontFamily, setReceiptFontFamily] = useState<'mono' | 'sans'>(settings.receiptFontFamily || 'mono');
  const [showBarcodeOnReceipt, setShowBarcodeOnReceipt] = useState(settings.showBarcodeOnReceipt !== false);
  const [showCashierOnReceipt, setShowCashierOnReceipt] = useState(settings.showCashierOnReceipt !== false);
  const [showLogoOnReceipt, setShowLogoOnReceipt] = useState(settings.showLogoOnReceipt !== false);
  const [showTaxOnReceipt, setShowTaxOnReceipt] = useState(settings.showTaxOnReceipt !== false);
  const [showCustomerOnReceipt, setShowCustomerOnReceipt] = useState(settings.showCustomerOnReceipt !== false);
  const [currency, setCurrency] = useState(settings.currency);
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.lowStockThreshold);
  const [adminPin, setAdminPin] = useState(settings.adminPin);
  const [animatedBg, setAnimatedBg] = useState(settings.animatedBackground !== false);
  const [isDarkMode, setIsDarkMode] = useState(settings.darkMode ?? false);
  const [autoLockMinutes, setAutoLockMinutes] = useState(settings.autoLockMinutes ?? 5);
  const [cashierCanViewAllSales, setCashierCanViewAllSales] = useState(settings.cashierCanViewAllSales ?? false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [receiptSavedAlert, setReceiptSavedAlert] = useState<{
    show: boolean;
    message: string;
    details: string;
  } | null>(null);
  const [showGenerateRecoveryModal, setShowGenerateRecoveryModal] = useState(false);
  const [genVerifyPin, setGenVerifyPin] = useState('');
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeConfirmedSaved, setCodeConfirmedSaved] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);

    const isMatch = await verifyAdminPin(genVerifyPin, settings);
    if (!isMatch) {
      setGenError('Incorrect Admin PIN. Verification failed.');
      return;
    }

    try {
      const creds = await createAdminAuthCredentials(adminPin || settings.adminPin || '1234');
      const updated: Settings = {
        ...settings,
        recoveryCodeHash: creds.recoveryCodeHash,
        recoveryCodeSalt: creds.recoveryCodeSalt,
        recoveryCodeCreatedAt: creds.recoveryCodeCreatedAt,
        recoveryToken: undefined,
      };

      await saveSettings(updated);
      setNewlyGeneratedCode(creds.recoveryCode);
      setCodeConfirmedSaved(false);
      onRefresh();
    } catch (err) {
      console.error('Failed generating new recovery code:', err);
      setGenError('Failed to generate replacement code.');
    }
  };

  const handleCopyNewCode = async () => {
    try {
      await navigator.clipboard.writeText(newlyGeneratedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const handleDownloadNewCodeDoc = () => {
    const content = generateRecoveryCodeDocument(
      newlyGeneratedCode,
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

  const handlePrintNewCodeDoc = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      window.print();
      return;
    }
    const docText = generateRecoveryCodeDocument(
      newlyGeneratedCode,
      settings.storeName,
      settings.ownerName
    );
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Replacement Admin Recovery Code</title>
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

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // ZIP Backup & Transfer states
  const [dbStats, setDbStats] = useState({
    products: 0,
    categories: 0,
    transactions: 0,
    customers: 0,
    loading: true
  });
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // ZIP Import Modal & States
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingZipInspection, setPendingZipInspection] = useState<ZipInspection | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importPin, setImportPin] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Clear Data Warning Modal states
  const [showClearWarningModal, setShowClearWarningModal] = useState(false);
  const [clearPin, setClearPin] = useState('');
  const [clearUnderstood, setClearUnderstood] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // Admin PIN prompt state for sensitive actions
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Load current DB stats and last backup date
  const loadStats = async () => {
    try {
      const [prods, cats, txs, custs] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllTransactions(),
        getAllCustomers()
      ]);
      setDbStats({
        products: prods.length,
        categories: cats.length,
        transactions: txs.length,
        customers: custs.length,
        loading: false
      });
    } catch (e) {
      console.error('Failed to load DB stats:', e);
      setDbStats((prev) => ({ ...prev, loading: false }));
    }

    try {
      const savedDate = localStorage.getItem('pos_last_backup_date');
      setLastBackupDate(savedDate);
    } catch (e) {
      console.debug('LocalStorage note:', e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert(
        'Paano I-install sa Mobile at PC:\n\n' +
        '• Android (Chrome): I-tap ang Menu (tatlong tuldok) sa itaas ng browser, pagkatapos ay piliin ang "Install app" o "Add to Home screen".\n\n' +
        '• iPhone/iPad (Safari): I-tap ang Share button sa ibaba, pagkatapos ay piliin ang "Add to Home Screen".\n\n' +
        '• PC / Laptop (Chrome/Edge): I-click ang Install icon sa kanang bahagi ng address bar o ang menu sa itaas.\n\n' +
        'Paalala: Kung kasalukuyan kayong nasa AI Studio preview, buksan muna ang app sa isang bagong tab ng inyong browser.'
      );
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const doSave = async () => {
      let pinHash = settings.adminPinHash;
      let pinSalt = settings.adminPinSalt;

      if (adminPin && adminPin !== settings.adminPin) {
        pinSalt = generateCryptoSalt(16);
        pinHash = await hashSecretWithSalt(adminPin, pinSalt);
      }

      const updated: Settings = {
        ...settings,
        storeName,
        ownerName,
        storeAddress,
        storeContact,
        storeTin,
        receiptHeader,
        receiptFooter,
        receiptPaperSize,
        receiptFontFamily,
        showBarcodeOnReceipt,
        showCashierOnReceipt,
        showLogoOnReceipt,
        showTaxOnReceipt,
        showCustomerOnReceipt,
        currency,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        adminPin,
        adminPinHash: pinHash,
        adminPinSalt: pinSalt,
        animatedBackground: animatedBg,
        darkMode: isDarkMode,
        autoLockMinutes: Number(autoLockMinutes) ?? 5,
        cashierCanViewAllSales,
      };

      try {
        await saveSettings(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        onRefresh();
      } catch (err) {
        console.error('Save settings error:', err);
        alert('Failed to save settings.');
      }
    };

    if (adminPin !== settings.adminPin) {
      verifyPinAndExecute(doSave);
    } else {
      doSave();
    }
  };

  const handleTestPrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Standard window.print failed:', e);
    }
    try {
      const receiptEl = document.querySelector('.printable-receipt');
      if (receiptEl) {
        const printWindow = window.open('', '_blank', 'width=450,height=650');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Test Print Receipt</title>
                <style>
                  body { font-family: 'Courier New', Courier, monospace; padding: 15px; font-size: 12px; color: #000; background: #fff; margin: 0; }
                  .text-center { text-align: center; }
                  .font-bold { font-weight: bold; }
                  .flex { display: flex; }
                  .justify-between { justify-content: space-between; }
                  .border-b-2 { border-bottom: 2px dashed #000; }
                  .border-b { border-bottom: 1px dashed #ccc; }
                  .pb-2 { padding-bottom: 8px; }
                  .mb-2 { margin-bottom: 8px; }
                  .no-print { display: none !important; }
                </style>
              </head>
              <body>
                ${receiptEl.innerHTML}
                <script>
                  window.onload = function() {
                    setTimeout(function() {
                      window.print();
                    }, 400);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    } catch (err) {
      console.error('Test print fallback error:', err);
    }
  };

  const handleSaveReceiptCustomization = () => {
    const doSaveReceipt = async () => {
      const updated: Settings = {
        ...settings,
        storeName,
        ownerName,
        storeAddress,
        storeContact,
        storeTin,
        receiptHeader,
        receiptFooter,
        receiptPaperSize,
        receiptFontFamily,
        showBarcodeOnReceipt,
        showCashierOnReceipt,
        showLogoOnReceipt,
        showTaxOnReceipt,
        showCustomerOnReceipt,
        currency,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        adminPin,
        animatedBackground: animatedBg,
        darkMode: isDarkMode,
      };

      try {
        await saveSettings(updated);
        setReceiptSavedAlert({
          show: true,
          message: 'Receipt Customization Saved Successfully!',
          details: `Format: ${receiptPaperSize.toUpperCase()} | Font: ${receiptFontFamily === 'mono' ? 'Monospace' : 'Clean Sans'} | Header & Footer updated.`
        });
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
        setTimeout(() => setReceiptSavedAlert(null), 6000);
        onRefresh();
      } catch (err) {
        console.error('Save receipt customization error:', err);
        alert('Failed to save receipt settings.');
      }
    };

    if (adminPin !== settings.adminPin) {
      verifyPinAndExecute(doSaveReceipt);
    } else {
      doSaveReceipt();
    }
  };

  const verifyPinAndExecute = (action: () => void) => {
    if (pinUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isMatch = await verifyAdminPin(enteredPin, settings);
    if (isMatch) {
      setPinUnlocked(true);
      setShowPinModal(false);
      setEnteredPin('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      alert('Incorrect Admin PIN.');
      setEnteredPin('');
    }
  };

  // 1. Export ZIP Data
  const handleExportFullZip = async () => {
    try {
      setExporting(true);
      await exportFullBusinessBackupZip();
      const now = new Date().toISOString();
      setLastBackupDate(now);
      localStorage.setItem('pos_last_backup_date', now);
      setExportSuccessMessage('Full Business Backup (.zip) generated successfully!');
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Export ZIP error:', err);
      alert('Failed to export backup. Please ensure your browser permits downloads.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportProductsOnly = async () => {
    try {
      setExporting(true);
      await exportProductsOnlyTransferZip();
      setExportSuccessMessage('Products-Only Transfer (.zip) generated successfully!');
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Export Products ZIP error:', err);
      alert('Failed to export products. Please check if you have products registered.');
    } finally {
      setExporting(false);
    }
  };

  // 2. Select file to Inspect & Import ZIP
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFileName(file.name);
    setImportError(null);
    setImporting(true);

    try {
      const inspection = await inspectZipFile(file);
      if (!inspection.valid) {
        alert(inspection.error || 'Invalid ZIP file structure.');
        return;
      }

      setPendingZipInspection(inspection);
      setImportPin('');
      setShowImportModal(true);
    } catch (err) {
      console.error('ZIP inspection error:', err);
      alert('Failed to read ZIP file. Make sure it is a valid POS backup.');
    } finally {
      setImporting(false);
      e.target.value = ''; // reset file input
    }
  };

  // 3. Confirm and Execute ZIP Import
  const handleConfirmImport = async () => {
    if (!pendingZipInspection) return;

    const isMatch = await verifyAdminPin(importPin, settings);
    if (!isMatch) {
      setImportError('Incorrect Admin PIN. Please enter your valid PIN to proceed.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);

      let result;
      if (pendingZipInspection.exportType === 'full_backup' || pendingZipInspection.exportType === 'legacy_json') {
        result = await executeFullRestore(pendingZipInspection);
      } else if (pendingZipInspection.exportType === 'products_transfer') {
        result = await executeProductsOnlyImport(pendingZipInspection);
      } else if (pendingZipInspection.exportType === 'sales_transfer') {
        result = await executeSalesTransferImport(pendingZipInspection);
      } else {
        throw new Error('Unsupported export type.');
      }

      if (result.success) {
        await loadStats();
        onRefresh();

        setTimeout(() => {
          alert(result.message);
          setShowImportModal(false);
          window.location.reload();
        }, 800);
      }
    } catch (err) {
      console.error('Import execution error:', err);
      setImportError('Failed to import database: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
    }
  };

  // 4. Clear All Data (Shows Backup Warning Alert First)
  const handleClearAllClick = () => {
    setClearPin('');
    setClearUnderstood(false);
    setClearError(null);
    setShowClearWarningModal(true);
  };

  const handleExecuteClearAll = async () => {
    if (!clearUnderstood) {
      setClearError('Please check the confirmation box acknowledging that all data will be permanently deleted.');
      return;
    }

    const isMatch = await verifyAdminPin(clearPin, settings);
    if (!isMatch) {
      setClearError('Incorrect Admin PIN. Please enter your valid Admin PIN.');
      return;
    }

    try {
      setClearing(true);
      setClearError(null);

      // Perform clean clear of all IndexedDB tables without blocking deleteDatabase
      await clearAllData(false);

      // Reset settings to default with PIN 1234
      await saveSettings({
        ...DEFAULT_SETTINGS,
        adminPin: '1234',
        storeName: settings.storeName || DEFAULT_SETTINGS.storeName,
        currency: settings.currency || DEFAULT_SETTINGS.currency,
      });

      // Clear localStorage cache for backup date
      try {
        localStorage.removeItem('pos_last_backup_date');
      } catch (e) {
        console.debug('LocalStorage note:', e);
      }

      await loadStats();
      onRefresh();

      alert('SUCCESS: All products, categories, transactions, and customers have been completely deleted from your database.');
      setShowClearWarningModal(false);
      window.location.reload();
    } catch (err) {
      console.error('Clear data error:', err);
      setClearError('Failed to clear database: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Settings & Configuration</h2>
        <p className="text-sm text-slate-500">Store profile, currency, security PIN, and local backup/restore</p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Settings successfully saved!</span>
        </div>
      )}

      {exportSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-blue-600" />
          <span className="text-sm font-medium">{exportSuccessMessage}</span>
        </div>
      )}

      {/* Store Settings Form */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <Store className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 dark:text-white">Store Information</h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Store Name *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Store Owner Name *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          {/* Offline Admin Recovery Code System */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Offline Admin PIN Recovery</h4>
                  <p className="text-xs text-slate-500">
                    Cryptographically salted recovery keys • 100% Offline
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGenVerifyPin('');
                  setGenError(null);
                  setNewlyGeneratedCode('');
                  setShowGenerateRecoveryModal(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Generate Replacement Code</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Active recovery codes are securely hashed and never displayed during daily use. If you have misplaced your printed or saved Recovery Code, verify your Admin PIN to generate a fresh replacement code.
            </div>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={storeContact}
                onChange={(e) => setStoreContact(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax ID / BIR TIN (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 123-456-789-000"
                value={storeTin}
                onChange={(e) => setStoreTin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Store Address
            </label>
            <input
              type="text"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min="1"
                required
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 10)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Admin PIN (4-digit)
              </label>
              <input
                type="password"
                maxLength={6}
                required
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Appearance & Atmosphere Settings */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Visual Atmosphere & Display
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Animated Background Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Animated Background</div>
                    <div className="text-[11px] text-slate-500">Fluid ambient aurora & retail grid</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={animatedBg}
                    onChange={(e) => setAnimatedBg(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Dark Mode Theme Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">Dark Mode</div>
                    <div className="text-[11px] text-slate-500">{isDarkMode ? 'Night Terminal Theme' : 'Clean Light Canvas'}</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={(e) => setIsDarkMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Security, Inactivity Auto-Lock & Sync Controls */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security, Inactivity Lock & Access Permissions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  POS Auto-Lock After Inactivity
                </label>
                <select
                  value={autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value={1}>1 Minute of Inactivity</option>
                  <option value={2}>2 Minutes of Inactivity</option>
                  <option value={5}>5 Minutes (Recommended)</option>
                  <option value={10}>10 Minutes of Inactivity</option>
                  <option value={15}>15 Minutes of Inactivity</option>
                  <option value={30}>30 Minutes of Inactivity</option>
                  <option value={0}>Disabled (Never Auto-Lock)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Locks terminal automatically when unattended to protect sales and stock data.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Cashier Sales Visibility
                </label>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {cashierCanViewAllSales ? 'Can view all store transactions' : 'Restricted to own shift sales only'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cashierCanViewAllSales}
                      onChange={(e) => setCashierCanViewAllSales(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Offline Local Storage & Data Privacy Banner */}
            <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-emerald-950 dark:text-emerald-200 block">
                  100% Offline Local Storage & Zero Cloud Dependency
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your store records and POS data stay strictly on this device. Use the <strong>ZIP Backup & Products Transfer</strong> tools below to transfer data safely.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer"
            >
              Save Store Settings
            </button>
          </div>
        </form>
      </div>

      {/* 2. Receipt Design & Customization (Customizing Receipt) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Receipt Design & Customization</h3>
              <p className="text-xs text-slate-500">I-customize ang hitsura, headers, footers, at layout ng iyong resibo na may live preview</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestPrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-xs hover:opacity-90 transition cursor-pointer self-start sm:self-auto"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Test Print Receipt</span>
          </button>
        </div>

        {receiptSavedAlert?.show && (
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-600 text-white p-4 shadow-lg border border-emerald-500 mb-4 transition-all duration-300">
            <div className="p-2 bg-white/20 rounded-xl text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">{receiptSavedAlert.message}</div>
              <div className="text-xs text-emerald-100 mt-0.5">{receiptSavedAlert.details}</div>
            </div>
            <button
              onClick={() => setReceiptSavedAlert(null)}
              className="p-1 rounded-lg text-white/80 hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Settings Controls */}
          <div className="lg:col-span-7 space-y-4">
            {/* Paper Size & Font Style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Paper Size
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setReceiptPaperSize('80mm')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                      receiptPaperSize === '80mm'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    80mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptPaperSize('58mm')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                      receiptPaperSize === '58mm'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    58mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptPaperSize('full')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition text-center ${
                      receiptPaperSize === 'full'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    A4 Full
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Receipt Font Style
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setReceiptFontFamily('mono')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition text-center ${
                      receiptFontFamily === 'mono'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Monospace
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptFontFamily('sans')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-sans font-bold transition text-center ${
                      receiptFontFamily === 'sans'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Clean Sans
                  </button>
                </div>
              </div>
            </div>

            {/* Receipt Header Tagline / Greeting */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Receipt Header Greeting / Tagline
              </label>
              <input
                type="text"
                placeholder="e.g. Official Sales Receipt • Thank you for shopping!"
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Receipt Footer Message / Return Policy */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Receipt Footer Message & Return Policy
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Thank you for your purchase! Goods sold are exchangeable within 7 days with this receipt."
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Element Display Toggles */}
            <div className="pt-2 space-y-2.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                Show / Hide Elements on Receipt
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Logo toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Show Store Logo/Icon</span>
                  <input
                    type="checkbox"
                    checked={showLogoOnReceipt}
                    onChange={(e) => setShowLogoOnReceipt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                {/* Cashier toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Show Cashier Name</span>
                  <input
                    type="checkbox"
                    checked={showCashierOnReceipt}
                    onChange={(e) => setShowCashierOnReceipt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                {/* Tax summary toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Show Tax / VAT Row</span>
                  <input
                    type="checkbox"
                    checked={showTaxOnReceipt}
                    onChange={(e) => setShowTaxOnReceipt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                {/* Customer toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Show Customer Name</span>
                  <input
                    type="checkbox"
                    checked={showCustomerOnReceipt}
                    onChange={(e) => setShowCustomerOnReceipt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveReceiptCustomization}
                className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition cursor-pointer"
              >
                Save Receipt Customizations
              </button>
            </div>
          </div>

          {/* Right / Interactive Live Receipt Preview */}
          <div className="lg:col-span-5 bg-slate-100 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Live Real-Time Preview
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {receiptPaperSize} • {receiptFontFamily}
              </span>
            </div>

            {/* Live Rendered Thermal Slip */}
            <div
              className={`w-full bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200/90 p-4 ${
                receiptFontFamily === 'mono' ? 'font-mono' : 'font-sans'
              } text-[11px] printable-receipt space-y-2.5 max-w-[340px] relative`}
            >
              {/* Top Serrated Edge */}
              <div className="no-print absolute -top-1 left-2 right-2 h-1 flex justify-between overflow-hidden opacity-30">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-slate-300 rotate-45 shrink-0 -mt-0.5" />
                ))}
              </div>

              {/* Header */}
              <div className="text-center space-y-0.5 pb-2 border-b-2 border-dashed border-slate-300">
                <div className="flex items-center justify-center gap-1 font-sans font-black text-sm text-slate-950">
                  {showLogoOnReceipt && <ShoppingBag className="w-4 h-4 text-blue-600" />}
                  <span>{storeName || 'MINI POS SYSTEM'}</span>
                </div>
                {storeAddress && <div className="text-slate-600 text-[10px] leading-tight">{storeAddress}</div>}
                {storeContact && <div className="text-slate-600 text-[10px]">Tel: {storeContact}</div>}
                {storeTin && <div className="text-slate-600 text-[10px]">TIN: {storeTin}</div>}
                {receiptHeader && <div className="text-[10px] italic text-slate-500 mt-0.5">{receiptHeader}</div>}
              </div>

              {/* Meta */}
              <div className="space-y-0.5 text-[10px] text-slate-700">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-bold">RCP-DEMO-2026</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {showCashierOnReceipt && (
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{ownerName || 'Admin'}</span>
                  </div>
                )}
                {showCustomerOnReceipt && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold">Walk-in Customer</span>
                  </div>
                )}
              </div>

              {/* Sample Items */}
              <div className="border-t-2 border-dashed border-slate-300 pt-1.5">
                <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-slate-200">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Amount</span>
                </div>
                <div className="py-1 space-y-1">
                  <div className="flex justify-between">
                    <span className="truncate">Sample Retail Item A</span>
                    <span className="font-bold">{currency}120.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="truncate">Sample Retail Item B (2x)</span>
                    <span className="font-bold">{currency}90.00</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t-2 border-dashed border-slate-300 pt-1.5 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{currency}210.00</span>
                </div>
                {showTaxOnReceipt && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>VAT / Tax (12%):</span>
                    <span>{currency}22.50</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs text-slate-950 pt-1 border-t border-slate-900">
                  <span>TOTAL:</span>
                  <span>{currency}210.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Tendered:</span>
                  <span>{currency}500.00</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change:</span>
                  <span>{currency}290.00</span>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-dashed border-slate-200 pt-1.5 text-center text-[9.5px] text-slate-500 leading-tight">
                {receiptFooter || 'Thank you for your purchase!'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Safety, Backup & Restore Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">IndexedDB Data Safety & Backup</h3>
              <p className="text-xs text-slate-500">Export your offline database to a JSON file or restore anytime to protect against data loss</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            IndexedDB Active
          </span>
        </div>

        {/* Live Storage Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 text-blue-600 shadow-2xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Products</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dbStats.loading ? '...' : dbStats.products} items
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Categories</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dbStats.loading ? '...' : dbStats.categories} categories
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 text-emerald-600 shadow-2xs">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Sales Records</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dbStats.loading ? '...' : dbStats.transactions} orders
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 text-purple-600 shadow-2xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Customers</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dbStats.loading ? '...' : dbStats.customers} saved
              </div>
            </div>
          </div>
        </div>

        {/* Last backup timestamp banner */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Last Backup Created:{' '}
              {lastBackupDate ? (
                <strong className="text-slate-700 dark:text-slate-300">
                  {new Date(lastBackupDate).toLocaleString()}
                </strong>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">No backup created yet on this device</span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={loadStats}
            className="hover:text-blue-600 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Counts
          </button>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Export Full ZIP */}
          <button
            onClick={handleExportFullZip}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-blue-100/70 dark:bg-blue-900/50 p-3.5 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Download className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {exporting ? 'Exporting...' : 'Export Full ZIP Backup'}
            </span>
            <span className="text-xs text-slate-500 mt-1">Full database + images in one ZIP</span>
          </button>

          {/* Export Products Only */}
          <button
            onClick={handleExportProductsOnly}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-indigo-100/70 dark:bg-indigo-900/50 p-3.5 text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {exporting ? 'Exporting...' : 'Products Transfer'}
            </span>
            <span className="text-xs text-slate-500 mt-1">Export only products for other devices</span>
          </button>

          {/* Restore ZIP/JSON */}
          <label className="flex flex-col items-center justify-center p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition text-center cursor-pointer group shadow-2xs">
            <div className="rounded-xl bg-emerald-100/70 dark:bg-emerald-900/50 p-3.5 text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">Restore Backup</span>
            <span className="text-xs text-slate-500 mt-1">Restore from ZIP or JSON file</span>
            <input
              type="file"
              accept=".zip,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Clear All Data */}
          <button
            onClick={handleClearAllClick}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-red-200 dark:border-red-900/50 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-red-100/70 dark:bg-red-900/50 p-3.5 text-red-600 dark:text-red-400 mb-3 group-hover:scale-110 transition">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-red-600">Clear All Data</span>
            <span className="text-xs text-slate-500 mt-1">Reset POS database</span>
          </button>

          {/* Install PWA */}
          <button
            onClick={handleInstallApp}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-indigo-100/70 dark:bg-indigo-900/50 p-2 text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition h-12 w-12 flex items-center justify-center overflow-hidden shadow-2xs">
              <img src="/icon.svg" alt="App Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Install App</span>
            <span className="text-xs text-slate-500 mt-1">Install to device home screen</span>
          </button>
        </div>
      </div>

      {/* Modal: Import Preview and Restore Confirmation */}
      {showImportModal && pendingZipInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import Database Backup</h3>
                  <p className="text-xs text-slate-500">{importFileName}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* File Content Preview */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Backup Content Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-500">Store Name:</div>
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {pendingZipInspection.storeName || 'Mini POS'}
                  </div>

                  <div className="text-slate-500">Backup Date:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingZipInspection.exportedAt ? new Date(pendingZipInspection.exportedAt).toLocaleDateString() : 'Unknown'}
                  </div>

                  <div className="text-slate-500">Import Type:</div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    {pendingZipInspection.exportType.replace('_', ' ')}
                  </div>

                  <div className="text-slate-500">Products:</div>
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {pendingZipInspection.counts.productsToAdd + pendingZipInspection.counts.productsToUpdate} items
                  </div>

                  <div className="text-slate-500">Categories:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingZipInspection.counts.categoriesToAdd} categories
                  </div>

                  {pendingZipInspection.exportType !== 'products_transfer' && (
                    <>
                      <div className="text-slate-500">Sales Transactions:</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {pendingZipInspection.counts.transactionsToAdd} records
                      </div>
                    </>
                  )}

                  <div className="text-slate-500">Images:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingZipInspection.counts.imagesCount} photos
                  </div>
                </div>
              </div>

              {/* Import Rules Notice */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-bold uppercase tracking-wider">Import Rules:</p>
                {pendingZipInspection.exportType === 'products_transfer' ? (
                  <p>• Updates product prices & info but <strong>PROTECTS</strong> your local stock inventory levels.</p>
                ) : pendingZipInspection.exportType === 'sales_transfer' ? (
                  <p>• Merges sales records without duplicating existing transactions.</p>
                ) : (
                  <p>• <strong>FULL RESTORE:</strong> Replaces entire business dataset. Local Admin PIN credentials will be strictly preserved.</p>
                )}
              </div>

              {/* Security PIN Authorization */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Authorize with Admin PIN:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={importPin}
                  onChange={(e) => setImportPin(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono text-center tracking-widest"
                />
              </div>

              {importError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs border border-red-200 dark:border-red-900">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || !importPin}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Restoring Data...
                    </>
                  ) : (
                    'Confirm & Restore'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Data & Backup Warning Alert */}
      {showClearWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-red-200 dark:border-red-900/60">
            {/* Header with prominent alert */}
            <div className="flex items-center gap-3 pb-4 border-b border-red-100 dark:border-red-950/60">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                  Warning: Need to Make a Backup First!
                </h3>
                <p className="text-xs text-slate-500">
                  Data loss prevention requirement
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-2">
                <p className="font-semibold text-xs leading-relaxed">
                  ⚠️ Before clearing your database, please ensure you make a backup first!
                </p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Clearing the database will permanently delete all your products, sales receipts, customer records, and inventory data from IndexedDB. If you do not have a JSON backup file, your products cannot be recovered.
                </p>
              </div>

              {/* Data at risk summary */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700/60">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Items to be permanently deleted:
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="text-slate-500">Products:</div>
                  <div className="font-bold text-red-600 dark:text-red-400">{dbStats.products} items</div>
                  <div className="text-slate-500">Categories:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{dbStats.categories} categories</div>
                  <div className="text-slate-500">Sales Records:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{dbStats.transactions} orders</div>
                  <div className="text-slate-500">Customers:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{dbStats.customers} saved</div>
                </div>
              </div>

              {/* Option 1: Backup First (Recommended) */}
              <div>
                <button
                  type="button"
                  onClick={handleExportFullZip}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Downloading Backup...' : 'Download ZIP Backup First (Recommended)'}
                </button>
              </div>

              {/* Danger authorization area */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearUnderstood}
                    onChange={(e) => setClearUnderstood(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    I understand that all products and database records will be permanently erased.
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enter Admin PIN to Confirm:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={clearPin}
                    onChange={(e) => setClearPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-mono tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {clearError && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[11px] border border-red-200 dark:border-red-900">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{clearError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearWarningModal(false)}
                    disabled={clearing}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteClearAll}
                    disabled={clearing || !clearUnderstood || !clearPin}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 shadow-md shadow-red-600/20 transition disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {clearing ? 'Clearing Database...' : 'Permanently Delete Everything'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin PIN Required</h3>
            </div>

            <form onSubmit={handlePinSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Please enter your Admin PIN to authorize this sensitive action.
              </p>
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition"
                >
                  Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Replacement Recovery Code */}
      {showGenerateRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative space-y-4">
            <button
              type="button"
              onClick={() => setShowGenerateRecoveryModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {!newlyGeneratedCode ? (
              <form onSubmit={handleGenerateRecoveryCodeSubmit} className="space-y-4 text-left">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Generate Replacement Code</h3>
                    <p className="text-xs text-slate-500">Verify your Admin PIN to issue a new code</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Security Notice:
                  </p>
                  <p>
                    Generating a new code will immediately <strong>invalidate</strong> any previous recovery code.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enter Current Admin PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    autoFocus
                    value={genVerifyPin}
                    onChange={(e) => setGenVerifyPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {genError && (
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs border border-red-200 dark:border-red-900">
                    {genError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowGenerateRecoveryModal(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition"
                  >
                    Generate Replacement
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">New Recovery Code Generated</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Save your new code offline. Your previous code is now inactive.
                  </p>
                </div>

                <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/40 space-y-1.5">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                    Active Recovery Code
                  </span>
                  <div className="text-lg font-mono font-black text-amber-300 tracking-wider select-all py-1">
                    {newlyGeneratedCode}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyNewCode}
                    className="py-2 px-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                    <span>{codeCopied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadNewCodeDoc}
                    className="py-2 px-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Download .txt</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintNewCodeDoc}
                    className="py-2 px-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Print Sheet</span>
                  </button>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left cursor-pointer">
                  <input
                    type="checkbox"
                    checked={codeConfirmedSaved}
                    onChange={(e) => setCodeConfirmedSaved(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0 h-4 w-4"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    I have safely copied, saved, or printed this replacement Recovery Code offline.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!codeConfirmedSaved}
                  onClick={() => setShowGenerateRecoveryModal(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
                >
                  Done & Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
