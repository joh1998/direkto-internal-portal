// ── Pending Drivers List Page ─────────────────────────────────
// Clean list view. Click a row → navigates to /drivers/pending/:id
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw, AlertCircle, Loader2, Clock, AlertTriangle,
  Eye, Car, ChevronRight, UserCheck, Users,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useApiQuery } from '../hooks/useApiQuery';
import { fetchPendingDrivers, type ApiDriver } from '../lib/drivers-api';

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusVariant(s: string) {
  switch (s) {
    case 'SUBMITTED':    return 'pending';
    case 'UNDER_REVIEW': return 'info';
    case 'NEEDS_FIX':    return 'warning';
    default:             return 'inactive';
  }
}

/* ══════════════════════════════════════════════════════════════ */

export function PendingDriversPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'SUBMITTED' | 'NEEDS_FIX' | 'UNDER_REVIEW'>('ALL');

  const { data: raw, isLoading, error, refetch } = useApiQuery<ApiDriver[]>(
    () => fetchPendingDrivers(), [],
  );

  const drivers = raw ?? [];
  const submitted   = drivers.filter(d => d.applicationStatus === 'SUBMITTED').length;
  const needsFix    = drivers.filter(d => d.applicationStatus === 'NEEDS_FIX').length;
  const underReview = drivers.filter(d => d.applicationStatus === 'UNDER_REVIEW').length;

  const filtered = filter === 'ALL'
    ? drivers
    : drivers.filter(d => d.applicationStatus === filter);

  /* ── Columns ──────────────────────────────────────────────── */
  const columns: Column<ApiDriver>[] = [
    {
      key: 'applicant',
      label: 'Applicant',
      sortable: true,
      sortValue: (d) => d.user?.name ?? '',
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <UserCheck size={14} className="text-[var(--primary)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
              {d.user?.name ?? 'Unknown'}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] truncate">
              {d.user?.phone}
              {d.licenseNumber ? ` · ${d.licenseNumber}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      render: (d) => {
        const v = d.vehicle;
        if (!v) return <span className="text-[12px] text-[var(--muted-foreground)]">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <Car size={13} className="text-[var(--muted-foreground)] shrink-0" />
            <span className="text-[12px] text-[var(--foreground)]">
              {v.vehicleType} · {v.make} {v.model}
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              {v.plateNumber}
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (d) => d.applicationStatus,
      render: (d) => {
        const isResubmission = d.applicationStatus === 'SUBMITTED' && !!d.adminNotes;
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={statusVariant(d.applicationStatus)} label={d.applicationStatus} size="sm" />
            {isResubmission && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                style={{ fontWeight: 500 }}>Resubmitted</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'submitted',
      label: 'Submitted',
      sortable: true,
      sortValue: (d) => new Date(d.updatedAt ?? d.createdAt).getTime(),
      render: (d) => {
        const ts = d.updatedAt ?? d.createdAt;
        return (
          <div>
            <span className="text-[12px] text-[var(--foreground)]">{timeAgo(ts)}</span>
            <p className="text-[11px] text-[var(--muted-foreground)]">{formatDate(ts)}</p>
          </div>
        );
      },
    },
    {
      key: 'action',
      label: '',
      width: '40px',
      render: () => <ChevronRight size={14} className="text-[var(--muted-foreground)]" />,
    },
  ];

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="p-6">
      <PageHeader
        title="Pending Driver Applications"
        description={`${drivers.length} application${drivers.length !== 1 ? 's' : ''} awaiting review`}
        actions={
          <button onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            style={{ fontWeight: 500 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* ── Summary cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',        count: drivers.length, icon: Users,         color: 'text-[var(--foreground)]', key: 'ALL' as const },
          { label: 'Submitted',    count: submitted,      icon: Clock,         color: 'text-blue-500',            key: 'SUBMITTED' as const },
          { label: 'Needs Fix',    count: needsFix,       icon: AlertTriangle, color: 'text-amber-500',           key: 'NEEDS_FIX' as const },
          { label: 'Under Review', count: underReview,    icon: Eye,           color: 'text-violet-500',          key: 'UNDER_REVIEW' as const },
        ].map(c => (
          <button key={c.key} onClick={() => setFilter(f => f === c.key ? 'ALL' : c.key)}
            className={`bg-[var(--card)] border rounded-xl p-4 text-left transition-all ${
              filter === c.key
                ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} className={c.color} />
              <span className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{c.label}</span>
            </div>
            <p className="text-[24px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{c.count}</p>
          </button>
        ))}
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error}</span>
          <button onClick={() => refetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {isLoading && !raw && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading pending applications…</span>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      {(!isLoading || raw) && (
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(d) => String(d.id)}
          onRowClick={(d) => navigate(`/drivers/pending/${d.id}`)}
          pageSize={20}
          emptyTitle={filter !== 'ALL' ? `No ${filter.replace('_', ' ').toLowerCase()} applications` : 'No pending applications'}
          emptyMessage="All driver applications have been reviewed. Check back later."
        />
      )}
    </div>
  );
}
