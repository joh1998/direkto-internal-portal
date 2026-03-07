// ── Promo Codes Tab ──────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Tag, Percent, DollarSign, Ban } from 'lucide-react';
import {
  fetchMerchantPromoCodes, adminDeactivatePromo,
  type ApiMerchant, type AdminPromoCode,
} from '../../../lib/merchants-api';
import { peso, shortDate } from '../helpers';

interface Props { merchant: ApiMerchant; canEdit: boolean }

export function PromosTab({ merchant, canEdit }: Props) {
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  function loadPromos() {
    setLoading(true);
    const activeParam = filter === 'active' ? true : filter === 'inactive' ? false : undefined;
    fetchMerchantPromoCodes(merchant.id, { active: activeParam, page, limit: 20 })
      .then(res => { setPromos(res.data); setTotal(res.pagination.total); })
      .catch(() => toast.error('Failed to load promo codes'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPromos(); }, [merchant.id, filter, page]);

  async function handleDeactivate(promoId: number, code: string) {
    if (!confirm(`Deactivate promo code "${code}"? It will no longer be usable.`)) return;
    try { await adminDeactivatePromo(merchant.id, promoId); toast.success(`Promo "${code}" deactivated`); loadPromos(); }
    catch { toast.error('Failed to deactivate promo'); }
  }

  const isExpired = (p: AdminPromoCode) => p.endDate && new Date(p.endDate) < new Date();
  const isMaxedOut = (p: AdminPromoCode) => p.maxUses !== null && p.currentUses >= p.maxUses;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors capitalize ${filter === f ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
            style={{ fontWeight: 500 }}>{f}</button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]"><Loader2 size={14} className="animate-spin" /><span className="text-[12px]">Loading promo codes…</span></div>
      )}

      {!loading && promos.length === 0 && (
        <div className="text-center py-8">
          <Tag size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No promo codes found</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">This merchant hasn't created any promo codes yet.</p>
        </div>
      )}

      {!loading && promos.length > 0 && (
        <div className="space-y-2">
          {promos.map(p => {
            const expired = isExpired(p);
            const maxed = isMaxedOut(p);
            return (
              <div key={p.id} className="p-3 border border-[var(--border)] rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-mono text-[var(--foreground)] tracking-wide" style={{ fontWeight: 600 }}>{p.code}</span>
                    {p.isActive && !expired && !maxed ? (
                      <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full" style={{ fontWeight: 600 }}>ACTIVE</span>
                    ) : expired ? (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full" style={{ fontWeight: 600 }}>EXPIRED</span>
                    ) : maxed ? (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full" style={{ fontWeight: 600 }}>MAXED</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full" style={{ fontWeight: 600 }}>INACTIVE</span>
                    )}
                  </div>
                  {canEdit && p.isActive && (
                    <button onClick={() => handleDeactivate(p.id, p.code)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Deactivate">
                      <Ban size={12} className="text-red-400" />
                    </button>
                  )}
                </div>

                {p.description && <p className="text-[11px] text-[var(--muted-foreground)]">{p.description}</p>}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Discount</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {p.discountType === 'PERCENTAGE' ? <><Percent size={10} className="inline mr-0.5" />{parseFloat(p.discountValue)}%</> : <><DollarSign size={10} className="inline mr-0.5" />{peso(p.discountValue)}</>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Uses</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{p.currentUses}{p.maxUses !== null ? ` / ${p.maxUses}` : ' (∞)'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Per User</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{p.maxUsesPerUser ?? '∞'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-[var(--muted-foreground)]">
                  {p.minBookingAmount && parseFloat(p.minBookingAmount) > 0 && <span>Min: {peso(p.minBookingAmount)}</span>}
                  {p.maxDiscountAmount && <span>Cap: {peso(p.maxDiscountAmount)}</span>}
                  {p.startDate && <span>From: {shortDate(p.startDate)}</span>}
                  {p.endDate && <span>Until: {shortDate(p.endDate)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--muted-foreground)]">Showing {promos.length} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={promos.length < 20} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
