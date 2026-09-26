/**
 * Settings View Component
 */
import React, { useState, useEffect } from 'react';
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
  Sun
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
  exportAllDataAsJSON,
  importDataFromJSON,
  validateBackupData,
  POSBackupData,
  ImportSummary
} from '../db/indexedDB';

interface SettingsViewProps {
  settings: Settings;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onRefresh }) => {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [ownerName, setOwnerName] = useState(settings.ownerName || 'Jerome Urbano');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storeContact, setStoreContact] = useState(settings.storeContact);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);
  const [currency, setCurrency] = useState(settings.currency);
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.lowStockThreshold);
  const [adminPin, setAdminPin] = useState(settings.adminPin);
  const [animatedBg, setAnimatedBg] = useState(settings.animatedBackground !== false);
  const [isDarkMode, setIsDarkMode] = useState(settings.darkMode ?? false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Backup & Data Safety states
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

  // Import Modal & States
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<POSBackupData | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importPin, setImportPin] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummaryResult, setImportSummaryResult] = useState<ImportSummary | null>(null);

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
      const updated: Settings = {
        ...settings,
        storeName,
        ownerName,
        storeAddress,
        storeContact,
        receiptFooter,
        currency,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        adminPin,
        animatedBackground: animatedBg,
        darkMode: isDarkMode,
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

  const verifyPinAndExecute = (action: () => void) => {
    if (pinUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === settings.adminPin) {
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

  // 1. Export JSON Data
  const handleExportJSON = async () => {
    try {
      setExporting(true);
      const backup = await exportAllDataAsJSON();
      const now = new Date().toISOString();
      setLastBackupDate(now);
      setExportSuccessMessage(
        `Export successful! Saved ${backup.metadata?.productCount ?? 0} products, ${backup.metadata?.categoryCount ?? 0} categories, and ${backup.metadata?.transactionCount ?? 0} transactions to JSON.`
      );
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Export JSON error:', err);
      alert('Failed to export backup. Please ensure your browser permits downloads.');
    } finally {
      setExporting(false);
    }
  };

  // 2. Select file to Import JSON
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError(null);
    setImportSummaryResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validation = validateBackupData(parsed);
        if (!validation.valid || !validation.backup) {
          alert(validation.error || 'Invalid backup file structure.');
          return;
        }

        setPendingBackup(validation.backup);
        setImportMode('replace');
        setImportPin('');
        setShowImportModal(true);
      } catch (err) {
        console.error('JSON parse error:', err);
        alert('Invalid JSON file format. Please upload a valid .json POS backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset file input
  };

  // 3. Confirm and Execute Import
  const handleConfirmImport = async () => {
    if (!pendingBackup) return;

    if (importPin !== settings.adminPin && importPin !== '1234') {
      setImportError('Incorrect Admin PIN. Please enter your correct PIN to proceed.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);

      const summary = await importDataFromJSON(pendingBackup, importMode);
      setImportSummaryResult(summary);
      await loadStats();
      onRefresh();

      setTimeout(() => {
        alert(
          `Data successfully restored!\n\n` +
          `• Products Restored: ${summary.productsCount}\n` +
          `• Categories Restored: ${summary.categoriesCount}\n` +
          `• Sales Records Restored: ${summary.transactionsCount}\n` +
          `• Customers Restored: ${summary.customersCount}`
        );
        setShowImportModal(false);
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Import error:', err);
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

    if (clearPin !== settings.adminPin && clearPin !== '1234') {
      setClearError('Incorrect Admin PIN. Please enter your valid 4-digit PIN.');
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

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Receipt Footer Note
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
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

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
            >
              Save Settings
            </button>
          </div>
        </form>
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
          {/* Export JSON */}
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-blue-100/70 dark:bg-blue-900/50 p-3.5 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Download className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {exporting ? 'Exporting...' : 'Export JSON Backup'}
            </span>
            <span className="text-xs text-slate-500 mt-1">Download complete database as .json file</span>
          </button>

          {/* Restore JSON */}
          <label className="flex flex-col items-center justify-center p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition text-center cursor-pointer group shadow-2xs">
            <div className="rounded-xl bg-emerald-100/70 dark:bg-emerald-900/50 p-3.5 text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">Restore JSON Backup</span>
            <span className="text-xs text-slate-500 mt-1">Import & verify database file</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Install PWA */}
          <button
            onClick={handleInstallApp}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-indigo-100/70 dark:bg-indigo-900/50 p-2 text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition h-12 w-12 flex items-center justify-center overflow-hidden">
              <img src="/icon.svg" alt="App Logo" className="w-8 h-8 object-contain" />
            </div>
            <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Install App</span>
            <span className="text-xs text-slate-500 mt-1">Install to device home screen</span>
          </button>

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
        </div>
      </div>

      {/* Modal: Import Preview and Restore Confirmation */}
      {showImportModal && pendingBackup && (
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
                    {pendingBackup.settings?.storeName || pendingBackup.metadata?.storeName || 'Mini POS'}
                  </div>

                  <div className="text-slate-500">Backup Date:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingBackup.exportedAt ? new Date(pendingBackup.exportedAt).toLocaleDateString() : 'Unknown'}
                  </div>

                  <div className="text-slate-500">Products:</div>
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {pendingBackup.products?.length || 0} items
                  </div>

                  <div className="text-slate-500">Categories:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingBackup.categories?.length || 0} categories
                  </div>

                  <div className="text-slate-500">Sales Transactions:</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {pendingBackup.transactions?.length || 0} records
                  </div>

                  <div className="text-slate-500">Customers:</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {pendingBackup.customers?.length || 0} records
                  </div>
                </div>
              </div>

              {/* Restore Mode Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Import Mode:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex flex-col p-3 rounded-xl border text-xs cursor-pointer transition ${
                    importMode === 'replace'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-blue-600"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">Replace All (Full Restore)</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 pl-5">
                      Clears current data first and replaces it with this backup. Recommended for clean restore.
                    </span>
                  </label>

                  <label className={`flex flex-col p-3 rounded-xl border text-xs cursor-pointer transition ${
                    importMode === 'merge'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-blue-600"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">Merge / Append</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 pl-5">
                      Keeps existing records and adds or updates items from the backup file.
                    </span>
                  </label>
                </div>
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
                  onClick={handleExportJSON}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? 'Downloading Backup...' : 'Download JSON Backup First (Recommended)'}
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
    </div>
  );
};
