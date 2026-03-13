// ── Liveness Session Review Page ───────────────────────────────
// Lists sessions with status MANUAL_REVIEW so admins can approve/reject.
// Click a row → expand inline to see photo, metrics, reason, and action buttons.
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw, AlertCircle, Loader2, ScanFace, UserCheck, Clock,
  CheckCircle, XCircle, Eye, ExternalLink, ChevronDown, ChevronUp,
  ShieldCheck, ShieldAlert, Image,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchPendingLivenessSessions,
  reviewLivenessSession,
  type LivenessSession,
} from '../lib/drivers-api';

/* ── Helpers ─────────────────────────────────────────────────── */

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function livenessStatusVariant(s: string) {
  switch (s) {
    case 'VERIFIED':       return 'approved';
    case 'MANUAL_REVIEW':  return 'warning';
    case 'FAILED':         return 'rejected';
    case 'CONSUMED':       return 'active';
    case 'PENDING':        return 'pending';
    case 'EXPIRED':        return 'inactive';
    default:               return 'inactive';
  }
}

/* ══════════════════════════════════════════════════════════════ */
/*  EXPANDED SESSION DETAIL                                       */
/* ══════════════════════════════════════════════════════════════ */

function SessionDetail({
  session,
  onReviewed,
}: {
  session: LivenessSession;
  onReviewed: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  const handleReview = useCallback(async (decision: 'VERIFIED' | 'FAILED', notes?: string) => {
    setLoading(true);
    try {
      await reviewLivenessSession(session.publicId, decision, notes);
      toast.success(`Session ${decision === 'VERIFIED' ? 'approved' : 'rejected'} successfully`);
      onReviewed();
    } catch (err: any) {
      toast.error(err.message || 'Failed to review session');
    } finally {
      setLoading(false);
    }
  }, [session.publicId, onReviewed]);

  const metrics = session.metrics ?? {};

  return (
    <div className="bg-[var(--accent)]/30 border-t border-[var(--border)] px-6 py-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Photo column */}
        <div className="md:col-span-1">
          <h4 className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            Selfie Photo
          </h4>
          {session.photoUrl ? (
            <>
              <button
                onClick={() => setPhotoExpanded(true)}
                className="group w-full rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors"
              >
                <div className="aspect-square bg-[var(--accent)] flex items-center justify-center overflow-hidden relative">
                  <img
                    src={session.photoUrl}
                    alt="Selfie"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
              <a
                href={session.photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink size={10} /> Open full size
              </a>
            </>
          ) : (
            <div className="aspect-square rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center">
              <div className="text-center">
                <Image size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
                <p className="text-[12px] text-[var(--muted-foreground)]">No photo uploaded yet</p>
              </div>
            </div>
          )}

          {/* User's profile photo for comparison */}
          {session.user?.photoUrl && (
            <div className="mt-3">
              <h4 className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
                Profile Photo (for comparison)
              </h4>
              <img
                src={session.user.photoUrl}
                alt="Profile"
                className="w-20 h-20 rounded-lg object-cover border border-[var(--border)]"
              />
            </div>
          )}
        </div>

        {/* Details column */}
        <div className="md:col-span-1 space-y-4">
          <div>
            <h4 className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
              Session Details
            </h4>
            <div className="space-y-2 bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
              {[
                { label: 'Session ID', value: session.publicId.slice(0, 8) + '…' },
                { label: 'Method', value: session.method },
                { label: 'Challenge', value: session.challengeType },
                { label: 'Attempts', value: String(session.attemptCount) },
                { label: 'Created', value: session.createdAt ? formatDateTime(session.createdAt) : '—' },
                { label: 'Consumed', value: session.consumedAt ? formatDateTime(session.consumedAt) : '—' },
              ].map(item => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-[11px] text-[var(--muted-foreground)]">{item.label}</span>
                  <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Review reason */}
          {session.reviewReason && (
            <div>
              <h4 className="text-[12px] text-amber-600 dark:text-amber-400 mb-1" style={{ fontWeight: 600 }}>
                Review Reason
              </h4>
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-[12px] text-amber-700 dark:text-amber-300">{session.reviewReason}</p>
              </div>
            </div>
          )}

          {/* ML Metrics (collapsed) */}
          {Object.keys(metrics).length > 0 && (
            <div>
              <h4 className="text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 600 }}>
                ML Metrics
              </h4>
              <pre className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-[10px] text-[var(--muted-foreground)] overflow-auto max-h-40">
                {JSON.stringify(metrics, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Actions column */}
        <div className="md:col-span-1 space-y-4">
          <h4 className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            Admin Action
          </h4>

          {/* Approve button */}
          <button
            onClick={() => handleReview('VERIFIED')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            style={{ fontWeight: 600 }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Approve Selfie
          </button>

          {/* Reject section */}
          {!showReject ? (
            <button
              onClick={() => setShowReject(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <XCircle size={16} />
              Reject Selfie
            </button>
          ) : (
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50 dark:bg-red-950/50 space-y-3">
              <p className="text-[12px] text-red-700 dark:text-red-400" style={{ fontWeight: 600 }}>
                Rejection Reason
              </p>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Why is this selfie being rejected?"
                className="w-full h-20 text-[12px] rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-[var(--card)] text-[var(--foreground)] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReject(false)}
                  disabled={loading}
                  className="flex-1 px-3 py-2 text-[12px] rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReview('FAILED', rejectNotes || undefined)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Confirm Reject
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Approving will set the session to VERIFIED. Rejecting will set it to FAILED and the driver will need to redo the selfie check.
          </p>
        </div>
      </div>

      {/* Full-screen photo overlay */}
      {photoExpanded && session.photoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setPhotoExpanded(false)}
        >
          <img
            src={session.photoUrl}
            alt="Selfie full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                     */
/* ══════════════════════════════════════════════════════════════ */

export function LivenessReviewPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: sessions, isLoading, error, refetch } = useApiQuery<LivenessSession[]>(
    () => fetchPendingLivenessSessions(), [],
  );

  const list = sessions ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Selfie Verification Review"
        description={`${list.length} session${list.length !== 1 ? 's' : ''} pending manual review`}
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ScanFace size={14} className="text-amber-500" />
            <span className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
              Needs Review
            </span>
          </div>
          <p className="text-[24px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {list.length}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error}</span>
          <button onClick={() => refetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !sessions && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading liveness sessions…</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && list.length === 0 && (
        <div className="mt-12 text-center">
          <ShieldCheck size={40} className="mx-auto text-emerald-500 mb-3" />
          <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            All clear!
          </h3>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-1">
            No selfie sessions need manual review right now.
          </p>
        </div>
      )}

      {/* Sessions list */}
      {list.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          {list.map((s, i) => {
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id}>
                {i > 0 && <div className="border-t border-[var(--border)]" />}
                {/* Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--accent)]/50 transition-colors text-left"
                >
                  {/* Avatar / photo */}
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ScanFace size={18} className="text-[var(--muted-foreground)]" />
                    )}
                  </div>

                  {/* User info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
                      {s.user?.name ?? `User #${s.userId}`}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {s.user?.phone ?? '—'}
                      {s.reviewReason ? ` · ${s.reviewReason}` : ''}
                    </p>
                  </div>

                  {/* Status badge */}
                  <StatusBadge
                    status={livenessStatusVariant(s.status)}
                    label={s.status.replace('_', ' ')}
                    size="sm"
                  />

                  {/* Time */}
                  <div className="text-right shrink-0 w-20">
                    <span className="text-[12px] text-[var(--foreground)]">
                      {s.createdAt ? timeAgo(s.createdAt) : '—'}
                    </span>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {s.attemptCount} attempt{s.attemptCount !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Expand icon */}
                  {isExpanded
                    ? <ChevronUp size={16} className="text-[var(--muted-foreground)] shrink-0" />
                    : <ChevronDown size={16} className="text-[var(--muted-foreground)] shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <SessionDetail session={s} onReviewed={refetch} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
