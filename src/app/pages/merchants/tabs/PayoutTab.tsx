// ── Payout Tab (with inline edit) ────────────────────────────
import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Save, X, Loader2, Lock } from 'lucide-react';
import {
  updateMerchant,
  type ApiMerchant, type UpdateMerchantPayload,
} from '../../../lib/merchants-api';
import { peso } from '../helpers';

interface Props {
  merchant: ApiMerchant;
  canEditPayout: boolean;
  onUpdate: (m: ApiMerchant) => void;
}

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>
      <Lock size={8} /> {label}
    </span>
  );
}

export function PayoutTab({ merchant: m, canEditPayout, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [saving, setSaving] = useState(false);

  function enterEdit() {
    setBankName(m.bankName || '');
    setAccountNumber(m.accountNumber || '');
    setAccountName(m.accountName || '');
    setGcashNumber(m.gcashNumber || '');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: UpdateMerchantPayload = {};
      if (bankName !== (m.bankName || '')) payload.bankName = bankName;
      if (accountNumber !== (m.accountNumber || '')) payload.accountNumber = accountNumber;
      if (accountName) payload.accountName = accountName;
      if (gcashNumber !== (m.gcashNumber || '')) payload.gcashNumber = gcashNumber;
      if (Object.keys(payload).length === 0) {
        toast.info('No changes to save');
        setEditing(false);
        setSaving(false);
        return;
      }
      const updated = await updateMerchant(m.id, payload);
      onUpdate(updated);
      setEditing(false);
      toast.success('Payout details updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payout');
    } finally {
      setSaving(false);
    }
  }

  const hasBankInfo = m.bankName || m.accountNumber;
  const hasGcash = m.gcashNumber;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Payout Details</p>
        {canEditPayout && !editing && (
          <button onClick={enterEdit} className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
            <Pencil size={11} /> Edit
          </button>
        )}
        {!canEditPayout && <RoleBadge label="View only" />}
      </div>

      {editing ? (
        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-300 dark:border-blue-800">
          <p className="text-[12px] text-blue-700 dark:text-blue-300" style={{ fontWeight: 600 }}>Edit Bank & GCash Details</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. BDO, BPI, UnionBank"
                className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]" />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Account Number</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Bank account number"
                className="w-full px-3 py-2 text-[13px] font-mono bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]" />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Account Name</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account holder name"
                className="w-full px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]" />
            </div>
            <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>GCash Number</label>
              <input type="text" value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} placeholder="09XX XXX XXXX"
                className="w-full px-3 py-2 text-[13px] font-mono bg-white dark:bg-[var(--card)] border border-blue-300 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-400/40 text-[var(--foreground)]" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors" style={{ fontWeight: 500 }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)] transition-colors" style={{ fontWeight: 500 }}>
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>Bank Details</p>
            {hasBankInfo ? (
              <div className="p-4 bg-[var(--accent)]/50 rounded-lg space-y-3">
                {[
                  { label: 'Bank Name', value: m.bankName },
                  { label: 'Account Number', value: m.accountNumber },
                  { label: 'Account Name', value: m.accountName },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{item.label}</p>
                    <p className="text-[13px] text-[var(--foreground)] font-mono">{item.value || 'N/A'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>No bank details provided</p>
                <p className="text-[11px] text-amber-500 mt-0.5">Merchant has not submitted bank account information for payouts.</p>
              </div>
            )}
          </div>
          <div>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>GCash</p>
            {hasGcash ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>GCash Number</p>
                <p className="text-[14px] text-blue-700 dark:text-blue-300 font-mono" style={{ fontWeight: 600 }}>{m.gcashNumber}</p>
              </div>
            ) : (
              <div className="p-4 bg-[var(--accent)]/50 rounded-lg">
                <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>No GCash number on file</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payout summary */}
      <div>
        <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>Payout Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400" style={{ fontWeight: 500 }}>Total Revenue</p>
            <p className="text-[16px] mt-1 text-emerald-700 dark:text-emerald-300" style={{ fontWeight: 600 }}>{peso(m.totalRevenue)}</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
            <p className="text-[11px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>Pending Payout</p>
            <p className="text-[16px] mt-1 text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>{peso(m.pendingPayout)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
