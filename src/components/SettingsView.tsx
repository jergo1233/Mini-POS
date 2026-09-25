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
  Smartphone
} from 'lucide-react';
import {
  Settings,
  Product,
  Category,
  Transaction,
  Customer,
  saveSettings,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  saveProduct,
  saveCategory,
  saveTransaction,
  saveCustomer,
  clearAllData,
  blobToBase64,
  base64ToBlob,
  DEFAULT_SETTINGS
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
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
        'To install this app on your device:\n\n' +
        '• Android (Chrome): Tap the menu (3 dots) in your browser and select "Install app" or "Add to Home screen".\n' +
        '• iPhone/iPad (Safari): Tap the Share button at the bottom and select "Add to Home Screen".\n' +
        '• Desktop (Chrome/Edge): Click the install icon in the right side of the address bar.'
      );
    }
  };

  // Admin PIN prompt state
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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

  // JSON Backup Export
  const handleExportJSON = async () => {
    try {
      const products = await getAllProducts();
      const categories = await getAllCategories();
      const transactions = await getAllTransactions();
      const customers = await getAllCustomers();

      // Convert image Blobs to Base64 for JSON serialization
      const serializedProducts = await Promise.all(
        products.map(async (p) => {
          let imageBase64: string | undefined = undefined;
          if (p.image instanceof Blob) {
            imageBase64 = await blobToBase64(p.image);
          } else if (typeof p.image === 'string') {
            imageBase64 = p.image;
          }
          return {
            ...p,
            image: imageBase64,
          };
        })
      );

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings,
        categories,
        products: serializedProducts,
        transactions,
        customers,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `mini-pos-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Export JSON error:', err);
      alert('Failed to export backup.');
    }
  };

  // JSON Restore Import
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    verifyPinAndExecute(() => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (!data.products && !data.categories) {
            throw new Error('Invalid backup file structure.');
          }

          // Clear and restore
          await clearAllData();

          if (data.settings) await saveSettings(data.settings);
          if (data.categories) {
            for (const cat of data.categories) await saveCategory(cat);
          }
          if (data.products) {
            for (const p of data.products) {
              let imageBlobObj: Blob | undefined = undefined;
              if (p.image && typeof p.image === 'string' && p.image.startsWith('data:')) {
                imageBlobObj = base64ToBlob(p.image);
              }
              await saveProduct({
                ...p,
                image: imageBlobObj,
              });
            }
          }
          if (data.transactions) {
            for (const tx of data.transactions) await saveTransaction(tx);
          }
          if (data.customers) {
            for (const cust of data.customers) await saveCustomer(cust);
          }

          alert('Data successfully restored from backup!');
          window.location.reload();
        } catch (err) {
          console.error('Restore error:', err);
          alert('Failed to restore backup file. Please check file format.');
        }
      };
      reader.readAsText(file);
    });
  };

  const handleClearAll = () => {
    verifyPinAndExecute(async () => {
      if (confirm('DANGER: This will delete all products, categories, transactions, and customers, and reset Admin PIN to 1234. Are you absolutely sure?')) {
        try {
          await clearAllData();
          await saveSettings({ ...DEFAULT_SETTINGS, adminPin: '1234' });
          alert('All database data has been cleared and Admin PIN reset to 1234.');
          window.location.reload();
        } catch (err) {
          console.error('Clear data error:', err);
          alert('Failed to clear database.');
        }
      }
    });
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

      {/* Backup & Restore Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <SettingsIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900 dark:text-white">Local Database Backup & Restore</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={handleExportJSON}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-center group"
          >
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3 text-blue-600 mb-3 group-hover:scale-110 transition">
              <Download className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">Export JSON Backup</span>
            <span className="text-xs text-slate-500 mt-1">Complete store backup with images</span>
          </button>

          <label className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-center cursor-pointer group">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-3 text-emerald-600 mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">Restore JSON Backup</span>
            <span className="text-xs text-slate-500 mt-1">Import database from file</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={handleInstallApp}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition text-center group"
          >
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/50 p-3 text-indigo-600 mb-3 group-hover:scale-110 transition">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400">Install App</span>
            <span className="text-xs text-slate-500 mt-1">Install as PWA on device</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-center group"
          >
            <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-3 text-red-600 mb-3 group-hover:scale-110 transition">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm text-red-600">Clear All Data</span>
            <span className="text-xs text-slate-500 mt-1">Reset POS database</span>
          </button>
        </div>
      </div>

      {/* Admin PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Shield className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin PIN Required</h3>
            </div>

            <form onSubmit={handlePinSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Please enter your Admin PIN to authorize this sensitive action (Default PIN is 1234).
              </p>
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
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
