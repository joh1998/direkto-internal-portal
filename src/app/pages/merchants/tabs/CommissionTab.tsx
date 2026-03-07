// ── Commission Tab (with inline edit) ────────────────────────
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Pencil, Save, X, Loader2, Percent, DollarSign,
  CreditCard, FileSignature, ExternalLink, Star, Lock,
} from 'lucide-react';
import {
  fetchMerchantById,
  removeMerchantCommissionOverride,
  setMerchantCommissionOverride,
  updateMerchant,
  type ApiMerchant,
} from '../../../lib/merchants-api';
import { formatDate, peso } from '../helpers';

interface Props {
  merchant: ApiMerchant;
  canEditCommission: boolean;
  onUpdate: (m: ApiMerchant) => void;
}

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>
      <Lock size={8} /> {label}
    </span>
  );
}

export function CommissionTab({ merchant: m, canEditCommission, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [overrideVal, setOverrideVal] = useState('');
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  function enterEdit() {
    setOverrideVal(m.commissionRateOverride ? String(parseFloat(m.commissionRateOverride)) : '');
    setFeatured(m.isFeatured);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const v = overrideVal.trim();
      const nextOverride = v === '' ? null : parseFloat(v);
      if (typeof nextOverride === 'number' && (isNaN(nextOverride) || nextOverride < 0 || nextOverride > 100)) {
        toast.error('Commission override must be between 0 and 100');
        setSaving(false);
        return;
      }
      const currentOverride = m.commissionRateOverride === null ? null : parseFloat(m.commissionRateOverride);
      const overrideChanged = nextOverride !== currentOverride;
      const featuredChanged = featured !== m.isFeatured;

      if (!overrideChanged && !featuredChanged) {
        setEditing(false);
        toast('No changes to save');
        setSaving(false);
        return;
      }

      if (overrideChanged) {
        if (nextOverride === null) {
          await removeMerchantCommissionOverride(m.id);
        } else {
          await setMerchantCommissionOverride(
            m.id,
            nextOverride,
            'Manual override from admin portal',
          );
        }
      }

      if (featuredChanged) {
        await updateMerchant(m.id, { isFeatured: featured });
      }

      const updated = await fetchMerchantById(m.id);
      onUpdate(updated);
      setEditing(false);
      toast.success('Commission settings updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update commission');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Commission & Pricing</p>
        {canEditCommission && !editing && (
          <button onClick={enterEdit} className="flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
            <Pencil size={11} /> Edit
          </button>
        )}
        {!canEditCommission && <RoleBadge label="View only" />}
      </div>

      {/* Contracted Rate */}
      <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <Percent size={12} className="text-[var(--muted-foreground)]" />
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contracted Rate</p>
        </div>
        <p className="text-[20px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{parseFloat(m.contractedCommissionRate) || 0}%</p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Set during merchant approval</p>
      </div>

      {/* Contract Info */}
      <div className="p-3 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature size={12} className="text-[var(--muted-foreground)]" />
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contract Details</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Signed Date</p>
            <p className="text-[12px] text-[var(--foreground)]">{m.contractSignedDate ? formatDate(m.contractSignedDate) : 'Not signed'}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Contract Document</p>
            {m.contractDocumentUrl ? (
              <a href={m.contractDocumentUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
                <ExternalLink size={10} /> View Contract
              </a>
            ) : (
              <p className="text-[12px] text-[var(--foreground)]">No document</p>
            )}
          </div>
        </div>
      </div>

      {/* Override — editing */}
      {editing ? (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border-2 border-amber-300 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={12} className="text-amber-600 dark:text-amber-400" />
            <p className="text-[12px] text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>Commission Override</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" step="0.5" value={overrideVal} onChange={(e) => setOverrideVal(e.target.value)}
              placeholder="Leave empty to remove override"
              className="flex-1 px-3 py-2 text-[13px] bg-white dark:bg-[var(--card)] border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-400/40 text-[var(--foreground)]" />
            <span className="text-[14px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>%</span>
          </div>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-1.5">Set a custom rate for this merchant. Leave empty to use the contracted rate.</p>
          {/* Featured toggle */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
            <button onClick={() => setFeatured(!featured)}
              className={`relative w-9 h-5 rounded-full transition-colors ${featured ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${featured ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
              Featured Merchant {featured && <Star size={10} className="inline text-amber-500 fill-amber-500 ml-0.5" />}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors" style={{ fontWeight: 500 }}>
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
          {m.commissionRateOverride ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={12} className="text-amber-600 dark:text-amber-400" />
                <p className="text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>Override Rate (Active)</p>
              </div>
              <p className="text-[20px] text-amber-700 dark:text-amber-300" style={{ fontWeight: 600 }}>{parseFloat(m.commissionRateOverride)}%</p>
              <p className="text-[10px] text-amber-500 mt-0.5">This overrides the contracted rate of {parseFloat(m.contractedCommissionRate)}%</p>
            </div>
          ) : (
            <div className="p-3 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
              <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>No Commission Override</p>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Using contracted rate</p>
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/50 rounded-lg">
            <Star size={14} className={m.isFeatured ? 'text-amber-500 fill-amber-500' : 'text-[var(--muted-foreground)]'} />
            <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.isFeatured ? 'Featured Merchant' : 'Not Featured'}</span>
          </div>
        </>
      )}

      {/* Pending Payout */}
      <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={12} className="text-[var(--muted-foreground)]" />
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pending Payout</p>
        </div>
        <p className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{peso(m.pendingPayout)}</p>
      </div>

      {m.launchBonusEndDate && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
          <p className="text-[12px] text-blue-600 dark:text-blue-400 mb-1" style={{ fontWeight: 500 }}>Launch Bonus Until</p>
          <p className="text-[13px] text-blue-700 dark:text-blue-300">{formatDate(m.launchBonusEndDate)}</p>
          <p className="text-[11px] text-blue-500 mt-1">0% commission during the launch bonus period</p>
        </div>
      )}

      {/* Inventory overview */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
          <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Total Items</p>
          <p className="text-[16px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.totalItems}</p>
        </div>
        <div className="p-3 bg-[var(--accent)]/50 rounded-lg">
          <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Active Items</p>
          <p className="text-[16px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{m.activeItems}</p>
        </div>
      </div>
    </div>
  );
}
