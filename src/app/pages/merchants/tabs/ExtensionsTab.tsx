// ── Extensions Tab ───────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import {
  fetchMerchantExtensions,
  type ApiMerchant, type AdminExtension,
} from '../../../lib/merchants-api';
import { peso, shortDate, timeAgo } from '../helpers';

const EXTENSION_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending', APPROVED: 'active', REJECTED: 'rejected',
};

interface Props { merchant: ApiMerchant; canEdit: boolean }

export function ExtensionsTab({ merchant, canEdit }: Props) {
  const [extensions, setExtensions] = useState<AdminExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchMerchantExtensions(merchant.id, { status: statusFilter || undefined, page, limit: 20 })
      .then(res => { setExtensions(res.data); setTotal(res.pagination.total); })
      .catch(() => toast.error('Failed to load extensions'))
      .finally(() => setLoading(false));
  }, [merchant.id, statusFilter, page]);

  const statusOptions = ['PENDING', 'APPROVED', 'REJECTED'];

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <button onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${!statusFilter ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
          style={{ fontWeight: 500 }}>All</button>
        {statusOptions.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${statusFilter === s ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
            style={{ fontWeight: 500 }}>{s}</button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]"><Loader2 size={14} className="animate-spin" /><span className="text-[12px]">Loading extensions…</span></div>
      )}

      {!loading && extensions.length === 0 && (
        <div className="text-center py-8">
          <ArrowRightLeft size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No extension requests</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">No renters have requested booking extensions for this merchant.</p>
        </div>
      )}

      {!loading && extensions.length > 0 && (
        <div className="space-y-2">
          {extensions.map(ext => (
            <div key={ext.id} className="p-3 border border-[var(--border)] rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={EXTENSION_STATUS_MAP[ext.status] || 'pending'} size="sm" />
                  <span className="text-[12px] font-mono text-[var(--muted-foreground)]">#{ext.bookingNumber}</span>
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)]">{timeAgo(ext.createdAt)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Renter</p>
                  <p className="text-[12px] text-[var(--foreground)]">{ext.renterName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Template</p>
                  <p className="text-[12px] text-[var(--foreground)] truncate">{ext.templateName || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Extra Days</p>
                  <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>+{ext.extraDays} days</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Add. Cost</p>
                  <p className="text-[12px] text-[var(--foreground)]">{peso(ext.additionalCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Add. Commission</p>
                  <p className="text-[12px] text-[var(--foreground)]">{peso(ext.additionalCommission)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10px] text-[var(--muted-foreground)]">
                <span>Original end: {shortDate(ext.originalEndDate)}</span>
                <span>→ Requested: {shortDate(ext.requestedEndDate)}</span>
              </div>

              {ext.renterNotes && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>Renter Notes</p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">{ext.renterNotes}</p>
                </div>
              )}

              {ext.rejectionReason && (
                <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                  <p className="text-[10px] text-red-600 dark:text-red-400" style={{ fontWeight: 500 }}>Rejection Reason</p>
                  <p className="text-[11px] text-red-700 dark:text-red-300">{ext.rejectionReason}</p>
                </div>
              )}

              {ext.merchantNotes && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>Merchant Notes</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">{ext.merchantNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--muted-foreground)]">Showing {extensions.length} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={extensions.length < 20} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
