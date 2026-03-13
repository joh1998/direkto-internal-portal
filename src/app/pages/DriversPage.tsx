import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Eye, Star, ShieldCheck, ShieldAlert, RefreshCw, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useAuth } from '../context/AuthContext';
import { canApprove } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchDrivers, reviewDriver, suspendDriver, reactivateDriver,
  type ApiDriver, type DriverSearchParams,
} from '../lib/drivers-api';
import type { PaginatedResponse } from '../lib/users-api';

/* ── helpers ─────────────────────────────────────────────────── */
function getDriverStatus(d: ApiDriver): string {
  if (!d.isVerified && d.status !== 'SUSPENDED') return 'pending';
  if (d.status === 'SUSPENDED') return 'suspended';
  if (d.status === 'ONLINE') return 'active';
  if (d.status === 'ON_TRIP') return 'active';
  return 'inactive'; // OFFLINE
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DriversPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject' | 'suspend' | 'reactivate';
    target: ApiDriver;
  } | null>(null);

  const canDoApprove = user ? canApprove(user.role, 'drivers') : false;

  /* ── API data ─────────────────────────────────────────────── */
  const params: DriverSearchParams = { search: search || undefined, page, limit: 20 };
  if (statusFilter === 'all') params.isVerified = true;
  else if (statusFilter !== 'all') params.status = statusFilter.toUpperCase();

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ApiDriver>>(
    () => fetchDrivers(params),
    [search, statusFilter, page],
  );

  const drivers = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  /* ── actions ──────────────────────────────────────────────── */
  async function executeAction() {
    if (!confirmAction) return;
    const { type, target } = confirmAction;
    try {
      if (type === 'approve') await reviewDriver(target.id, 'APPROVED');
      else if (type === 'reject') await reviewDriver(target.id, 'REJECTED');
      else if (type === 'suspend') await suspendDriver(target.id, 'Suspended from admin');
      else if (type === 'reactivate') await reactivateDriver(target.id);
      const label = type === 'approve' ? 'approved' : type === 'reject' ? 'rejected' : type === 'suspend' ? 'suspended' : 'reactivated';
      toast.success(`${target.user?.name ?? 'Driver'} has been ${label}`);
      setConfirmAction(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }

  /* ── table columns ────────────────────────────────────────── */
  const columns: Column<ApiDriver>[] = [
    {
      key: 'name',
      label: 'Driver',
      sortable: true,
      sortValue: (d) => d.user?.name ?? '',
      render: (d) => (
        <div>
          <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{d.user?.name ?? '—'}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{d.publicId} &middot; {d.licenseNumber || 'No license'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (d) => getDriverStatus(d),
      render: (d) => <StatusBadge status={getDriverStatus(d)} />,
    },
    {
      key: 'rating',
      label: 'Rating',
      align: 'center',
      sortable: true,
      sortValue: (d) => parseFloat(d.rating) || 0,
      render: (d) => {
        const r = parseFloat(d.rating);
        return r > 0 ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-[var(--foreground)]">
            <Star size={12} className="text-amber-500 fill-amber-500" aria-hidden="true" />
            {r.toFixed(1)}
          </span>
        ) : (
          <span className="text-[12px] text-[var(--muted-foreground)]">—</span>
        );
      },
    },
    {
      key: 'trips',
      label: 'Trips',
      align: 'right',
      sortable: true,
      sortValue: (d) => d.totalTrips,
      render: (d) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{d.totalTrips > 0 ? d.totalTrips.toLocaleString() : '—'}</span>,
    },
    {
      key: 'earnings',
      label: 'Earnings',
      align: 'right',
      sortable: true,
      sortValue: (d) => parseFloat(d.totalEarnings) || 0,
      render: (d) => {
        const e = parseFloat(d.totalEarnings) || 0;
        return <span className="text-[13px] tabular-nums text-[var(--foreground)]">{e > 0 ? `₱${e.toLocaleString()}` : '—'}</span>;
      },
    },
    {
      key: 'verified',
      label: 'Verified',
      align: 'center',
      render: (d) => d.isVerified ? (
        <ShieldCheck size={14} className="inline text-emerald-600" aria-label="Verified" />
      ) : (
        <ShieldAlert size={14} className="inline text-amber-500" aria-label="Unverified" />
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Drivers"
        description={`${total} total drivers`}
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <FilterBar
        searchPlaceholder="Search by name or ID..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Online', value: 'online' },
              { label: 'Offline', value: 'offline' },
              { label: 'Suspended', value: 'suspended' },
            ],
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
          },
        ]}
      />

      {/* Error state */}
      {error && (
        <div className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error}</span>
          <button onClick={() => refetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading drivers…</span>
        </div>
      )}

      {!isLoading || data ? (
        <div className="mt-4">
          <DataTable
            data={drivers}
            columns={columns}
            keyExtractor={(d) => String(d.id)}
            onRowClick={(d) => navigate(`/drivers/${d.id}`)}
            pageSize={20}
            emptyTitle="No drivers found"
            emptyMessage="Try adjusting your search or filter criteria."
            rowActions={(d) => (
              <div className="flex items-center justify-center gap-1">
                <button onClick={() => navigate(`/drivers/${d.id}`)} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View ${d.user?.name}`}>
                  <Eye size={14} className="text-[var(--muted-foreground)]" />
                </button>
                {canDoApprove && !d.isVerified && d.status !== 'SUSPENDED' && (
                  <button onClick={() => setConfirmAction({ type: 'approve', target: d })} className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label={`Approve ${d.user?.name}`}>
                    <CheckCircle size={14} className="text-emerald-600" />
                  </button>
                )}
              </div>
            )}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        objectId={confirmAction?.target ? String(confirmAction.target.id) : undefined}
        title={
          confirmAction?.type === 'approve' ? 'Approve Driver' :
          confirmAction?.type === 'reject' ? 'Reject Driver' :
          confirmAction?.type === 'suspend' ? 'Suspend Driver' :
          'Reactivate Driver'
        }
        message={
          confirmAction?.type === 'approve'
            ? `Approve ${confirmAction.target?.user?.name ?? 'this driver'}? They will be able to accept trips immediately.`
            : confirmAction?.type === 'reject'
            ? `Reject ${confirmAction.target?.user?.name ?? 'this driver'}? This decision can be reversed.`
            : confirmAction?.type === 'suspend'
            ? `Suspend ${confirmAction.target?.user?.name ?? 'this driver'}? They will not be able to accept new trips.`
            : `Reactivate ${confirmAction?.target?.user?.name ?? 'this driver'}? They will be able to accept trips again.`
        }
        confirmLabel={
          confirmAction?.type === 'approve' ? 'Approve' :
          confirmAction?.type === 'reject' ? 'Reject' :
          confirmAction?.type === 'suspend' ? 'Suspend' : 'Reactivate'
        }
        variant={confirmAction?.type === 'suspend' || confirmAction?.type === 'reject' ? 'danger' : 'default'}
      />
    </div>
  );
}