// ── Bookings Tab ─────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import {
  fetchMerchantBookings,
  type ApiMerchant, type AdminBooking,
} from '../../../lib/merchants-api';
import { peso, shortDate, timeAgo } from '../helpers';

const BOOKING_STATUS_MAP: Record<string, string> = {
  PENDING: 'pending', CONFIRMED: 'active', IN_PROGRESS: 'active',
  COMPLETED: 'completed', CANCELLED: 'rejected', EXPIRED: 'suspended', OVERDUE: 'danger',
};

interface Props { merchant: ApiMerchant; canEdit: boolean }

export function BookingsTab({ merchant, canEdit }: Props) {
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
      .then(res => { setBookings(res.data); setStatusSummary(res.statusSummary); setTotal(res.pagination.total); })
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [merchant.id, statusFilter, page]);

  const totalBookings = Object.values(statusSummary).reduce((a, b) => a + b, 0);
  const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${!statusFilter ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
          style={{ fontWeight: 500 }}>All ({totalBookings})</button>
        {statuses.map(s => {
          const count = statusSummary[s] || 0;
          if (count === 0 && s !== statusFilter) return null;
          return (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${statusFilter === s ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
              style={{ fontWeight: 500 }}>{s.replace('_', ' ')} ({count})</button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-[var(--muted-foreground)]"><Loader2 size={14} className="animate-spin" /><span className="text-[12px]">Loading bookings…</span></div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="text-center py-8">
          <Calendar size={28} className="mx-auto text-[var(--muted-foreground)]/40 mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No bookings found</p>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="space-y-2">
          {bookings.map(b => (
            <div key={b.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[var(--accent)]/50 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusBadge status={BOOKING_STATUS_MAP[b.status] || 'pending'} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)] mr-1.5">#{b.bookingNumber}</span>{b.templateName || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                      {b.renterName || 'Unknown'} · {b.unitName || b.unitNumber || '—'} · {shortDate(b.startDate)} → {shortDate(b.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-mono text-[var(--foreground)]" style={{ fontWeight: 500 }}>{peso(b.totalAmount)}</span>
                  {expanded === b.id ? <ChevronUp size={14} className="text-[var(--muted-foreground)]" /> : <ChevronDown size={14} className="text-[var(--muted-foreground)]" />}
                </div>
              </button>

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
                      {parseFloat(b.promoDiscount) > 0 && <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full" style={{ fontWeight: 500 }}>Promo: -{peso(b.promoDiscount)}</span>}
                      {parseFloat(b.lateFee) > 0 && <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full" style={{ fontWeight: 500 }}>Late Fee: +{peso(b.lateFee)}</span>}
                      {parseFloat(b.damageCharge) > 0 && <span className="text-[10px] px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full" style={{ fontWeight: 500 }}>Damage: +{peso(b.damageCharge)}</span>}
                    </div>
                  )}
                  {b.cancellationReason && (
                    <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-[10px] text-red-600 dark:text-red-400" style={{ fontWeight: 500 }}>Cancellation Reason</p>
                      <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">{b.cancellationReason}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--muted-foreground)]">Payment: {b.paymentStatus} · Created {timeAgo(b.createdAt)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 10 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-[var(--muted-foreground)]">Showing {bookings.length} of {total}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={bookings.length < 10} className="px-2 py-1 text-[11px] border border-[var(--border)] rounded hover:bg-[var(--accent)] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
