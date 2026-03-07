// ── Extended Merchant Drawer Tabs: Bookings, Promos, Extensions, Damage ──
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Calendar, Hash, Tag, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Shield, CheckCircle, XCircle, Percent, DollarSign,
  ArrowRightLeft, Wrench, Eye, Ban,
} from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import {
  fetchMerchantBookings, fetchMerchantPromoCodes,
  fetchMerchantExtensions, fetchMerchantDamageReports,
  adminDeactivatePromo, adminResolveDamageReport,
  type ApiMerchant, type AdminBooking, type AdminPromoCode,
  type AdminExtension, type AdminDamageReport,
} from '../lib/merchants-api';

/* ── Helpers ──────────────────────────────────────────────────── */
function peso(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!n || n === 0) return '₱0';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const BOOKING_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  CONFIRMED: 'active',
  IN_PROGRESS: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'rejected',
  EXPIRED: 'suspended',
  OVERDUE: 'danger',
};

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  MODERATE: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  SEVERE: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const EXTENSION_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'active',
  REJECTED: 'rejected',
};

const DAMAGE_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'active',
  DISPUTED: 'suspended',
  RESOLVED: 'completed',
};

/* ══════════════════════════════════════════════════════════════
   1. BOOKINGS TAB
   ══════════════════════════════════════════════════════════════ */
export function BookingsTab({ merchant, canEdit }: { merchant: ApiMerchant; canEdit: boolean }) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMerchantBookings(merchant.id, { status: statusFilter || undefined, page, limit: 10 })
      .then(res => {
        setBookings(res.data);
        setStatusSummary(res.statusSummary);
        setTotal(res.pagination.total);
      })
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [merchant.id, statusFilter, page]);

  const totalBookings = Object.values(statusSummary).reduce((a, b) => a + b, 0);
  const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
            !statusFilter
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
          }`}
          style={{ fontWeight: 500 }}
        >
          All ({totalBookings})
        </button>
        {statuses.map(s => {
          const count = statusSummary[s] || 0;
          if (count === 0 && s !== statusFilter) return null;
          return (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
              }`}
              style={{ fontWeight: 500 }}
            >
              {s.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading bookings…</span>
        </div>
      )}

      {/* Empty */}
      {!loading && bookings.length === 0 && (
        <div className="text-center py-8">
          <Calendar size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No bookings found</p>
        </div>
      )}

      {/* Bookings list */}
      {!loading && bookings.length > 0 && (
        <div className="space-y-2">
          {bookings.map(b => (
            <div key={b.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[var(--accent)]/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="shrink-0">
                    <StatusBadge status={BOOKING_STATUS_MAP[b.status] || 'pending'} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)] mr-1.5">#{b.bookingNumber}</span>
                      {b.templateName || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                      {b.renterName || 'Unknown'} · {b.unitName || b.unitNumber || '—'} · {shortDate(b.startDate)} → {shortDate(b.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-mono text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {peso(b.totalAmount)}
                  </span>
                  {expanded === b.id ? <ChevronUp size={14} className="text-[var(--muted-foreground)]" /> : <ChevronDown size={14} className="text-[var(--muted-foreground)]" />}
                </div>
              </button>

              {/* Expanded details */}
              {expanded === b.id && (
                <div className="px-3 py-3 border-t border-[var(--border)] bg-[var(--accent)]/30 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Daily Rate', value: peso(b.dailyRate) },
                      { label: 'Days', value: String(b.totalDays) },
                      { label: 'Subtotal', value: peso(b.subtotal) },
                      { label: 'Deposit', value: `${peso(b.depositAmount)} (${b.depositStatus})` },
                      { label: 'Commission', value: peso(b.commissionAmount) },
                      { label: 'Merchant Earnings', value: peso(b.merchantEarnings) },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{item.label}</p>
                        <p className="text-[12px] text-[var(--foreground)]">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {(parseFloat(b.promoDiscount) > 0 || parseFloat(b.lateFee) > 0 || parseFloat(b.damageCharge) > 0) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {parseFloat(b.promoDiscount) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full" style={{ fontWeight: 500 }}>
                          Promo: -{peso(b.promoDiscount)}
                        </span>
                      )}
                      {parseFloat(b.lateFee) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full" style={{ fontWeight: 500 }}>
                          Late Fee: +{peso(b.lateFee)}
                        </span>
                      )}
                      {parseFloat(b.damageCharge) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full" style={{ fontWeight: 500 }}>
                          Damage: +{peso(b.damageCharge)}
                        </span>
                      )}
                    </div>
                  )}
                  {b.cancellationReason && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-[10px] text-red-600 dark:text-red-400" style={{ fontWeight: 500 }}>Cancellation Reason</p>
                      <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">{b.cancellationReason}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Payment: {b.paymentStatus} · Created {timeAgo(b.createdAt)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 10 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Showing {bookings.length} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={bookings.length < 10}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   2. PROMO CODES TAB
   ══════════════════════════════════════════════════════════════ */
export function PromoCodesTab({ merchant, canEdit }: { merchant: ApiMerchant; canEdit: boolean }) {
  const [promos, setPromos] = useState<AdminPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  function loadPromos() {
    setLoading(true);
    const activeParam = filter === 'active' ? true : filter === 'inactive' ? false : undefined;
    fetchMerchantPromoCodes(merchant.id, { active: activeParam, page, limit: 20 })
      .then(res => {
        setPromos(res.data);
        setTotal(res.pagination.total);
      })
      .catch(() => toast.error('Failed to load promo codes'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPromos(); }, [merchant.id, filter, page]);

  async function handleDeactivate(promoId: number, code: string) {
    if (!confirm(`Deactivate promo code "${code}"? It will no longer be usable.`)) return;
    try {
      await adminDeactivatePromo(merchant.id, promoId);
      toast.success(`Promo "${code}" deactivated`);
      loadPromos();
    } catch {
      toast.error('Failed to deactivate promo');
    }
  }

  function isExpired(promo: AdminPromoCode) {
    return promo.endDate && new Date(promo.endDate) < new Date();
  }

  function isMaxedOut(promo: AdminPromoCode) {
    return promo.maxUses !== null && promo.currentUses >= promo.maxUses;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors capitalize ${
              filter === f
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
            style={{ fontWeight: 500 }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading promo codes…</span>
        </div>
      )}

      {!loading && promos.length === 0 && (
        <div className="text-center py-8">
          <Tag size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No promo codes found</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            This merchant hasn't created any promo codes yet.
          </p>
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
                    <span className="text-[13px] font-mono text-[var(--foreground)] tracking-wide" style={{ fontWeight: 600 }}>
                      {p.code}
                    </span>
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
                    <button
                      onClick={() => handleDeactivate(p.id, p.code)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      title="Deactivate"
                    >
                      <Ban size={12} className="text-red-400" />
                    </button>
                  )}
                </div>

                {p.description && (
                  <p className="text-[11px] text-[var(--muted-foreground)]">{p.description}</p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Discount</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {p.discountType === 'PERCENTAGE'
                        ? <><Percent size={10} className="inline mr-0.5" />{parseFloat(p.discountValue)}%</>
                        : <><DollarSign size={10} className="inline mr-0.5" />{peso(p.discountValue)}</>
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Uses</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {p.currentUses}{p.maxUses !== null ? ` / ${p.maxUses}` : ' (∞)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Per User</p>
                    <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {p.maxUsesPerUser ?? '∞'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-[var(--muted-foreground)]">
                  {p.minBookingAmount && parseFloat(p.minBookingAmount) > 0 && (
                    <span>Min: {peso(p.minBookingAmount)}</span>
                  )}
                  {p.maxDiscountAmount && (
                    <span>Cap: {peso(p.maxDiscountAmount)}</span>
                  )}
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
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Showing {promos.length} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={promos.length < 20}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   3. EXTENSIONS TAB
   ══════════════════════════════════════════════════════════════ */
export function ExtensionsTab({ merchant, canEdit }: { merchant: ApiMerchant; canEdit: boolean }) {
  const [extensions, setExtensions] = useState<AdminExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchMerchantExtensions(merchant.id, { status: statusFilter || undefined, page, limit: 20 })
      .then(res => {
        setExtensions(res.data);
        setTotal(res.pagination.total);
      })
      .catch(() => toast.error('Failed to load extensions'))
      .finally(() => setLoading(false));
  }, [merchant.id, statusFilter, page]);

  const statusOptions = ['PENDING', 'APPROVED', 'REJECTED'];

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
            !statusFilter
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
          }`}
          style={{ fontWeight: 500 }}
        >
          All
        </button>
        {statusOptions.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
            style={{ fontWeight: 500 }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading extensions…</span>
        </div>
      )}

      {!loading && extensions.length === 0 && (
        <div className="text-center py-8">
          <ArrowRightLeft size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No extension requests</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            No renters have requested booking extensions for this merchant.
          </p>
        </div>
      )}

      {!loading && extensions.length > 0 && (
        <div className="space-y-2">
          {extensions.map(ext => (
            <div key={ext.id} className="p-3 border border-[var(--border)] rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={EXTENSION_STATUS_MAP[ext.status] || 'pending'} size="sm" />
                  <span className="text-[12px] font-mono text-[var(--muted-foreground)]">
                    #{ext.bookingNumber}
                  </span>
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
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Showing {extensions.length} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={extensions.length < 20}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   4. DAMAGE REPORTS TAB
   ══════════════════════════════════════════════════════════════ */
export function DamageReportsTab({ merchant, canEdit }: { merchant: ApiMerchant; canEdit: boolean }) {
  const [reports, setReports] = useState<AdminDamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Resolve modal state
  const [resolveTarget, setResolveTarget] = useState<AdminDamageReport | null>(null);
  const [resolveResolution, setResolveResolution] = useState('CHARGE_FULL');
  const [resolveAmount, setResolveAmount] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveSaving, setResolveSaving] = useState(false);

  function loadReports() {
    setLoading(true);
    fetchMerchantDamageReports(merchant.id, { status: statusFilter || undefined, page, limit: 20 })
      .then(res => {
        setReports(res.data);
        setTotal(res.pagination.total);
      })
      .catch(() => toast.error('Failed to load damage reports'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReports(); }, [merchant.id, statusFilter, page]);

  async function handleResolve() {
    if (!resolveTarget) return;
    const amount = parseFloat(resolveAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!resolveNotes.trim()) {
      toast.error('Please add resolution notes');
      return;
    }
    setResolveSaving(true);
    try {
      await adminResolveDamageReport(resolveTarget.id, resolveResolution, amount, resolveNotes.trim());
      toast.success(`Damage report #${resolveTarget.id} resolved`);
      setResolveTarget(null);
      loadReports();
    } catch {
      toast.error('Failed to resolve damage report');
    } finally {
      setResolveSaving(false);
    }
  }

  const statuses = ['PENDING', 'ACKNOWLEDGED', 'DISPUTED', 'RESOLVED'];

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
            !statusFilter
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
          }`}
          style={{ fontWeight: 500 }}
        >
          All
        </button>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
            style={{ fontWeight: 500 }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading damage reports…</span>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="text-center py-8">
          <Shield size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No damage reports</p>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            No damage has been reported for this merchant's units.
          </p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="p-3 border border-[var(--border)] rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={DAMAGE_STATUS_MAP[r.status] || 'pending'} size="sm" />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[r.severity] || ''}`} style={{ fontWeight: 600 }}>
                    {r.severity}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                    #{r.bookingNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && r.status !== 'RESOLVED' && (
                    <button
                      onClick={() => {
                        setResolveTarget(r);
                        setResolveResolution('CHARGE_FULL');
                        setResolveAmount(r.estimatedRepairCost);
                        setResolveNotes('');
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      <Wrench size={10} /> Resolve
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[12px] text-[var(--foreground)]">{r.description}</p>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Renter</p>
                  <p className="text-[12px] text-[var(--foreground)]">{r.renterName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Unit</p>
                  <p className="text-[12px] text-[var(--foreground)] truncate">{r.unitName || r.unitNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Est. Repair</p>
                  <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{peso(r.estimatedRepairCost)}</p>
                </div>
              </div>

              {r.disputeReason && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-[10px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 500 }}>
                    <AlertTriangle size={10} className="inline mr-0.5" /> Disputed by Renter
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">{r.disputeReason}</p>
                </div>
              )}

              {r.status === 'RESOLVED' && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400" style={{ fontWeight: 500 }}>
                      <CheckCircle size={10} className="inline mr-0.5" /> Resolved: {r.resolution}
                    </p>
                    <span className="text-[12px] font-mono text-emerald-700 dark:text-emerald-300" style={{ fontWeight: 600 }}>
                      {peso(r.resolvedAmount || '0')}
                    </span>
                  </div>
                  {r.resolutionNotes && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">{r.resolutionNotes}</p>
                  )}
                  {r.resolvedAt && (
                    <p className="text-[10px] text-emerald-500 mt-1">Resolved {shortDate(r.resolvedAt)}</p>
                  )}
                </div>
              )}

              <p className="text-[10px] text-[var(--muted-foreground)]">
                Reported {timeAgo(r.reportedAt)} · {r.templateName || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Showing {reports.length} of {total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={reports.length < 20}
              className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Resolve Damage Modal ──────────────────────────────── */}
      {resolveTarget && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50" onClick={() => setResolveTarget(null)} />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <h3 className="text-[15px] text-[var(--foreground)] mb-1" style={{ fontWeight: 600 }}>
                Resolve Damage Report #{resolveTarget.id}
              </h3>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-4">
                Booking #{resolveTarget.bookingNumber} · {resolveTarget.severity} damage
              </p>

              {/* Resolution type */}
              <div className="mb-3">
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                  Resolution Type
                </label>
                <select
                  value={resolveResolution}
                  onChange={(e) => setResolveResolution(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                >
                  <option value="CHARGE_FULL">Charge Full Amount</option>
                  <option value="CHARGE_PARTIAL">Charge Partial Amount</option>
                  <option value="WAIVED">Waive Charges</option>
                  <option value="INSURANCE">Insurance Claim</option>
                </select>
              </div>

              {/* Amount */}
              <div className="mb-3">
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                  Resolved Amount (₱)
                </label>
                <input
                  type="number"
                  value={resolveAmount}
                  onChange={(e) => setResolveAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
                />
                <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                  Estimated: {peso(resolveTarget.estimatedRepairCost)}
                </p>
              </div>

              {/* Notes */}
              <div className="mb-3">
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1.5" style={{ fontWeight: 500 }}>
                  Resolution Notes *
                </label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Describe the resolution decision…"
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[var(--accent)]/50 border-t border-[var(--border)]">
              <button
                onClick={() => setResolveTarget(null)}
                className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolveSaving || !resolveNotes.trim()}
                className="px-4 py-2 text-[13px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                style={{ fontWeight: 500 }}
              >
                {resolveSaving && <Loader2 size={14} className="animate-spin" />}
                {resolveSaving ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
