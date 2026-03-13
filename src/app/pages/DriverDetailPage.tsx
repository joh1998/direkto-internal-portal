// ── Driver Detail Page ─────────────────────────────────────────
// Full-page driver view at /drivers/:id
// Sidebar tabs → content area (like MerchantDetailPage).
// Shows: Overview, Documents, Vehicle, Trips, Earnings + admin actions.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, AlertCircle, UserCheck, Star,
  LayoutDashboard, FileText, Car, MapPin, DollarSign,
  ShieldCheck, ShieldAlert, CheckCircle, XCircle, Ban,
  Play, Clock, Eye, ExternalLink, RefreshCw, Image,
  ChevronLeft, ChevronRight, Bike, AlertTriangle, ScanFace,
} from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useAuth } from '../context/AuthContext';
import { canApprove, canEdit as canEditPerm } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchDriverById, fetchDriverVehicles, fetchDriverDocuments,
  fetchDriverStats, fetchDriverTrips, fetchDriverEarnings,
  fetchDriverLivenessSessions,
  reviewDriver, suspendDriver, reactivateDriver,
  revokeDriverApproval, reopenDriverApplication,
  type ApiDriver, type ApiDriverVehicle, type DriverTrip, type DriverEarnings, type DriverTripsPaginated,
  type LivenessSession,
} from '../lib/drivers-api';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function getDriverStatus(d: ApiDriver): string {
  if (!d.isVerified && d.status !== 'SUSPENDED') return 'pending';
  if (d.status === 'SUSPENDED') return 'suspended';
  if (d.status === 'ONLINE') return 'active';
  if (d.status === 'ON_TRIP') return 'active';
  return 'inactive';
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'overview',   label: 'Overview',   icon: LayoutDashboard },
  { id: 'documents',  label: 'Documents',  icon: FileText },
  { id: 'vehicle',    label: 'Vehicle',    icon: Car },
  { id: 'liveness',   label: 'Selfie',     icon: ScanFace },
  { id: 'trips',      label: 'Trips',      icon: MapPin },
  { id: 'earnings',   label: 'Earnings',   icon: DollarSign },
] as const;

type TabId = (typeof TABS)[number]['id'];

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════ */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[var(--accent)]/50 rounded-xl p-4">
      <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{label}</p>
      <p className="text-[20px] mt-1 text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOC IMAGE VIEWER
   ═══════════════════════════════════════════════════════════════ */
function DocImage({ label, url }: { label: string; url?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
        <Image size={20} className="mx-auto text-[var(--muted-foreground)] mb-1" />
        <p className="text-[11px] text-[var(--muted-foreground)]">{label}</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Not uploaded</p>
      </div>
    );
  }
  return (
    <>
      <button onClick={() => setExpanded(true)} className="group rounded-lg border border-[var(--border)] overflow-hidden hover:border-[var(--primary)] transition-colors">
        <div className="aspect-[4/3] bg-[var(--accent)] flex items-center justify-center overflow-hidden relative">
          <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="px-2 py-1.5 bg-[var(--card)]">
          <p className="text-[11px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>{label}</p>
        </div>
      </button>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setExpanded(false)}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={label} className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button onClick={() => setExpanded(false)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/90 text-gray-800 flex items-center justify-center hover:bg-white text-lg">&times;</button>
            <p className="text-center text-white text-[13px] mt-3">{label}</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════ */
function OverviewTab({ driver }: { driver: ApiDriver }) {
  const rating = parseFloat(driver.rating) || 0;
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Trips" value={driver.totalTrips.toLocaleString()} />
        <StatCard label="Completed" value={driver.completedTrips.toLocaleString()} sub={`${driver.cancelledTrips} cancelled`} />
        <StatCard label="Total Earnings" value={`₱${(parseFloat(driver.totalEarnings) || 0).toLocaleString()}`} sub={`₱${(parseFloat(driver.pendingPayout) || 0).toLocaleString()} pending`} />
        <StatCard label="Rating" value={rating > 0 ? rating.toFixed(1) : '—'} sub={rating > 0 ? `${driver.totalTrips} rated trips` : 'No ratings yet'} />
      </div>

      {/* Info grid */}
      <div>
        <h3 className="text-[13px] text-[var(--foreground)] mb-3" style={{ fontWeight: 600 }}>Personal Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          {[
            { label: 'Full Name', value: driver.user?.name || '—' },
            { label: 'Phone', value: driver.user?.phone || '—' },
            { label: 'Email', value: driver.user?.email || '—' },
            { label: 'Driver ID', value: driver.publicId },
            { label: 'User ID', value: `#${driver.userId}` },
            { label: 'Joined', value: formatDate(driver.createdAt) },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
              <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* License info */}
      <div>
        <h3 className="text-[13px] text-[var(--foreground)] mb-3" style={{ fontWeight: 600 }}>License Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          {[
            { label: 'License Number', value: driver.licenseNumber || '—' },
            { label: 'Expiry', value: driver.licenseExpiry ? formatDate(driver.licenseExpiry) : '—' },
            { label: 'Background Check', value: driver.backgroundCheckStatus || 'N/A' },
            { label: 'Application Status', value: driver.applicationStatus || '—' },
            { label: 'Verified', value: driver.isVerified ? `Yes (${driver.verifiedAt ? formatDate(driver.verifiedAt) : '—'})` : 'No' },
            { label: 'Acceptance Rate', value: `${parseFloat(driver.acceptanceRate || '0').toFixed(1)}%` },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
              <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance */}
      <div>
        <h3 className="text-[13px] text-[var(--foreground)] mb-3" style={{ fontWeight: 600 }}>Performance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Acceptance Rate" value={`${parseFloat(driver.acceptanceRate || '0').toFixed(1)}%`} />
          <StatCard label="Cancellation Rate" value={`${parseFloat(driver.cancellationRate || '0').toFixed(1)}%`} />
          <StatCard label="Completed Trips" value={driver.completedTrips.toLocaleString()} />
          <StatCard label="Cancelled Trips" value={driver.cancelledTrips.toLocaleString()} />
        </div>
      </div>

      {/* Fix requirements (if NEEDS_FIX) */}
      {driver.fixRequirements && driver.fixRequirements.length > 0 && (
        <div>
          <h3 className="text-[13px] text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
            <AlertTriangle size={14} /> Fix Requirements
          </h3>
          <div className="space-y-2">
            {driver.fixRequirements.map((req, i) => (
              <div key={i} className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-[12px] text-red-700 dark:text-red-400" style={{ fontWeight: 600 }}>{req.field}</p>
                <p className="text-[12px] text-red-600 dark:text-red-300 mt-0.5">{req.reason}</p>
                {req.required && <span className="text-[10px] text-red-500 mt-1 inline-block">Required</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selfie Verification */}
      {(driver as any).selfieVerification && (
        <div>
          <h3 className="text-[13px] text-[var(--foreground)] mb-3 flex items-center gap-1.5" style={{ fontWeight: 600 }}>
            <ScanFace size={14} /> Selfie Verification
          </h3>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            {(() => {
              const sv = (driver as any).selfieVerification;
              const isOk = sv.status === 'VERIFIED' || sv.status === 'CONSUMED';
              const needsReview = sv.status === 'MANUAL_REVIEW';
              return (
                <div className="flex items-center gap-4">
                  {sv.photoUrl && (
                    <img src={sv.photoUrl} alt="Selfie" className="w-14 h-14 rounded-lg object-cover border border-[var(--border)]" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {isOk && <CheckCircle size={14} className="text-emerald-500" />}
                      {needsReview && <AlertTriangle size={14} className="text-amber-500" />}
                      {sv.status === 'FAILED' && <XCircle size={14} className="text-red-500" />}
                      <span className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                        {sv.status === 'CONSUMED' ? 'VERIFIED' : sv.status}
                      </span>
                    </div>
                    {sv.method && <p className="text-[11px] text-[var(--muted-foreground)]">Method: {sv.method}</p>}
                    {sv.reviewReason && <p className="text-[11px] text-amber-600 dark:text-amber-400">{sv.reviewReason}</p>}
                    {sv.verifiedAt && <p className="text-[11px] text-[var(--muted-foreground)]">Verified: {formatDateTime(sv.verifiedAt)}</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Admin notes */}
      {driver.adminNotes && (
        <div>
          <h3 className="text-[13px] text-[var(--foreground)] mb-2" style={{ fontWeight: 600 }}>Admin Notes</h3>
          <div className="bg-[var(--accent)]/50 rounded-xl p-4">
            <p className="text-[13px] text-[var(--foreground)] whitespace-pre-wrap">{driver.adminNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVENESS TAB
   ═══════════════════════════════════════════════════════════════ */
function LivenessTab({ driverId }: { driverId: number }) {
  const { data: sessions, isLoading, error, refetch } = useApiQuery<LivenessSession[]>(
    () => fetchDriverLivenessSessions(driverId), [driverId],
  );

  const list = sessions ?? [];

  function statusColor(s: string) {
    switch (s) {
      case 'VERIFIED':      return 'text-emerald-600 dark:text-emerald-400';
      case 'CONSUMED':      return 'text-emerald-600 dark:text-emerald-400';
      case 'MANUAL_REVIEW': return 'text-amber-600 dark:text-amber-400';
      case 'FAILED':        return 'text-red-600 dark:text-red-400';
      case 'EXPIRED':       return 'text-[var(--muted-foreground)]';
      default:              return 'text-[var(--foreground)]';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Liveness Session History</h3>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {isLoading && !sessions && (
        <div className="flex items-center gap-2 text-[var(--muted-foreground)] py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[13px]">Loading sessions…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle size={14} />
          <span className="text-[12px]">{error}</span>
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="text-center py-12">
          <ScanFace size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
          <p className="text-[13px] text-[var(--muted-foreground)]">No liveness sessions found</p>
        </div>
      )}

      {list.map((s) => {
        const metrics = s.metrics ?? {};
        const effectiveStatus = s.status === 'CONSUMED' && typeof (metrics as any).result === 'string'
          ? (metrics as any).result : s.status;
        const adminReview = (metrics as any).adminReview;

        return (
          <div key={s.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3">
              {/* Photo */}
              <div className="w-12 h-12 rounded-lg bg-[var(--accent)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ScanFace size={20} className="text-[var(--muted-foreground)]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] ${statusColor(effectiveStatus)}`} style={{ fontWeight: 600 }}>
                    {effectiveStatus === 'CONSUMED' ? 'VERIFIED' : effectiveStatus}
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    {s.method} · {s.challengeType}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  {s.createdAt ? formatDateTime(s.createdAt) : '—'}
                  {' · '}{s.attemptCount} attempt{s.attemptCount !== 1 ? 's' : ''}
                </p>
                {s.reviewReason && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                    Review: {s.reviewReason}
                  </p>
                )}
                {s.failureReason && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                    Failed: {s.failureReason}
                  </p>
                )}
                {adminReview && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                    Admin {adminReview.decision} by {adminReview.reviewedByName}
                    {adminReview.notes ? ` — ${adminReview.notes}` : ''}
                  </p>
                )}
              </div>

              {/* Photo link */}
              {s.photoUrl && (
                <a href={s.photoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0">
                  <ExternalLink size={10} /> View
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DOCUMENTS TAB
   ═══════════════════════════════════════════════════════════════ */
function DocumentsTab({ driver }: { driver: ApiDriver }) {
  const docs = driver.documents || {};
  const licensePhoto = driver.licensePhotoUrl;

  const docEntries = [
    { label: 'License Photo', url: licensePhoto },
    { label: 'NBI Clearance', url: (docs as any).nbiClearance },
    { label: 'Police Clearance', url: (docs as any).policeClearance },
    { label: 'Selfie / ID Photo', url: (docs as any).selfiePhoto || (docs as any).idPhoto },
    { label: 'Barangay Clearance', url: (docs as any).barangayClearance },
    { label: 'Medical Certificate', url: (docs as any).medicalCertificate },
  ].filter(d => d.url);

  if (docEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
        <FileText size={32} className="mb-3 opacity-50" />
        <p className="text-[14px]" style={{ fontWeight: 500 }}>No documents uploaded</p>
        <p className="text-[12px] mt-1">The driver hasn't uploaded any documents yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Uploaded Documents</h3>
        <span className="text-[11px] text-[var(--muted-foreground)]">{docEntries.length} document(s)</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {docEntries.map((doc) => (
          <DocImage key={doc.label} label={doc.label} url={doc.url} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VEHICLE TAB
   ═══════════════════════════════════════════════════════════════ */
function VehicleTab({ driver }: { driver: ApiDriver }) {
  const { data: vehicles, isLoading } = useApiQuery<ApiDriverVehicle[]>(
    () => fetchDriverVehicles(driver.id),
    [driver.id],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" /><span className="ml-2 text-[13px] text-[var(--muted-foreground)]">Loading vehicles…</span></div>;
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
        <Car size={32} className="mb-3 opacity-50" />
        <p className="text-[14px]" style={{ fontWeight: 500 }}>No vehicles registered</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {vehicles.map((v) => (
        <div key={v.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <Bike size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                  {v.make || ''} {v.model || ''} {v.year ? `(${v.year})` : ''}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{v.plateNumber} · {v.vehicleType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={v.isVerified ? 'verified' : v.applicationStatus?.toLowerCase() || 'pending'} />
              {v.color && (
                <span className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--accent)]">{v.color}</span>
              )}
            </div>
          </div>

          {/* Vehicle photos */}
          {v.photos && Object.values(v.photos).some(Boolean) && (
            <div className="p-4 border-b border-[var(--border)]">
              <p className="text-[11px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 500 }}>Vehicle Photos</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {v.photos.frontView && <DocImage label="Front View" url={v.photos.frontView} />}
                {v.photos.backView && <DocImage label="Back View" url={v.photos.backView} />}
                {v.photos.sideView && <DocImage label="Side View" url={v.photos.sideView} />}
                {v.photos.or && <DocImage label="OR" url={v.photos.or} />}
                {v.photos.cr && <DocImage label="CR" url={v.photos.cr} />}
              </div>
            </div>
          )}

          {/* Ownership docs */}
          {v.ownershipType && v.ownershipType !== 'SELF_OWNED' && v.ownershipDocs && (
            <div className="p-4 border-b border-[var(--border)]">
              <p className="text-[11px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 500 }}>
                Ownership: {v.ownershipType.replace(/_/g, ' ')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                {v.ownershipDocs.ownerName && (
                  <div><p className="text-[11px] text-[var(--muted-foreground)]">Owner Name</p><p className="text-[13px] text-[var(--foreground)]">{v.ownershipDocs.ownerName}</p></div>
                )}
                {v.ownershipDocs.ownerContact && (
                  <div><p className="text-[11px] text-[var(--muted-foreground)]">Owner Contact</p><p className="text-[13px] text-[var(--foreground)]">{v.ownershipDocs.ownerContact}</p></div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {v.ownershipDocs.authorizationLetter && <DocImage label="Authorization Letter" url={v.ownershipDocs.authorizationLetter} />}
                {v.ownershipDocs.ownerIdPhoto && <DocImage label="Owner ID Photo" url={v.ownershipDocs.ownerIdPhoto} />}
                {v.ownershipDocs.deedOfSale && <DocImage label="Deed of Sale" url={v.ownershipDocs.deedOfSale} />}
              </div>
            </div>
          )}

          {/* Vehicle info */}
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-[11px] text-[var(--muted-foreground)]">Plate Number</p><p className="text-[13px] text-[var(--foreground)] font-mono">{v.plateNumber}</p></div>
              <div><p className="text-[11px] text-[var(--muted-foreground)]">Type</p><p className="text-[13px] text-[var(--foreground)]">{v.vehicleType}</p></div>
              <div><p className="text-[11px] text-[var(--muted-foreground)]">Ownership</p><p className="text-[13px] text-[var(--foreground)]">{v.ownershipType?.replace(/_/g, ' ') || '—'}</p></div>
              <div><p className="text-[11px] text-[var(--muted-foreground)]">Registered</p><p className="text-[13px] text-[var(--foreground)]">{formatDate(v.createdAt)}</p></div>
            </div>
          </div>

          {/* Fix requirements for vehicle */}
          {v.fixRequirements && v.fixRequirements.length > 0 && (
            <div className="p-4 border-t border-[var(--border)] bg-red-50/50 dark:bg-red-950/30">
              <p className="text-[11px] text-red-600 dark:text-red-400 mb-2 flex items-center gap-1" style={{ fontWeight: 600 }}>
                <AlertTriangle size={12} /> Vehicle Fix Requirements
              </p>
              {v.fixRequirements.map((req, i) => (
                <div key={i} className="text-[12px] text-red-600 dark:text-red-300 ml-4">• <span style={{ fontWeight: 500 }}>{req.field}:</span> {req.reason}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TRIPS TAB
   ═══════════════════════════════════════════════════════════════ */
function TripsTab({ driver }: { driver: ApiDriver }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useApiQuery<DriverTripsPaginated>(
    () => fetchDriverTrips(driver.id, page),
    [driver.id, page],
  );

  const trips = data?.trips ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const tripColumns: Column<DriverTrip>[] = [
    {
      key: 'id',
      label: 'Trip',
      render: (t) => (
        <div>
          <p className="text-[12px] text-[var(--foreground)] font-mono" style={{ fontWeight: 500 }}>{t.publicId || `#${t.id}`}</p>
          <p className="text-[10px] text-[var(--muted-foreground)]">{t.vehicleType}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (t) => <StatusBadge status={t.status.toLowerCase()} />,
    },
    {
      key: 'route',
      label: 'Route',
      render: (t) => (
        <div className="max-w-[200px]">
          <p className="text-[11px] text-[var(--foreground)] truncate">{t.pickupAddress || '—'}</p>
          <p className="text-[11px] text-[var(--muted-foreground)] truncate">→ {t.dropoffAddress || '—'}</p>
        </div>
      ),
    },
    {
      key: 'fare',
      label: 'Fare',
      align: 'right',
      render: (t) => {
        const fare = parseFloat(t.finalFare || t.estimatedFare || '0');
        return <span className="text-[12px] tabular-nums text-[var(--foreground)]">{fare > 0 ? `₱${fare.toFixed(0)}` : '—'}</span>;
      },
    },
    {
      key: 'distance',
      label: 'Distance',
      align: 'right',
      render: (t) => {
        const km = parseFloat(t.actualDistanceKm || t.distanceKm || '0');
        return <span className="text-[12px] tabular-nums text-[var(--muted-foreground)]">{km > 0 ? `${km.toFixed(1)} km` : '—'}</span>;
      },
    },
    {
      key: 'rating',
      label: 'Rating',
      align: 'center',
      render: (t) => t.rating ? (
        <span className="inline-flex items-center gap-0.5 text-[12px]">
          <Star size={10} className="text-amber-500 fill-amber-500" />{t.rating}
        </span>
      ) : <span className="text-[11px] text-[var(--muted-foreground)]">—</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (t) => <span className="text-[11px] text-[var(--muted-foreground)]">{formatDateTime(t.createdAt)}</span>,
    },
  ];

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
        <AlertCircle size={16} />
        <span className="text-[13px]">{error}</span>
        <button onClick={() => refetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Trip History</h3>
        <span className="text-[11px] text-[var(--muted-foreground)]">{total} total trip(s)</span>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>
      ) : (
        <>
          <DataTable
            data={trips}
            columns={tripColumns}
            keyExtractor={(t) => String(t.id)}
            pageSize={20}
            emptyTitle="No trips yet"
            emptyMessage="This driver hasn't completed any trips."
          />
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[12px] text-[var(--muted-foreground)] tabular-nums">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EARNINGS TAB
   ═══════════════════════════════════════════════════════════════ */
function EarningsTab({ driver }: { driver: ApiDriver }) {
  const { data: earnings, isLoading, error } = useApiQuery<DriverEarnings>(
    () => fetchDriverEarnings(driver.id),
    [driver.id],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={18} className="animate-spin text-[var(--muted-foreground)]" /></div>;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
        <AlertCircle size={16} /><span className="text-[13px]">{error}</span>
      </div>
    );
  }

  const e = earnings || {
    totalEarnings: parseFloat(driver.totalEarnings) || 0,
    thisMonthEarnings: 0,
    totalTrips: driver.totalTrips,
    thisMonthTrips: 0,
    pendingPayout: parseFloat(driver.pendingPayout) || 0,
    averageFare: 0,
    completionRate: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Earnings" value={`₱${e.totalEarnings.toLocaleString()}`} />
        <StatCard label="This Month" value={`₱${e.thisMonthEarnings.toLocaleString()}`} />
        <StatCard label="Pending Payout" value={`₱${e.pendingPayout.toLocaleString()}`} />
        <StatCard label="Average Fare" value={e.averageFare > 0 ? `₱${e.averageFare.toFixed(0)}` : '—'} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Trips" value={e.totalTrips.toLocaleString()} />
        <StatCard label="This Month Trips" value={e.thisMonthTrips.toLocaleString()} />
        <StatCard label="Completion Rate" value={e.completionRate > 0 ? `${(e.completionRate * 100).toFixed(1)}%` : '—'} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const canDoApprove = role ? canApprove(role, 'drivers') : false;
  const canDoEdit    = role ? canEditPerm(role, 'drivers') : false;

  // ── State ──────────────────────────────────────────────────
  const [driver, setDriver] = useState<ApiDriver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'revoke' | 'reopen';
    reason?: string;
  } | null>(null);

  // ── Load driver ────────────────────────────────────────────
  const loadDriver = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchDriverById(Number(id));
      setDriver(d);
    } catch (err: any) {
      setError(err?.message || 'Failed to load driver');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDriver(); }, [loadDriver]);

  // ── Execute action ─────────────────────────────────────────
  async function executeAction() {
    if (!confirmAction || !driver) return;
    const { type } = confirmAction;
    try {
      if (type === 'approve') await reviewDriver(driver.id, 'APPROVED');
      else if (type === 'reject') await reviewDriver(driver.id, 'REJECTED');
      else if (type === 'suspend') await suspendDriver(driver.id, 'Suspended from admin');
      else if (type === 'reactivate') await reactivateDriver(driver.id);
      else if (type === 'revoke') await revokeDriverApproval(driver.id, 'Approval revoked by admin');
      else if (type === 'reopen') await reopenDriverApplication(driver.id, 'Application reopened by admin');

      const labels: Record<string, string> = {
        approve: 'approved', reject: 'rejected', suspend: 'suspended',
        reactivate: 'reactivated', revoke: 'approval revoked', reopen: 'application reopened',
      };
      toast.success(`${driver.user?.name ?? 'Driver'} has been ${labels[type]}`);
      setConfirmAction(null);
      loadDriver();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }

  // ── Loading / Error ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="ml-2 text-[var(--muted-foreground)]">Loading driver…</span>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/drivers')} className="flex items-center gap-1.5 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Drivers
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error || 'Driver not found'}</span>
          <button onClick={loadDriver} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      </div>
    );
  }

  const d = driver;
  const status = getDriverStatus(d);
  const rating = parseFloat(d.rating) || 0;

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        {/* Back + driver header */}
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => navigate('/drivers')} className="flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-3">
            <ArrowLeft size={12} /> All Drivers
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <UserCheck size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>{d.user?.name ?? 'Driver'}</p>
                {rating > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600"><Star size={8} className="fill-amber-500" />{rating.toFixed(1)}</span>}
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{d.publicId}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusBadge status={status} size="sm" />
            {d.isVerified && <ShieldCheck size={12} className="text-emerald-600" />}
          </div>
        </div>

        {/* Quick stats */}
        <div className="p-3 border-b border-[var(--border)] grid grid-cols-2 gap-2">
          <div className="text-center">
            <p className="text-[16px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{d.totalTrips}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Trips</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>₱{(parseFloat(d.totalEarnings) || 0).toLocaleString()}</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Earnings</p>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] rounded-lg transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]'
              }`}
              style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}>
              <tab.icon size={14} className={activeTab === tab.id ? 'text-[var(--primary)]' : ''} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Action buttons */}
        {(canDoApprove || canDoEdit) && (
          <div className="p-3 border-t border-[var(--border)] space-y-1.5">
            {canDoApprove && !d.isVerified && d.status !== 'SUSPENDED' && d.applicationStatus !== 'REJECTED' && (
              <>
                <button onClick={() => setConfirmAction({ type: 'approve' })}
                  className="w-full py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <CheckCircle size={13} /> Approve
                </button>
                <button onClick={() => setConfirmAction({ type: 'reject' })}
                  className="w-full py-2 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <XCircle size={13} /> Reject
                </button>
              </>
            )}
            {d.applicationStatus === 'REJECTED' && canDoApprove && (
              <button onClick={() => setConfirmAction({ type: 'reopen' })}
                className="w-full py-2 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                <RefreshCw size={13} /> Reopen Application
              </button>
            )}
            {d.isVerified && d.status !== 'SUSPENDED' && canDoEdit && (
              <>
                <button onClick={() => setConfirmAction({ type: 'suspend' })}
                  className="w-full py-2 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <Ban size={13} /> Suspend
                </button>
                <button onClick={() => setConfirmAction({ type: 'revoke' })}
                  className="w-full py-2 text-[12px] border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                  <AlertTriangle size={13} /> Revoke Approval
                </button>
              </>
            )}
            {d.status === 'SUSPENDED' && canDoEdit && (
              <button onClick={() => setConfirmAction({ type: 'reactivate' })}
                className="w-full py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5" style={{ fontWeight: 500 }}>
                <Play size={13} /> Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-5">
          <h2 className="text-[17px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{d.user?.name} · {d.publicId}</p>
        </div>

        {activeTab === 'overview' && <OverviewTab driver={d} />}
        {activeTab === 'documents' && <DocumentsTab driver={d} />}
        {activeTab === 'vehicle' && <VehicleTab driver={d} />}
        {activeTab === 'liveness' && <LivenessTab driverId={d.id} />}
        {activeTab === 'trips' && <TripsTab driver={d} />}
        {activeTab === 'earnings' && <EarningsTab driver={d} />}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        objectId={String(d.id)}
        title={
          confirmAction?.type === 'approve' ? 'Approve Driver' :
          confirmAction?.type === 'reject' ? 'Reject Driver' :
          confirmAction?.type === 'suspend' ? 'Suspend Driver' :
          confirmAction?.type === 'reactivate' ? 'Reactivate Driver' :
          confirmAction?.type === 'revoke' ? 'Revoke Approval' :
          'Reopen Application'
        }
        message={
          confirmAction?.type === 'approve' ? `Approve ${d.user?.name}? They will be able to accept trips immediately.` :
          confirmAction?.type === 'reject' ? `Reject ${d.user?.name}? This can be reversed by reopening.` :
          confirmAction?.type === 'suspend' ? `Suspend ${d.user?.name}? They will not be able to accept trips.` :
          confirmAction?.type === 'reactivate' ? `Reactivate ${d.user?.name}? They will be able to accept trips again.` :
          confirmAction?.type === 'revoke' ? `Revoke approval for ${d.user?.name}? They will need to resubmit their application.` :
          `Reopen the rejected application for ${d.user?.name}?`
        }
        confirmLabel={
          confirmAction?.type === 'approve' ? 'Approve' :
          confirmAction?.type === 'reject' ? 'Reject' :
          confirmAction?.type === 'suspend' ? 'Suspend' :
          confirmAction?.type === 'reactivate' ? 'Reactivate' :
          confirmAction?.type === 'revoke' ? 'Revoke' :
          'Reopen'
        }
        variant={['reject', 'suspend', 'revoke'].includes(confirmAction?.type || '') ? 'danger' : 'default'}
      />
    </div>
  );
}
