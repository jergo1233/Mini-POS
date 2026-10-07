import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Trash2,
  Edit,
  Sparkles,
  PhoneCall,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';
import {
  Cashier,
  CashierResetRequest,
  Transaction,
  Settings,
  saveCashier,
  deleteCashier,
  saveResetRequest,
  resolveResetRequest
} from '../db/indexedDB';

interface CashierManagementViewProps {
  cashiers: Cashier[];
  resetRequests: CashierResetRequest[];
  transactions?: Transaction[];
  settings?: Settings;
  onRefresh: () => void;
  isOnline: boolean;
  onTriggerSync?: () => Promise<boolean>;
}

export const CashierManagementView: React.FC<CashierManagementViewProps> = ({
  cashiers,
  resetRequests,
  transactions = [],
  settings,
  onRefresh,
  isOnline,
  onTriggerSync,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCashierName, setNewCashierName] = useState('');
  const [newCashierPin, setNewCashierPin] = useState('');
  const [editingCashier, setEditingCashier] = useState<Cashier | null>(null);
  const [editPin, setEditPin] = useState('');

  // Resolving Request Modal
  const [selectedRequest, setSelectedRequest] = useState<CashierResetRequest | null>(null);
  const [resolvedTempPin, setResolvedTempPin] = useState('');
  const [resolvedSuccessBanner, setResolvedSuccessBanner] = useState<{
    cashierName: string;
    pin: string;
  } | null>(null);

  const pendingRequests = resetRequests.filter((r) => r.status === 'pending');

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCashierName.trim() || !newCashierPin.trim()) return;

    const newCashier: Cashier = {
      id: `cashier-${Date.now()}`,
      name: newCashierName.trim(),
      pin: newCashierPin.trim(),
      role: 'cashier',
      active: true,
      storeId: settings?.storeId || 'store-main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveCashier(newCashier);
      if (isOnline && onTriggerSync) {
        onTriggerSync().catch(() => {});
      }
      setNewCashierName('');
      setNewCashierPin('');
      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create cashier:', err);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCashier || !editPin.trim()) return;

    const updated: Cashier = {
      ...editingCashier,
      pin: editPin.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveCashier(updated);
      if (isOnline && onTriggerSync) {
        onTriggerSync().catch(() => {});
      }
      setEditingCashier(null);
      setEditPin('');
      onRefresh();
    } catch (err) {
      console.error('Failed to update PIN:', err);
    }
  };

  const handleToggleActive = async (cashier: Cashier) => {
    const updated: Cashier = {
      ...cashier,
      active: !cashier.active,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveCashier(updated);
      if (isOnline && onTriggerSync) {
        onTriggerSync().catch(() => {});
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (cashiers.length <= 1) {
      alert('You must have at least one cashier account.');
      return;
    }
    if (confirm('Are you sure you want to delete this cashier account?')) {
      await deleteCashier(id);
      if (isOnline && onTriggerSync) {
        onTriggerSync().catch(() => {});
      }
      onRefresh();
    }
  };

  const generateRandomPin = () => {
    const rand = Math.floor(1000 + Math.random() * 9000).toString();
    setResolvedTempPin(rand);
  };

  const handleConfirmResolveRequest = async () => {
    if (!selectedRequest || !resolvedTempPin.trim()) return;

    try {
      // If server is online, hit server endpoint /api/admin/resolve-reset
      if (isOnline) {
        try {
          await fetch('/api/admin/resolve-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestId: selectedRequest.id,
              cashierId: selectedRequest.cashierId,
              newPin: resolvedTempPin.trim(),
            }),
          });
        } catch (netErr) {
          console.warn('Network resolve request failed, falling back to local DB:', netErr);
        }
      }

      await resolveResetRequest(selectedRequest.id, resolvedTempPin.trim());

      setResolvedSuccessBanner({
        cashierName: selectedRequest.cashierName,
        pin: resolvedTempPin.trim(),
      });
      setSelectedRequest(null);
      setResolvedTempPin('');
      onRefresh();
      if (onTriggerSync) onTriggerSync().catch(() => {});
    } catch (err) {
      console.error('Failed resolving request:', err);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            <span>Cashier Management & Access</span>
          </h2>
          <p className="text-sm text-slate-500">
            Control cashier accounts, role permissions, and resolve PIN reset requests
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Cashier</span>
        </button>
      </div>

      {/* Success Notification Banner when Temporary PIN is generated */}
      {resolvedSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Temporary PIN Generated Successfully!</span>
            </div>
            <p className="text-xs">
              Temporary PIN for <strong>{resolvedSuccessBanner.cashierName}</strong> is:{' '}
              <span className="font-mono text-base font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700 mx-1">
                {resolvedSuccessBanner.pin}
              </span>
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 pt-1">
              <PhoneCall className="w-3.5 h-3.5" />
              Please convey this PIN to the cashier via external channels (Phone Call, SMS, or Messenger).
            </p>
          </div>
          <button
            onClick={() => setResolvedSuccessBanner(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Access & PIN Reset Requests Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Access & PIN Reset Requests</span>
                {pendingRequests.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold animate-pulse">
                    🔴 {pendingRequests.length} Pending
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-medium">
                    All caught up
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Requests submitted by cashiers who forgot their credentials
              </p>
            </div>
          </div>
        </div>

        {resetRequests.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No PIN reset requests submitted.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {resetRequests.map((req) => (
              <div
                key={req.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {req.cashierName}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        req.status === 'pending'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.temporaryPin && (
                      <span className="text-xs text-slate-500 font-mono">
                        (Temp PIN: {req.temporaryPin})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{req.notes || 'PIN Reset Requested'}</p>
                  <p className="text-[11px] text-slate-400">
                    Requested on: {new Date(req.requestedAt).toLocaleString()}
                    {req.resolvedAt && ` • Resolved: ${new Date(req.resolvedAt).toLocaleString()}`}
                  </p>
                </div>

                {req.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(req);
                      generateRandomPin();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Verify & Generate PIN</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cashiers List Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Authorized Cashier Accounts ({cashiers.length})
          </h3>
          <span className="text-xs text-slate-500">
            Cashiers can operate POS offline and sell items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-3.5">Cashier Name</th>
                <th className="px-6 py-3.5">Security PIN</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Sales Rating & Performance</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cashiers.map((cashier) => {
                // Compute cashier stats
                const cashierTxs = transactions.filter(t => t.cashier === cashier.name);
                const totalSales = cashierTxs.reduce((sum, t) => sum + t.total, 0);
                const orderCount = cashierTxs.length;
                const stars = orderCount >= 20 ? '⭐⭐⭐⭐⭐' : orderCount >= 10 ? '⭐⭐⭐⭐' : orderCount >= 5 ? '⭐⭐⭐' : orderCount >= 1 ? '⭐⭐' : '⭐';

                return (
                  <tr key={cashier.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {cashier.name}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      •••• <span className="text-[10px] text-slate-400">({cashier.pin.length} digits)</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cashier.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cashier.active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {cashier.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-500">{stars}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ({settings?.currency || '₱'}{totalSales.toFixed(2)})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {orderCount} total orders processed
                      </div>
                    </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCashier(cashier);
                        setEditPin(cashier.pin);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                      title="Edit PIN"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(cashier)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
                      title={cashier.active ? 'Disable Account' : 'Enable Account'}
                    >
                      {cashier.active ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cashier.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                      title="Delete Cashier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cashier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span>Add Cashier Profile</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCashier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cashier Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cashier Name"
                  value={newCashierName}
                  onChange={(e) => setNewCashierName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4-Digit Access PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 4-digit PIN"
                  value={newCashierPin}
                  onChange={(e) => setNewCashierPin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Cashier will enter this PIN at login to access the terminal.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 shadow-md"
                >
                  Save Cashier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit PIN Modal */}
      {editingCashier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Change PIN for {editingCashier.name}
            </h3>
            <form onSubmit={handleUpdatePin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  New Security PIN
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCashier(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Request Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  Reset Cashier PIN
                </h3>
                <p className="text-xs text-slate-500">
                  Cashier: <strong>{selectedRequest.cashierName}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign New / Temporary PIN
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resolvedTempPin}
                    onChange={(e) => setResolvedTempPin(e.target.value)}
                    placeholder="Enter or generate PIN"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-base font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={generateRandomPin}
                    className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Random</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <span className="font-bold block">Important:</span>
                This only resets the cashier authentication PIN. Products, stock movements, and sales history remain completely preserved and untouched.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolveRequest}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md"
                >
                  Approve & Set PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
