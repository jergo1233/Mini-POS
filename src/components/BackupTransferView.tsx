import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Package,
  Layers,
  Receipt,
  Users,
  Clock,
  FileJson,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  Settings,
  getAllProducts,
  getAllCategories,
  getAllTransactions,
  getAllCustomers,
  clearAllData,
  getSettings,
  saveSettings,
  getAppState,
  saveAppState,
  removeAppState,
} from '../db/indexedDB';
import {
  exportFullBusinessBackupZip,
  exportProductsOnlyTransferZip,
  exportSalesTransferZip,
  inspectZipFile,
  executeFullRestore,
  executeProductsOnlyImport,
  executeSalesTransferImport,
  ZipInspection,
} from '../utils/zipTransfer';
import { verifyAdminPin } from '../utils/cryptoAuth';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface BackupTransferViewProps {
  settings: Settings;
  onRefresh: () => void;
  userRole: 'admin' | 'cashier';
}

export const BackupTransferView: React.FC<BackupTransferViewProps> = ({
  settings,
  onRefresh,
  userRole,
}) => {
  const [dbStats, setDbStats] = useState({
    products: 0,
    categories: 0,
    transactions: 0,
    customers: 0,
    loading: true,
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

  const { isInstallable, install, isInstalled } = usePWAInstall();

  const loadStats = async () => {
    try {
      const [prods, cats, txs, custs] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllTransactions(),
        getAllCustomers(),
      ]);
      setDbStats({
        products: prods.length,
        categories: cats.length,
        transactions: txs.length,
        customers: custs.length,
        loading: false,
      });
    } catch (e) {
      console.error('Failed to load DB stats:', e);
      setDbStats((prev) => ({ ...prev, loading: false }));
    }

    try {
      const savedDate = await getAppState<string>('last_backup_date');
      setLastBackupDate(savedDate || null);
    } catch (e) {
      console.debug('IndexedDB state note:', e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleExportFullZip = async () => {
    try {
      setExporting(true);
      await exportFullBusinessBackupZip();
      const now = new Date().toISOString();
      setLastBackupDate(now);
      await saveAppState('last_backup_date', now);
      setExportSuccessMessage('Full Business Backup (.zip) generated successfully!');
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Export ZIP error:', err);
      alert('Failed to export backup.');
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
      alert('Failed to export products.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSalesTransfer = async () => {
    try {
      setExporting(true);
      await exportSalesTransferZip();
      setExportSuccessMessage('Sales Transfer (.zip) generated successfully!');
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err) {
      console.error('Export Sales ZIP error:', err);
      alert('Failed to export sales transfer.');
    } finally {
      setExporting(false);
    }
  };

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
      alert('Failed to read ZIP file.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingZipInspection) return;

    const isMatch = await verifyAdminPin(importPin, settings);
    if (!isMatch) {
      setImportError('Incorrect Admin PIN. Verification failed.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);

      let result;
      if (pendingZipInspection.exportType === 'full_backup' || (pendingZipInspection.exportType as any) === 'legacy_json') {
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

  const handleExecuteClearAll = async () => {
    if (!clearUnderstood) {
      setClearError('Please confirm deletions.');
      return;
    }

    const isMatch = await verifyAdminPin(clearPin, settings);
    if (!isMatch) {
      setClearError('Incorrect Admin PIN.');
      return;
    }

    try {
      setClearing(true);
      const currentSettings = await getSettings();
      await clearAllData(true);
      await saveSettings({ ...currentSettings, isSetup: true });
      await removeAppState('last_backup_date');
      await loadStats();
      onRefresh();
      alert('SUCCESS: All business records cleared. Admin PIN preserved.');
      setShowClearWarningModal(false);
      window.location.reload();
    } catch (err) {
      console.error('Clear data error:', err);
      setClearError('Failed to clear database.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Backup & Data Transfer</h2>
        <p className="text-sm text-slate-500">Manage your offline POS records and move data between devices</p>
      </div>

      {exportSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900 animate-in slide-in-from-top duration-300">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium">{exportSuccessMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">IndexedDB Storage</h3>
              <p className="text-xs text-slate-500">Offline database records on this device</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            100% Offline
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Products</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              {dbStats.loading ? '...' : dbStats.products}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Categories</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              {dbStats.loading ? '...' : dbStats.categories}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Sales</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
              {dbStats.loading ? '...' : dbStats.transactions}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Customers</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-500" />
              {dbStats.loading ? '...' : dbStats.customers}
            </div>
          </div>
        </div>

        {/* Last Backup & Refresh */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last Backup: {lastBackupDate ? new Date(lastBackupDate).toLocaleString() : 'Never'}
            </span>
          </div>
          <button onClick={loadStats} className="hover:text-blue-600 flex items-center gap-1 transition-colors cursor-pointer">
            <RefreshCw className="w-3 h-3" /> Refresh Counts
          </button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Export Full ZIP (Both roles) */}
          <button
            onClick={handleExportFullZip}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-blue-100/70 dark:bg-blue-900/50 p-3.5 text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Download className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Complete ZIP Backup</span>
            <span className="text-[10px] text-slate-500 mt-1">All business records + Product Photos</span>
          </button>

          {/* Products Transfer */}
          <button
            onClick={handleExportProductsOnly}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-indigo-100/70 dark:bg-indigo-900/50 p-3.5 text-indigo-600 dark:text-indigo-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Products Transfer</span>
            <span className="text-[10px] text-slate-500 mt-1">Product list + Photos (Admin to Cashier)</span>
          </button>

          {/* Sales Transfer */}
          <button
            onClick={handleExportSalesTransfer}
            disabled={exporting}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition text-center group cursor-pointer"
          >
            <div className="rounded-xl bg-emerald-100/70 dark:bg-emerald-900/50 p-3.5 text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-110 transition shadow-2xs">
              <Receipt className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Sales & Records Transfer</span>
            <span className="text-[10px] text-slate-500 mt-1">Shift sales & movements (Cashier to Admin)</span>
          </button>

          {/* Restore Backup (Both roles) */}
          <label className="flex flex-col items-center justify-center p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition text-center cursor-pointer group shadow-2xs">
            <div className="rounded-xl bg-amber-100/70 dark:bg-amber-900/50 p-3.5 text-amber-600 dark:text-amber-400 mb-3 group-hover:scale-110 transition">
              <Upload className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Import ZIP / JSON</span>
            <span className="text-[10px] text-slate-500 mt-1">Products, Sales + Photos</span>
            <input
              type="file"
              accept=".zip,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {/* Install App */}
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-center group cursor-pointer"
            >
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400 mb-3 group-hover:scale-110 transition h-12 w-12 flex items-center justify-center overflow-hidden">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Install App</span>
              <span className="text-[10px] text-slate-500 mt-1">Add POS to Home Screen</span>
            </button>
          )}

          {/* Clear Data (Admin Only) */}
          {userRole === 'admin' && (
            <button
              onClick={() => setShowClearWarningModal(true)}
              className="flex flex-col items-center justify-center p-5 rounded-2xl border border-red-200 dark:border-red-900/50 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition text-center group cursor-pointer"
            >
              <div className="rounded-xl bg-red-100/70 dark:bg-red-900/50 p-3.5 text-red-600 dark:text-red-400 mb-3 group-hover:scale-110 transition">
                <Trash2 className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm text-red-600">Reset Records</span>
              <span className="text-[10px] text-slate-500 mt-1">Delete all local records</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && pendingZipInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                <FileJson className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Validate Import File</h3>
                <p className="text-xs text-slate-500 truncate max-w-[280px]">{importFileName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source Store:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                    {pendingZipInspection.storeName || 'Unknown Store'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Export Type:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                    {pendingZipInspection.exportType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Products:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {pendingZipInspection.counts.productsToAdd + pendingZipInspection.counts.productsToUpdate} items
                  </span>
                </div>
                {pendingZipInspection.counts.transactionsToAdd > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sales Records:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {pendingZipInspection.counts.transactionsToAdd} records
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                <p className="font-bold uppercase mb-1">Import Rules:</p>
                {pendingZipInspection.exportType === 'products_transfer' ? (
                  <p>• Updates product prices/names but <strong>PROTECTS</strong> your local stock levels.</p>
                ) : pendingZipInspection.exportType === 'sales_transfer' ? (
                  <p>• Merges sales and customers without duplicating existing records.</p>
                ) : (
                  <p>• <strong>FULL RESTORE:</strong> Replaces entire database. Admin PIN will be preserved.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Enter Admin PIN to Authorize:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={importPin}
                  onChange={(e) => setImportPin(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono tracking-widest shadow-inner"
                />
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || !importPin}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Warning Modal */}
      {showClearWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-red-200 dark:border-red-900/60">
            <div className="flex items-center gap-3 pb-4 border-b border-red-100 dark:border-red-950/60 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-red-600">Delete All Business Records?</h3>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                This will permanently delete all products, sales history, customer records, and inventory data from this device.
              </p>
              <p className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/40">
                ✓ Your Admin PIN and security settings will be safely preserved.
              </p>

              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearUnderstood}
                    onChange={(e) => setClearUnderstood(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    I understand that these records cannot be recovered once deleted.
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm with Admin PIN:
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={clearPin}
                    onChange={(e) => setClearPin(e.target.value)}
                    placeholder="••••"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-base font-mono tracking-widest dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {clearError && (
                  <p className="text-red-500 font-bold text-[10px]">{clearError}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearWarningModal(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteClearAll}
                    disabled={clearing || !clearUnderstood || !clearPin}
                    className="flex-1 rounded-xl bg-red-600 py-3 text-xs font-bold text-white shadow-lg shadow-red-600/20 disabled:opacity-40"
                  >
                    Delete Records
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
