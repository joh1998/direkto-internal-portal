import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Eye, Ban, UserCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import { fetchUsers, toggleUserBan, type ApiUser, type PaginatedResponse } from '../lib/users-api';

export function UsersPage() {
  const { user: admin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'ban' | 'unban'; target: ApiUser } | null>(null);

  const canDoEdit = admin ? canEdit(admin.role, 'users') : false;

  const apiStatus = statusFilter === 'all' ? undefined : statusFilter === 'active' ? 'ACTIVE' as const : 'BANNED' as const;

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ApiUser>>(
    () => fetchUsers({ search: search || undefined, status: apiStatus, page, limit: 20 }),
    [search, statusFilter, page],
  );

  const users = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  // Map API status for badges
  function getUserStatus(u: ApiUser): string {
    return u.isBanned ? 'banned' : 'active';
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function executeAction() {
    if (!confirmAction) return;
    try {
      const isBan = confirmAction.type === 'ban';
      await toggleUserBan(Number(confirmAction.target.id), isBan, isBan ? 'Banned by admin' : undefined);
      toast.success(`${confirmAction.target.fullName || 'User'} has been ${isBan ? 'banned' : 'unbanned'}`);
      setConfirmAction(null);
      setSelected(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  }

  const columns: Column<ApiUser>[] = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      sortValue: (u) => u.fullName || '',
      render: (u) => (
        <div>
          <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{u.fullName || 'Unnamed'}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{u.email || u.phoneNumber}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (u) => getUserStatus(u),
      render: (u) => <StatusBadge status={getUserStatus(u)} />,
    },
    {
      key: 'trips',
      label: 'Trips',
      align: 'right',
      sortable: true,
      sortValue: (u) => u.totalTrips,
      render: (u) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{u.totalTrips}</span>,
    },
    {
      key: 'rentals',
      label: 'Rentals',
      align: 'right',
      sortable: true,
      sortValue: (u) => u.totalRentals,
      render: (u) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{u.totalRentals}</span>,
    },
    {
      key: 'spent',
      label: 'Total Spent',
      align: 'right',
      sortable: true,
      sortValue: (u) => u.totalSpent,
      render: (u) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">₱{u.totalSpent.toLocaleString()}</span>,
    },
    {
      key: 'joined',
      label: 'Joined',
      align: 'right',
      render: (u) => <span className="text-[12px] text-[var(--muted-foreground)]">{formatDate(u.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Users"
        description={`${total} registered users`}
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
        searchPlaceholder="Search users..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        filters={[{
          key: 'status', label: 'Status',
          options: [{ label: 'Active', value: 'active' }, { label: 'Banned', value: 'banned' }],
          value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(1); },
        }]}
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
          <span className="text-[13px]">Loading users…</span>
        </div>
      )}

      {!isLoading || data ? (
        <div className="mt-4">
          <DataTable
            data={users}
            columns={columns}
            keyExtractor={(u) => u.id}
            onRowClick={(u) => setSelected(u)}
            pageSize={20}
            emptyTitle="No users found"
            emptyMessage="Try adjusting your search or filter."
            rowActions={(u) => (
              <div className="flex items-center justify-center gap-1">
                <button onClick={() => setSelected(u)} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View ${u.fullName}`}>
                  <Eye size={14} className="text-[var(--muted-foreground)]" />
                </button>
                {canDoEdit && !u.isBanned && (
                  <button onClick={() => setConfirmAction({ type: 'ban', target: u })} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Ban ${u.fullName}`}>
                    <Ban size={14} className="text-red-500" />
                  </button>
                )}
                {canDoEdit && u.isBanned && (
                  <button onClick={() => setConfirmAction({ type: 'unban', target: u })} className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label={`Unban ${u.fullName}`}>
                    <UserCheck size={14} className="text-emerald-600" />
                  </button>
                )}
              </div>
            )}
          />
        </div>
      ) : null}

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.fullName || 'User'}
        subtitle={`ID: ${selected?.id}`}
        actions={
          selected && canDoEdit ? (
            !selected.isBanned ? (
              <button onClick={() => setConfirmAction({ type: 'ban', target: selected })} className="py-2 px-4 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950" style={{ fontWeight: 500 }}>Ban User</button>
            ) : (
              <button onClick={() => setConfirmAction({ type: 'unban', target: selected })} className="py-2 px-4 text-[13px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700" style={{ fontWeight: 500 }}>Unban User</button>
            )
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <StatusBadge status={getUserStatus(selected)} size="md" />
              <span className="text-[12px] text-[var(--muted-foreground)]">Joined {formatDate(selected.createdAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Email', value: selected.email || 'N/A' },
                { label: 'Phone', value: selected.phoneNumber },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
                  <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
                </div>
              ))}
            </div>
            {selected.isBanned && selected.banReason && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-[11px] text-red-600 dark:text-red-400 mb-0.5" style={{ fontWeight: 500 }}>Ban Reason</p>
                <p className="text-[13px] text-red-700 dark:text-red-300">{selected.banReason}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--accent)]/50 rounded-lg p-3">
                <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Trips</p>
                <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{selected.totalTrips}</p>
              </div>
              <div className="bg-[var(--accent)]/50 rounded-lg p-3">
                <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Rentals</p>
                <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>{selected.totalRentals}</p>
              </div>
              <div className="bg-[var(--accent)]/50 rounded-lg p-3">
                <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Total Spent</p>
                <p className="text-[18px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>₱{selected.totalSpent.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        title={confirmAction?.type === 'ban' ? 'Ban User' : 'Unban User'}
        objectId={confirmAction?.target?.id}
        message={confirmAction?.type === 'ban' ? `Ban ${confirmAction?.target.fullName}? They will not be able to book trips.` : `Unban ${confirmAction?.target.fullName}? They will regain full access.`}
        confirmLabel={confirmAction?.type === 'ban' ? 'Ban User' : 'Unban User'}
        variant={confirmAction?.type === 'ban' ? 'danger' : 'default'}
      />
    </div>
  );
}