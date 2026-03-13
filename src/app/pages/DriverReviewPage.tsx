// ── Driver Review Page ─────────────────────────────────────────
// Full-page driver application view at /drivers/pending/:id
// Sidebar tabs + content area. Covers: initial review, needs-fix scenarios,
// vehicle change review, ownership docs review.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, UserCheck, AlertCircle,
  FileText, Car, Eye, Image, Clock, ScanFace,
  AlertTriangle, CheckCircle, XCircle, ArrowRightLeft, Key,
  ExternalLink, RefreshCw,
} from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import {
  fetchDriverById, fetchDriverVehicles, reviewDriver, reviewVehicleChange,
  reviewLivenessSession,
  type ApiDriver, type ApiDriverVehicle,
} from '../lib/drivers-api';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusVariant(s: string) {
  switch (s) {
    case 'SUBMITTED':    return 'pending';
    case 'UNDER_REVIEW': return 'info';
    case 'NEEDS_FIX':    return 'warning';
    case 'APPROVED':     return 'approved';
    case 'REJECTED':     return 'rejected';
    case 'DRAFT':        return 'inactive';
    default:             return 'inactive';
  }
}

function ownershipLabel(t: string) {
  switch (t) {
    case 'SELF':                    return 'Self-Owned';
    case 'BORROWED':                return 'Borrowed';
    case 'BOUGHT_NOT_TRANSFERRED':  return 'Bought (Not Transferred)';
    case 'FINANCED':                return 'Financed';
    case 'COMPANY':                 return 'Company-Owned';
    default:                        return t;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DOCUMENT PREVIEW COMPONENT
   ═══════════════════════════════════════════════════════════════ */

function DocCard({ label, url }: { label: string; url?: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/30 rounded-lg border border-dashed border-[var(--border)]">
        <FileText size={14} className="text-[var(--muted-foreground)]" />
        <span className="text-[12px] text-[var(--muted-foreground)]">{label}: Not uploaded</span>
      </div>
    );
  }
  const isImage = /\.(jpg|jpeg|png|webp)/i.test(url) || url.includes('image');
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent)]/50">
        <span className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{label}</span>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
          <ExternalLink size={10} /> Open
        </a>
      </div>
      {isImage ? (
        <img src={url} alt={label} className="w-full h-36 object-cover bg-[var(--accent)]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="flex items-center justify-center h-20 bg-[var(--accent)]/30">
          <FileText size={24} className="text-[var(--muted-foreground)]" />
        </div>
      )}
    </div>
  );
}

/* ── Info row helper ────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{label}</p>
      <p className="text-[13px] text-[var(--foreground)]">{value ?? '—'}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FIX REQUIREMENTS DISPLAY
   ═══════════════════════════════════════════════════════════════ */

function FixRequirementsList({ items }: { items: Array<{ field: string; reason: string }> }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      {items.map((r, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={12} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{r.field}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">{r.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REVIEW MODAL
   ═══════════════════════════════════════════════════════════════ */

// Reusable fix-field options for driver + vehicle documents
const DRIVER_FIX_FIELDS = [
  { value: 'selfiePhoto', label: 'Selfie / Profile Photo' },
  { value: 'licensePhotoUrl', label: 'License Photo' },
  { value: 'photoWithIdUrl', label: 'Photo with ID' },
  { value: 'nbiClearanceUrl', label: 'NBI Clearance' },
  { value: 'barangayClearanceUrl', label: 'Barangay Clearance' },
  { value: 'licenseNumber', label: 'License Number' },
  { value: 'licenseExpiry', label: 'License Expiry' },
];

const VEHICLE_FIX_FIELDS = [
  { value: 'vehicle.frontViewUrl', label: 'Vehicle Front View' },
  { value: 'vehicle.sideViewUrl', label: 'Vehicle Side View' },
  { value: 'vehicle.orUrl', label: 'Official Receipt (OR)' },
  { value: 'vehicle.crUrl', label: 'Cert. of Registration (CR)' },
  { value: 'vehicle.make', label: 'Vehicle Make' },
  { value: 'vehicle.model', label: 'Vehicle Model' },
  { value: 'vehicle.color', label: 'Vehicle Color' },
  { value: 'vehicle.plateNumber', label: 'Plate Number' },
];

const OWNERSHIP_FIX_FIELDS: Record<string, Array<{ value: string; label: string }>> = {
  BORROWED: [
    { value: 'vehicle.ownershipDocs.authorizationLetter', label: 'Authorization Letter' },
    { value: 'vehicle.ownershipDocs.ownerIdPhoto', label: "Owner's ID Photo" },
  ],
  BOUGHT_NOT_TRANSFERRED: [
    { value: 'vehicle.ownershipDocs.deedOfSale', label: 'Deed of Sale' },
    { value: 'vehicle.ownershipDocs.sellerIdPhoto', label: "Seller's ID Photo" },
  ],
  FINANCED: [
    { value: 'vehicle.ownershipDocs.financingCert', label: 'Financing Certificate' },
    { value: 'vehicle.ownershipDocs.salesInvoice', label: 'Sales Invoice' },
    { value: 'vehicle.ownershipDocs.entityIdPhoto', label: 'Entity ID Photo' },
  ],
  COMPANY: [
    { value: 'vehicle.ownershipDocs.companyAuthLetter', label: 'Company Auth. Letter' },
    { value: 'vehicle.ownershipDocs.companyId', label: 'Company ID' },
    { value: 'vehicle.ownershipDocs.signatoryIdPhoto', label: 'Signatory ID Photo' },
  ],
};

function ReviewModal({
  title,
  onClose,
  onSubmit,
  ownershipType,
  mode,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (decision: string, notes: string, fixReqs?: Array<{ field: string; reason: string; required: boolean }>) => Promise<void>;
  ownershipType?: string;
  mode: 'application' | 'vehicle-change';
}) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'NEEDS_FIX' | null>(null);
  const [notes, setNotes] = useState('');
  const [fixFields, setFixFields] = useState<Array<{ field: string; reason: string }>>([{ field: '', reason: '' }]);
  const [loading, setLoading] = useState(false);

  const addFixField = () => setFixFields(p => [...p, { field: '', reason: '' }]);
  const removeFixField = (i: number) => setFixFields(p => p.filter((_, idx) => idx !== i));
  const updateFix = (i: number, key: 'field' | 'reason', val: string) => {
    setFixFields(p => { const u = [...p]; u[i] = { ...u[i], [key]: val }; return u; });
  };

  // Build the field options based on mode + ownership
  const fixOptions = mode === 'application'
    ? [
        ...DRIVER_FIX_FIELDS,
        ...VEHICLE_FIX_FIELDS,
        ...(ownershipType && ownershipType !== 'SELF' ? (OWNERSHIP_FIX_FIELDS[ownershipType] ?? []) : []),
      ]
    : [
        ...VEHICLE_FIX_FIELDS,
        ...(ownershipType && ownershipType !== 'SELF' ? (OWNERSHIP_FIX_FIELDS[ownershipType] ?? []) : []),
      ];

  const validFixes = fixFields.filter(f => f.field && f.reason);
  const needsFixButEmpty = decision === 'NEEDS_FIX' && validFixes.length === 0;

  async function submit() {
    if (!decision) return;
    if (needsFixButEmpty) return;
    setLoading(true);
    try {
      const fixes = decision === 'NEEDS_FIX'
        ? validFixes.map(f => ({ ...f, required: true }))
        : undefined;
      await onSubmit(decision, notes, fixes);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 border border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] text-[var(--foreground)] mb-4" style={{ fontWeight: 600 }}>
          {title}
        </h3>

        {/* Decision buttons */}
        <div className="flex gap-2 mb-4">
          {(['APPROVED', 'NEEDS_FIX', 'REJECTED'] as const).map((d) => (
            <button key={d} onClick={() => setDecision(d)}
              className={`flex-1 py-2 px-3 text-[13px] rounded-lg border transition-colors ${
                decision === d
                  ? d === 'APPROVED' ? 'bg-emerald-600 text-white border-emerald-600'
                    : d === 'REJECTED' ? 'bg-red-600 text-white border-red-600'
                    : 'bg-amber-500 text-white border-amber-500'
                  : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]'
              }`} style={{ fontWeight: 500 }}>
              {d === 'APPROVED' ? '✓ Approve' : d === 'REJECTED' ? '✗ Reject' : '⟳ Needs Fix'}
            </button>
          ))}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="text-[12px] text-[var(--muted-foreground)] mb-1 block" style={{ fontWeight: 500 }}>
            Notes {decision === 'REJECTED' && '(required)'}
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder={decision === 'NEEDS_FIX' ? 'Explain what needs to be fixed...' : decision === 'REJECTED' ? 'Reason for rejection...' : 'Optional notes...'} />
        </div>

        {/* Fix Requirements */}
        {decision === 'NEEDS_FIX' && (
          <div className="mb-4">
            <label className="text-[12px] text-[var(--muted-foreground)] mb-2 block" style={{ fontWeight: 500 }}>
              Fix Requirements <span className="text-red-500">*</span>
            </label>
            {needsFixButEmpty && (
              <p className="text-[12px] text-red-500 mb-2">At least one fix requirement is needed. Select a field and provide a reason.</p>
            )}
            {fixFields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={f.field} onChange={(e) => updateFix(i, 'field', e.target.value)}
                  className="w-1/3 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]">
                  <option value="">Select field…</option>
                  {fixOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={f.reason} onChange={(e) => updateFix(i, 'reason', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-[12px] border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
                  placeholder="Reason (e.g. Photo is blurry)" />
                {fixFields.length > 1 && (
                  <button onClick={() => removeFixField(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                )}
              </div>
            ))}
            <button onClick={addFixField} className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline">
              + Add another field
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
          <button onClick={onClose}
            className="flex-1 py-2 text-[13px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
            style={{ fontWeight: 500 }}>Cancel</button>
          <button onClick={submit}
            disabled={!decision || loading || (decision === 'REJECTED' && !notes) || needsFixButEmpty}
            className={`flex-1 py-2 text-[13px] rounded-lg text-white disabled:opacity-40 ${
              decision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700'
                : decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`} style={{ fontWeight: 500 }}>
            {loading ? 'Submitting…' : decision === 'APPROVED' ? 'Confirm Approve' : decision === 'REJECTED' ? 'Confirm Reject' : 'Send Back for Fixes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SELFIE VERIFICATION TAB
   ═══════════════════════════════════════════════════════════════ */

function selfieStatusVariant(s: string) {
  switch (s) {
    case 'VERIFIED':       return 'approved';
    case 'CONSUMED':       return 'active';
    case 'MANUAL_REVIEW':  return 'warning';
    case 'FAILED':         return 'rejected';
    case 'PENDING':        return 'pending';
    case 'EXPIRED':        return 'inactive';
    default:               return 'inactive';
  }
}

function SelfieTab({ driver, onReviewed }: { driver: ApiDriver; onReviewed: () => void }) {
  const selfie = (driver as any).selfieVerification as {
    publicId: string;
    status: string;
    method: string;
    challengeType: string;
    reviewReason: string | null;
    verifiedAt: string | null;
    photoUrl: string | null;
    metrics: Record<string, any> | null;
    attemptCount: number;
    createdAt: string;
    consumedAt: string | null;
  } | null;

  const userPhotoUrl = driver.user?.photoUrl as string | null;
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState<'selfie' | 'profile' | null>(null);

  const handleLivenessReview = useCallback(async (decision: 'VERIFIED' | 'FAILED', notes?: string) => {
    if (!selfie?.publicId) return;
    setReviewLoading(true);
    try {
      await reviewLivenessSession(selfie.publicId, decision, notes);
      toast.success(`Selfie ${decision === 'VERIFIED' ? 'approved' : 'rejected'} successfully`);
      onReviewed();
    } catch (err: any) {
      toast.error(err.message || 'Failed to review selfie');
    } finally {
      setReviewLoading(false);
      setShowRejectInput(false);
      setRejectNotes('');
    }
  }, [selfie?.publicId, onReviewed]);

  // No selfie session at all
  if (!selfie) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
          <ScanFace size={32} className="mx-auto text-amber-500 mb-2" />
          <h3 className="text-[14px] text-amber-800 dark:text-amber-300" style={{ fontWeight: 600 }}>
            No Selfie Verification
          </h3>
          <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-1">
            This driver has not completed the selfie verification step yet.
          </p>
        </div>
      </div>
    );
  }

  const needsReview = selfie.status === 'MANUAL_REVIEW';
  const metrics = selfie.metrics ?? {};

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {needsReview && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-[13px] text-amber-800 dark:text-amber-300" style={{ fontWeight: 600 }}>
              Selfie Requires Manual Review
            </span>
          </div>
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            {selfie.reviewReason || 'The liveness check flagged this session for human review. Verify the selfie before approving the application.'}
          </p>
        </div>
      )}

      {selfie.status === 'VERIFIED' && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-600" />
            <span className="text-[13px] text-emerald-800 dark:text-emerald-300" style={{ fontWeight: 600 }}>Selfie Verified</span>
          </div>
          <p className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-1">
            Liveness check passed{selfie.verifiedAt ? ` on ${formatDateTime(selfie.verifiedAt)}` : ''}.
          </p>
        </div>
      )}

      {selfie.status === 'FAILED' && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-600" />
            <span className="text-[13px] text-red-800 dark:text-red-300" style={{ fontWeight: 600 }}>Selfie Failed</span>
          </div>
          <p className="text-[12px] text-red-700 dark:text-red-400 mt-1">
            {selfie.reviewReason || 'Liveness check failed.'}
          </p>
        </div>
      )}

      {/* Photos side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile photo (uploaded after liveness) */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
            <Image size={13} /> PROFILE PHOTO
          </h3>
          {userPhotoUrl ? (
            <button onClick={() => setPhotoExpanded('profile')}
              className="group w-full rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors">
              <div className="aspect-square bg-[var(--accent)] flex items-center justify-center overflow-hidden relative">
                <img src={userPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ) : (
            <div className="aspect-square rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center">
              <div className="text-center">
                <Image size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
                <p className="text-[12px] text-[var(--muted-foreground)]">No profile photo uploaded</p>
              </div>
            </div>
          )}
        </div>

        {/* Selfie session photo */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
            <ScanFace size={13} /> LIVENESS SESSION PHOTO
          </h3>
          {selfie.photoUrl ? (
            <button onClick={() => setPhotoExpanded('selfie')}
              className="group w-full rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors">
              <div className="aspect-square bg-[var(--accent)] flex items-center justify-center overflow-hidden relative">
                <img src={selfie.photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ) : (
            <div className="aspect-square rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center">
              <div className="text-center">
                <ScanFace size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
                <p className="text-[12px] text-[var(--muted-foreground)]">No session photo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session details */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>SESSION DETAILS</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Status</p>
            <StatusBadge status={selfieStatusVariant(selfie.status)} label={selfie.status} size="sm" />
          </div>
          <InfoRow label="Method" value={selfie.method} />
          <InfoRow label="Challenge Type" value={selfie.challengeType} />
          <InfoRow label="Attempts" value={selfie.attemptCount} />
          <InfoRow label="Created" value={selfie.createdAt ? formatDateTime(selfie.createdAt) : '—'} />
          <InfoRow label="Consumed" value={selfie.consumedAt ? formatDateTime(selfie.consumedAt) : '—'} />
          {selfie.reviewReason && (
            <div className="col-span-3">
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Review Reason</p>
              <p className="text-[13px] text-amber-600 dark:text-amber-400">{selfie.reviewReason}</p>
            </div>
          )}
        </div>

        {/* Metrics */}
        {Object.keys(metrics).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-[11px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>METRICS</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(metrics).map(([k, v]) => (
                <div key={k} className="p-2 bg-[var(--accent)]/50 rounded-lg">
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-[12px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {typeof v === 'number' ? (v < 1 && v > 0 ? `${(v * 100).toFixed(0)}%` : v) : String(v)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Liveness review actions (only for MANUAL_REVIEW) */}
      {needsReview && (
        <div className="bg-[var(--card)] border-2 border-amber-300 dark:border-amber-700 rounded-xl p-5">
          <h3 className="text-[13px] text-amber-700 dark:text-amber-400 mb-4 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
            <AlertTriangle size={13} /> Review Selfie Verification
          </h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-4">
            Compare the profile photo and liveness session photo. Verify they are the same person, no face obstructions, and the photo meets quality standards.
          </p>

          {showRejectInput && (
            <div className="mb-4">
              <label className="text-[12px] text-[var(--muted-foreground)] mb-1 block" style={{ fontWeight: 500 }}>
                Rejection reason
              </label>
              <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="Why is this selfie being rejected?" />
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={reviewLoading}
              onClick={() => handleLivenessReview('VERIFIED')}
              className="flex-1 py-2.5 text-[13px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ fontWeight: 500 }}>
              {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Approve Selfie
            </button>
            {!showRejectInput ? (
              <button
                disabled={reviewLoading}
                onClick={() => setShowRejectInput(true)}
                className="flex-1 py-2.5 text-[13px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ fontWeight: 500 }}>
                <XCircle size={14} /> Reject Selfie
              </button>
            ) : (
              <button
                disabled={reviewLoading || !rejectNotes.trim()}
                onClick={() => handleLivenessReview('FAILED', rejectNotes)}
                className="flex-1 py-2.5 text-[13px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ fontWeight: 500 }}>
                {reviewLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Confirm Reject
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full-screen photo overlay */}
      {photoExpanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setPhotoExpanded(null)}>
          <img
            src={photoExpanded === 'profile' ? (userPhotoUrl ?? '') : (selfie.photoUrl ?? '')}
            alt={photoExpanded === 'profile' ? 'Profile photo' : 'Selfie photo'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'application', label: 'Application',     icon: FileText },
  { id: 'selfie',      label: 'Selfie',          icon: ScanFace },
  { id: 'documents',   label: 'Documents',       icon: Image },
  { id: 'vehicle',     label: 'Vehicle',         icon: Car },
  { id: 'ownership',   label: 'Ownership Docs',  icon: Key },
  { id: 'change',      label: 'Vehicle Change',  icon: ArrowRightLeft },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */

export function DriverReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────
  const [driver, setDriver] = useState<ApiDriver | null>(null);
  const [vehicles, setVehicles] = useState<ApiDriverVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('application');
  const [reviewModal, setReviewModal] = useState<'application' | 'vehicle-change' | null>(null);

  // ── Derived ────────────────────────────────────────────────
  const activeVehicle = vehicles.find(v => v.isActive) ?? vehicles.find(v => v.applicationStatus === 'APPROVED') ?? driver?.vehicle ?? null;
  const pendingVehicle = vehicles.find(
    v => !v.isActive && ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_FIX'].includes(v.applicationStatus) && v.id !== activeVehicle?.id,
  );
  const ownershipType = activeVehicle?.ownershipType ?? 'SELF';
  const hasPendingChange = !!pendingVehicle;

  // ── Load data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [d, v] = await Promise.all([
        fetchDriverById(Number(id)),
        fetchDriverVehicles(Number(id)),
      ]);
      setDriver(d as ApiDriver);
      setVehicles((v as ApiDriverVehicle[]) ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load driver');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Tabs to show ───────────────────────────────────────────
  function visibleTabs() {
    return TABS.filter(t => {
      if (t.id === 'ownership' && ownershipType === 'SELF') return false;
      if (t.id === 'change' && !hasPendingChange) return false;
      return true;
    });
  }

  // ── Review handlers ────────────────────────────────────────
  async function handleApplicationReview(decision: string, notes: string, fixReqs?: Array<{ field: string; reason: string; required: boolean }>) {
    if (!driver) return;
    await reviewDriver(driver.id, decision as any, notes || undefined, undefined, fixReqs);
    toast.success(`Driver ${decision === 'APPROVED' ? 'approved' : decision === 'REJECTED' ? 'rejected' : 'sent back for fixes'}`);
    loadData();
  }

  async function handleVehicleChangeReview(decision: string, notes: string, fixReqs?: Array<{ field: string; reason: string; required: boolean }>) {
    if (!pendingVehicle) return;
    await reviewVehicleChange(pendingVehicle.id, decision as any, notes || undefined, fixReqs);
    toast.success(`Vehicle change ${decision === 'APPROVED' ? 'approved' : decision === 'REJECTED' ? 'rejected' : 'sent back for fixes'}`);
    loadData();
  }

  // ── Loading / Error ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2">
        <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="text-[var(--muted-foreground)]">Loading driver application…</span>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/drivers/pending')}
          className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Pending
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error || 'Driver not found'}</span>
          <button onClick={loadData} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      </div>
    );
  }

  const d = driver;

  /* ═════════ RENDER ═════════ */
  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        {/* Back + driver header */}
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => navigate('/drivers/pending')}
            className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-3">
            <ArrowLeft size={12} /> Pending Drivers
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-[var(--primary)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>
                {d.user?.name ?? 'Unknown'}
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{d.user?.phone}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={statusVariant(d.applicationStatus)} label={d.applicationStatus} size="sm" />
            {hasPendingChange && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800"
                style={{ fontWeight: 500 }}>
                Vehicle Change
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5">
            Applied {timeAgo(d.createdAt)} · {formatDate(d.createdAt)}
          </p>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleTabs().map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] rounded-lg transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]'
              }`}
              style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}>
              <tab.icon size={14} className={activeTab === tab.id ? 'text-[var(--primary)]' : ''} />
              {tab.label}
              {tab.id === 'selfie' && (driver as any).selfieVerification?.status === 'MANUAL_REVIEW' && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" />
              )}
              {tab.id === 'selfie' && !(driver as any).selfieVerification && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500" />
              )}
              {tab.id === 'change' && pendingVehicle && (
                <span className="ml-auto w-2 h-2 rounded-full bg-violet-500" />
              )}
            </button>
          ))}
        </nav>

        {/* Action buttons */}
        <div className="p-3 border-t border-[var(--border)] space-y-1.5">
          {['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_FIX'].includes(d.applicationStatus) && (
            <button onClick={() => setReviewModal('application')}
              className="w-full py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}>
              <CheckCircle size={13} /> Review Application
            </button>
          )}
          {hasPendingChange && (
            <button onClick={() => { setActiveTab('change'); setReviewModal('vehicle-change'); }}
              className="w-full py-2 text-[12px] bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}>
              <ArrowRightLeft size={13} /> Review Vehicle Change
            </button>
          )}
          <button onClick={loadData}
            className="w-full py-2 text-[12px] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--accent)] transition-colors flex items-center justify-center gap-1.5"
            style={{ fontWeight: 500 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Tab heading */}
        <div className="mb-5">
          <h2 className="text-[17px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            {d.user?.name} · {d.user?.phone}
          </p>
        </div>

        {/* ── APPLICATION TAB ──────────────────────────────── */}
        {activeTab === 'application' && (
          <div className="space-y-6">
            {/* Status banner */}
            {d.applicationStatus === 'NEEDS_FIX' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <span className="text-[13px] text-amber-800 dark:text-amber-300" style={{ fontWeight: 600 }}>Sent Back for Fixes</span>
                </div>
                {d.adminNotes && <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-1">Notes: {d.adminNotes}</p>}
                {d.fixRequirements && d.fixRequirements.length > 0 && (
                  <div className="mt-3">
                    <FixRequirementsList items={d.fixRequirements} />
                  </div>
                )}
              </div>
            )}

            {d.applicationStatus === 'SUBMITTED' && !d.adminNotes && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-blue-600" />
                  <span className="text-[13px] text-blue-800 dark:text-blue-300" style={{ fontWeight: 600 }}>Awaiting Initial Review</span>
                </div>
                <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-1">
                  Submitted {timeAgo(d.createdAt)}. Review all documents before making a decision.
                </p>
              </div>
            )}

            {d.applicationStatus === 'SUBMITTED' && !!d.adminNotes && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw size={14} className="text-emerald-600" />
                  <span className="text-[13px] text-emerald-800 dark:text-emerald-300" style={{ fontWeight: 600 }}>Resubmitted — Ready for Re-review</span>
                </div>
                <p className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Driver has fixed and resubmitted their application. Updated {timeAgo(d.updatedAt)}.
                </p>
                <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 600 }}>YOUR PREVIOUS REVIEW NOTES:</p>
                  <p className="text-[12px] text-[var(--foreground)]">{d.adminNotes}</p>
                </div>
              </div>
            )}

            {/* Driver Info */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>DRIVER INFORMATION</h3>
              <div className="grid grid-cols-3 gap-4">
                <InfoRow label="Full Name" value={d.user?.name} />
                <InfoRow label="Phone" value={d.user?.phone} />
                <InfoRow label="Email" value={d.user?.email || 'N/A'} />
                <InfoRow label="License Number" value={d.licenseNumber} />
                <InfoRow label="License Expiry" value={d.licenseExpiry ? formatDate(d.licenseExpiry) : 'N/A'} />
                <InfoRow label="Applied On" value={formatDateTime(d.createdAt)} />
                <InfoRow label="Background Check" value={d.backgroundCheckStatus || 'Pending'} />
                <InfoRow label="Rating" value={d.rating} />
                <InfoRow label="Total Trips" value={d.totalTrips} />
              </div>
            </div>

            {/* Vehicle Summary */}
            {activeVehicle && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>VEHICLE SUMMARY</h3>
                <div className="grid grid-cols-3 gap-4">
                  <InfoRow label="Type" value={activeVehicle.vehicleType} />
                  <InfoRow label="Make / Model" value={`${activeVehicle.make ?? ''} ${activeVehicle.model ?? ''}`.trim() || '—'} />
                  <InfoRow label="Year" value={activeVehicle.year} />
                  <InfoRow label="Color" value={activeVehicle.color} />
                  <InfoRow label="Plate Number" value={activeVehicle.plateNumber} />
                  <InfoRow label="Ownership" value={ownershipLabel(activeVehicle.ownershipType)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SELFIE VERIFICATION TAB ─────────────────────── */}
        {activeTab === 'selfie' && (
          <SelfieTab driver={d} onReviewed={loadData} />
        )}

        {/* ── DOCUMENTS TAB ────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Driver Documents */}
            <div>
              <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                <FileText size={13} /> DRIVER DOCUMENTS
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <DocCard label="License Photo" url={d.licensePhotoUrl} />
                <DocCard label="Photo with ID" url={d.documents?.photoWithId} />
                <DocCard label="NBI Clearance" url={d.documents?.nbi} />
                <DocCard label="Barangay Clearance" url={d.documents?.barangayClearance} />
              </div>
            </div>

            {/* Vehicle Documents */}
            {activeVehicle?.photos && (
              <div>
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                  <Car size={13} /> VEHICLE DOCUMENTS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Front View" url={activeVehicle.photos.frontView} />
                  <DocCard label="Side View" url={activeVehicle.photos.sideView} />
                  <DocCard label="Official Receipt (OR)" url={activeVehicle.photos.or} />
                  <DocCard label="Cert. of Registration (CR)" url={activeVehicle.photos.cr} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VEHICLE TAB ──────────────────────────────────── */}
        {activeTab === 'vehicle' && activeVehicle && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>VEHICLE DETAILS</h3>
                <StatusBadge status={statusVariant(activeVehicle.applicationStatus)} label={activeVehicle.applicationStatus} size="sm" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InfoRow label="Vehicle Type" value={activeVehicle.vehicleType} />
                <InfoRow label="Make" value={activeVehicle.make} />
                <InfoRow label="Model" value={activeVehicle.model} />
                <InfoRow label="Year" value={activeVehicle.year} />
                <InfoRow label="Color" value={activeVehicle.color} />
                <InfoRow label="Plate Number" value={activeVehicle.plateNumber} />
                <InfoRow label="Passenger Capacity" value={(activeVehicle as any).passengerCapacity} />
                <InfoRow label="Registration #" value={(activeVehicle as any).registrationNumber} />
                <InfoRow label="Insurance Provider" value={(activeVehicle as any).insuranceProvider} />
                <InfoRow label="Ownership Type" value={ownershipLabel(activeVehicle.ownershipType)} />
                <InfoRow label="Active" value={activeVehicle.isActive ? 'Yes' : 'No'} />
                <InfoRow label="Verified" value={activeVehicle.isVerified ? 'Yes' : 'No'} />
              </div>
            </div>

            {/* Vehicle fix requirements */}
            {activeVehicle.fixRequirements && activeVehicle.fixRequirements.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>VEHICLE FIX REQUIREMENTS</h3>
                <FixRequirementsList items={activeVehicle.fixRequirements} />
              </div>
            )}

            {/* Vehicle photos */}
            {activeVehicle.photos && (
              <div>
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>VEHICLE PHOTOS</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Front View" url={activeVehicle.photos.frontView} />
                  <DocCard label="Side View" url={activeVehicle.photos.sideView} />
                  <DocCard label="Official Receipt (OR)" url={activeVehicle.photos.or} />
                  <DocCard label="Cert. of Registration (CR)" url={activeVehicle.photos.cr} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OWNERSHIP DOCS TAB ───────────────────────────── */}
        {activeTab === 'ownership' && activeVehicle && activeVehicle.ownershipType !== 'SELF' && (
          <div className="space-y-6">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Key size={14} className="text-[var(--primary)]" />
                <h3 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                  {ownershipLabel(activeVehicle.ownershipType)} — Supporting Documents
                </h3>
              </div>

              {activeVehicle.ownershipType === 'BORROWED' && activeVehicle.ownershipDocs && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <InfoRow label="Owner Name" value={activeVehicle.ownershipDocs.ownerName} />
                    <InfoRow label="Owner Contact" value={activeVehicle.ownershipDocs.ownerContact} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <DocCard label="Authorization Letter" url={activeVehicle.ownershipDocs.authorizationLetter} />
                    <DocCard label="Owner's ID Photo" url={activeVehicle.ownershipDocs.ownerIdPhoto} />
                  </div>
                </>
              )}

              {activeVehicle.ownershipType === 'BOUGHT_NOT_TRANSFERRED' && activeVehicle.ownershipDocs && (
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Deed of Sale" url={activeVehicle.ownershipDocs.deedOfSale} />
                  <DocCard label="Seller's ID Photo" url={activeVehicle.ownershipDocs.sellerIdPhoto} />
                </div>
              )}

              {activeVehicle.ownershipType === 'FINANCED' && activeVehicle.ownershipDocs && (
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Financing Certificate" url={activeVehicle.ownershipDocs.financingCert} />
                  <DocCard label="Sales Invoice" url={activeVehicle.ownershipDocs.salesInvoice} />
                  <DocCard label="Entity ID Photo" url={activeVehicle.ownershipDocs.entityIdPhoto} />
                </div>
              )}

              {activeVehicle.ownershipType === 'COMPANY' && activeVehicle.ownershipDocs && (
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Company Authorization Letter" url={activeVehicle.ownershipDocs.companyAuthLetter} />
                  <DocCard label="Company ID" url={activeVehicle.ownershipDocs.companyId} />
                  <DocCard label="Signatory ID Photo" url={activeVehicle.ownershipDocs.signatoryIdPhoto} />
                </div>
              )}

              {!activeVehicle.ownershipDocs && (
                <p className="text-[13px] text-[var(--muted-foreground)]">No ownership documents uploaded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── VEHICLE CHANGE TAB ───────────────────────────── */}
        {activeTab === 'change' && pendingVehicle && (
          <div className="space-y-6">
            {/* Banner */}
            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft size={14} className="text-violet-600" />
                <span className="text-[13px] text-violet-800 dark:text-violet-300" style={{ fontWeight: 600 }}>
                  Pending Vehicle Change Request
                </span>
              </div>
              <p className="text-[12px] text-violet-700 dark:text-violet-400">
                Driver submitted a new vehicle for review. Compare below and decide.
              </p>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-6">
              {/* Current */}
              {activeVehicle && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <Car size={13} /> CURRENT VEHICLE
                  </h3>
                  <div className="space-y-3">
                    <InfoRow label="Type" value={activeVehicle.vehicleType} />
                    <InfoRow label="Make / Model" value={`${activeVehicle.make ?? ''} ${activeVehicle.model ?? ''}`.trim()} />
                    <InfoRow label="Year" value={activeVehicle.year} />
                    <InfoRow label="Plate" value={activeVehicle.plateNumber} />
                    <InfoRow label="Ownership" value={ownershipLabel(activeVehicle.ownershipType)} />
                    <div><StatusBadge status="approved" label="ACTIVE" size="sm" /></div>
                  </div>
                </div>
              )}

              {/* New / Pending */}
              <div className="bg-[var(--card)] border-2 border-violet-300 dark:border-violet-700 rounded-xl p-5">
                <h3 className="text-[13px] text-violet-700 dark:text-violet-400 mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <ArrowRightLeft size={13} /> NEW VEHICLE (Pending)
                </h3>
                <div className="space-y-3">
                  <InfoRow label="Type" value={pendingVehicle.vehicleType} />
                  <InfoRow label="Make / Model" value={`${pendingVehicle.make ?? ''} ${pendingVehicle.model ?? ''}`.trim()} />
                  <InfoRow label="Year" value={pendingVehicle.year} />
                  <InfoRow label="Plate" value={pendingVehicle.plateNumber} />
                  <InfoRow label="Ownership" value={ownershipLabel(pendingVehicle.ownershipType)} />
                  <div><StatusBadge status={statusVariant(pendingVehicle.applicationStatus)} label={pendingVehicle.applicationStatus} size="sm" /></div>
                </div>
              </div>
            </div>

            {/* New vehicle documents */}
            {pendingVehicle.photos && (
              <div>
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>NEW VEHICLE PHOTOS</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DocCard label="Front View" url={pendingVehicle.photos.frontView} />
                  <DocCard label="Side View" url={pendingVehicle.photos.sideView} />
                  <DocCard label="Official Receipt (OR)" url={pendingVehicle.photos.or} />
                  <DocCard label="Cert. of Registration (CR)" url={pendingVehicle.photos.cr} />
                </div>
              </div>
            )}

            {/* New vehicle ownership docs (if not SELF) */}
            {pendingVehicle.ownershipType !== 'SELF' && pendingVehicle.ownershipDocs && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3 flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Key size={13} /> NEW VEHICLE OWNERSHIP DOCS — {ownershipLabel(pendingVehicle.ownershipType)}
                </h3>

                {pendingVehicle.ownershipType === 'BORROWED' && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <InfoRow label="Owner Name" value={pendingVehicle.ownershipDocs.ownerName} />
                      <InfoRow label="Owner Contact" value={pendingVehicle.ownershipDocs.ownerContact} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <DocCard label="Authorization Letter" url={pendingVehicle.ownershipDocs.authorizationLetter} />
                      <DocCard label="Owner's ID Photo" url={pendingVehicle.ownershipDocs.ownerIdPhoto} />
                    </div>
                  </>
                )}
                {pendingVehicle.ownershipType === 'BOUGHT_NOT_TRANSFERRED' && (
                  <div className="grid grid-cols-2 gap-4">
                    <DocCard label="Deed of Sale" url={pendingVehicle.ownershipDocs.deedOfSale} />
                    <DocCard label="Seller's ID Photo" url={pendingVehicle.ownershipDocs.sellerIdPhoto} />
                  </div>
                )}
                {pendingVehicle.ownershipType === 'FINANCED' && (
                  <div className="grid grid-cols-2 gap-4">
                    <DocCard label="Financing Certificate" url={pendingVehicle.ownershipDocs.financingCert} />
                    <DocCard label="Sales Invoice" url={pendingVehicle.ownershipDocs.salesInvoice} />
                    <DocCard label="Entity ID Photo" url={pendingVehicle.ownershipDocs.entityIdPhoto} />
                  </div>
                )}
                {pendingVehicle.ownershipType === 'COMPANY' && (
                  <div className="grid grid-cols-2 gap-4">
                    <DocCard label="Company Auth. Letter" url={pendingVehicle.ownershipDocs.companyAuthLetter} />
                    <DocCard label="Company ID" url={pendingVehicle.ownershipDocs.companyId} />
                    <DocCard label="Signatory ID Photo" url={pendingVehicle.ownershipDocs.signatoryIdPhoto} />
                  </div>
                )}
              </div>
            )}

            {/* Fix requirements on pending vehicle */}
            {pendingVehicle.fixRequirements && pendingVehicle.fixRequirements.length > 0 && (
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-[13px] text-[var(--muted-foreground)] mb-3" style={{ fontWeight: 600 }}>PENDING VEHICLE FIX REQUIREMENTS</h3>
                <FixRequirementsList items={pendingVehicle.fixRequirements} />
              </div>
            )}

            {/* Review action */}
            <div className="flex justify-end">
              <button onClick={() => setReviewModal('vehicle-change')}
                className="px-6 py-2.5 text-[13px] bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2"
                style={{ fontWeight: 500 }}>
                <Eye size={14} /> Review Vehicle Change
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Review Modals ──────────────────────────────────── */}
      {reviewModal === 'application' && (
        <ReviewModal
          title={`Review Application: ${d.user?.name}`}
          ownershipType={ownershipType}
          mode="application"
          onClose={() => setReviewModal(null)}
          onSubmit={handleApplicationReview}
        />
      )}
      {reviewModal === 'vehicle-change' && pendingVehicle && (
        <ReviewModal
          title={`Review Vehicle Change: ${pendingVehicle.make ?? ''} ${pendingVehicle.model ?? ''} (${pendingVehicle.plateNumber})`}
          ownershipType={pendingVehicle.ownershipType}
          mode="vehicle-change"
          onClose={() => setReviewModal(null)}
          onSubmit={handleVehicleChangeReview}
        />
      )}
    </div>
  );
}
