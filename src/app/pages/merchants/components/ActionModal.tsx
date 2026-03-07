// ── Action Modal (approve / reject / suspend / reactivate) ───
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  reviewMerchant, toggleMerchantStatus,
  type ApiMerchant,
} from '../../../lib/merchants-api';

export type ActionType = 'approve' | 'reject' | 'suspend' | 'reactivate';

interface ActionModalProps {
  type: ActionType;
  merchant: ApiMerchant;
  onClose: () => void;
  onComplete: () => void;
}

const ACTION_CONFIG: Record<ActionType, {
  title: string;
  messageFn: (name: string) => string;
  confirmLabel: string;
  variant: 'danger' | 'default';
}> = {
  approve: {
    title: 'Approve Merchant',
    messageFn: (n) => `Approve ${n}? This will create a POI and allow them to receive orders immediately.`,
    confirmLabel: 'Approve',
    variant: 'default',
  },
  reject: {
    title: 'Reject Application',
    messageFn: (n) => `Reject ${n}? Provide a reason below so the merchant knows why.`,
    confirmLabel: 'Reject',
    variant: 'danger',
  },
  suspend: {
    title: 'Suspend Merchant',
    messageFn: (n) => `Suspend ${n}? They will not be able to receive orders. Their POI will also be deactivated.`,
    confirmLabel: 'Suspend',
    variant: 'danger',
  },
  reactivate: {
    title: 'Reactivate Merchant',
    messageFn: (n) => `Reactivate ${n}? They will start receiving orders again.`,
    confirmLabel: 'Reactivate',
    variant: 'default',
  },
};

const PLACEHOLDER: Record<ActionType, string> = {
  approve: 'e.g. Documents verified, all requirements met',
  reject: 'e.g. Missing business permit, incomplete registration',
  suspend: 'e.g. Multiple customer complaints, policy violation',
  reactivate: 'e.g. Issue resolved, merchant reinstated',
};

export function ActionModal({ type, merchant, onClose, onComplete }: ActionModalProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const cfg = ACTION_CONFIG[type];

  async function execute() {
    if (!notes.trim()) { toast.error('Please provide notes/reason'); return; }
    setLoading(true);
    try {
      if (type === 'approve') await reviewMerchant(merchant.id, 'APPROVED', notes);
      else if (type === 'reject') await reviewMerchant(merchant.id, 'REJECTED', notes);
      else if (type === 'suspend') await toggleMerchantStatus(merchant.id, 'SUSPENDED', notes);
      else if (type === 'reactivate') await toggleMerchantStatus(merchant.id, 'ACTIVE', notes);

      const labels = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reactivate: 'reactivated' };
      toast.success(`${merchant.businessName} has been ${labels[type]}`);
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              cfg.variant === 'danger' ? 'bg-red-50 dark:bg-red-950' : 'bg-emerald-50 dark:bg-emerald-950'
            }`}>
              {cfg.variant === 'danger'
                ? <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                : <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />}
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{cfg.title}</h3>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">{merchant.publicId}</p>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-2" style={{ lineHeight: 1.6 }}>
                {cfg.messageFn(merchant.businessName)}
              </p>
              <div className="mt-4">
                <label htmlFor="action-notes" className="block text-[12px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                  {type === 'approve' ? 'Approval Notes' : 'Reason / Notes'} *
                </label>
                <textarea
                  id="action-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={PLACEHOLDER[type]}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] resize-none"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]" style={{ fontWeight: 500 }}>Cancel</button>
          <button
            onClick={execute}
            disabled={loading || !notes.trim()}
            className={`px-4 py-2 text-[13px] rounded-lg text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
              cfg.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            style={{ fontWeight: 500 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Processing...' : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
