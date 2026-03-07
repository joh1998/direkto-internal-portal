// ── Merchants List Page ──────────────────────────────────────
// Replaces the monolithic MerchantsPage. Shows all merchants + onboarding queue.
// Clicking a row navigates to /merchants/:id (detail page).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle, XCircle, Eye, RefreshCw, AlertCircle, Loader2,
  Store, Clock, MapPin, Star,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FilterBar } from '../../components/shared/FilterBar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { useAuth } from '../../context/AuthContext';
import { canApprove, canEdit as canEditPerm, canExport } from '../../lib/permissions';
import { useApiQuery } from '../../hooks/useApiQuery';
import {
  fetchMerchants, fetchPendingMerchants,
  type ApiMerchant, type MerchantSearchParams,
} from '../../lib/merchants-api';
import type { PaginatedResponse } from '../../lib/users-api';
import { getMerchantStatus, timeAgo, peso } from './helpers';
import { ActionModal, type ActionType } from './components/ActionModal';

export function MerchantsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  const canDoApprove = role ? canApprove(role, 'merchants') : false;
  const canDoEdit    = role ? canEditPerm(role, 'merchants') : false;

  // ── Tab ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'onboarding'>('all');

  // ── List / filter state ────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [page, setPage] = useState(1);

  // ── Action modal ───────────────────────────────────────────
  const [actionModal, setActionModal] = useState<{
    type: ActionType;
    target: ApiMerchant;
  } | null>(null);

  // ── API: all merchants ─────────────────────────────────────
  const params: MerchantSearchParams = { search: search || undefined, page, limit: 20 };
  if (statusFilter === 'pending') params.verificationStatus = 'PENDING';
  else if (statusFilter === 'rejected') params.verificationStatus = 'REJECTED';
  else if (statusFilter === 'active') params.status = 'ACTIVE';
  else if (statusFilter === 'suspended') params.status = 'INACTIVE';
  if (municipalityFilter !== 'all') params.municipality = municipalityFilter;

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ApiMerchant>>(
    () => fetchMerchants(params),
    [search, statusFilter, municipalityFilter, page],
    { enabled: activeTab === 'all' },
  );
  const allMerchants = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const municipalities = [...new Set(allMerchants.map(m => m.municipality).filter(Boolean))].sort();

  // ── API: pending queue ─────────────────────────────────────
  const { data: pendingList, isLoading: pendingLoading, error: pendingError, refetch: refetchPending } =
    useApiQuery<ApiMerchant[]>(() => fetchPendingMerchants(), [], { enabled: activeTab === 'onboarding' });
  const pendingMerchants = pendingList ?? [];

  // ── Table columns ──────────────────────────────────────────
  const columns: Column<ApiMerchant>[] = [
    {
      key: 'name', label: 'Merchant', sortable: true, sortValue: m => m.businessName,
      render: m => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <Store size={14} className="text-[var(--primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.businessName}</p>
              {m.isFeatured && <Star size={11} className="text-amber-500 fill-amber-500" />}
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPerson} · {m.municipality || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type', sortable: true, sortValue: m => m.businessType || '',
      render: m => <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{m.businessType || 'N/A'}</span>,
    },
    {
      key: 'status', label: 'Status', sortable: true, sortValue: m => getMerchantStatus(m),
      render: m => <StatusBadge status={getMerchantStatus(m)} />,
    },
    {
      key: 'revenue', label: 'Revenue', align: 'right' as const, sortable: true, sortValue: m => parseFloat(m.totalRevenue) || 0,
      render: m => { const r = parseFloat(m.totalRevenue) || 0; return <span className="text-[13px] tabular-nums text-[var(--foreground)]">{r > 0 ? peso(r) : '—'}</span>; },
    },
    {
      key: 'commission', label: 'Commission', align: 'right' as const, sortable: true,
      sortValue: m => parseFloat(m.commissionRateOverride || m.contractedCommissionRate) || 0,
      render: m => {
        const hasOverride = m.commissionRateOverride !== null && m.commissionRateOverride !== undefined;
        const rate = hasOverride ? parseFloat(m.commissionRateOverride!) : parseFloat(m.contractedCommissionRate);
        return (
          <span className={`text-[13px] tabular-nums ${hasOverride ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--foreground)]'}`}>
            {rate || 0}%{hasOverride && <span className="text-[9px] ml-0.5 opacity-60">ovr</span>}
          </span>
        );
      },
    },
    {
      key: 'bookings', label: 'Bookings', align: 'right' as const, sortable: true, sortValue: m => m.totalBookings,
      render: m => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{m.totalBookings > 0 ? m.totalBookings.toLocaleString() : '—'}</span>,
    },
  ];

  const onboardingColumns: Column<ApiMerchant>[] = [
    {
      key: 'name', label: 'Merchant', sortable: true, sortValue: m => m.businessName,
      render: m => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.businessName}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPerson}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type',
      render: m => <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{m.businessType || 'N/A'}</span>,
    },
    {
      key: 'municipality', label: 'Location',
      render: m => <div className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]"><MapPin size={12} />{m.municipality || 'N/A'}</div>,
    },
    {
      key: 'contact', label: 'Contact',
      render: m => <div><p className="text-[12px] text-[var(--foreground)]">{m.contactEmail}</p><p className="text-[11px] text-[var(--muted-foreground)]">{m.contactPhone}</p></div>,
    },
    {
      key: 'applied', label: 'Applied', sortable: true, sortValue: m => new Date(m.createdAt).getTime(),
      render: m => <span className="text-[12px] text-[var(--muted-foreground)]">{timeAgo(m.createdAt)}</span>,
    },
  ];

  // ── Helpers ────────────────────────────────────────────────
  const activeRefetch = activeTab === 'all' ? refetch : refetchPending;
  const activeError = activeTab === 'all' ? error : pendingError;
  const activeLoading = activeTab === 'all' ? isLoading : pendingLoading;
  const activeData = activeTab === 'all' ? data : pendingList;

  function quickAction(e: React.MouseEvent, type: ActionType, m: ApiMerchant) {
    e.stopPropagation();
    setActionModal({ type, target: m });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Merchants"
        description={activeTab === 'all' ? `${total} total merchants` : `${pendingMerchants.length} pending applications`}
        actions={
          <div className="flex items-center gap-2">
            {role && (
              <span className="text-[11px] text-[var(--muted-foreground)] bg-[var(--accent)] px-2 py-1 rounded" style={{ fontWeight: 500 }}>
                {canDoEdit ? '✏️ Can edit' : canDoApprove ? '✅ Can approve' : '👁 View only'}
              </span>
            )}
            <button onClick={() => activeRefetch()}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
              style={{ fontWeight: 500 }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-[var(--accent)] rounded-lg w-fit">
        {([
          { key: 'all' as const, label: 'All Merchants', icon: Store },
          { key: 'onboarding' as const, label: 'Onboarding', icon: Clock },
        ]).map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); setSearch(''); setStatusFilter('all'); setMunicipalityFilter('all'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md transition-colors ${activeTab === tab.key ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            style={{ fontWeight: 500 }}>
            <tab.icon size={14} />
            {tab.label}
            {tab.key === 'onboarding' && pendingMerchants.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full" style={{ fontWeight: 600 }}>{pendingMerchants.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab === 'all' && (
        <FilterBar
          searchPlaceholder="Search by name, email, or phone..."
          searchValue={search}
          onSearchChange={v => { setSearch(v); setPage(1); }}
          filters={[
            {
              key: 'status', label: 'Status',
              options: [
                { label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' },
                { label: 'Suspended', value: 'suspended' }, { label: 'Rejected', value: 'rejected' },
              ],
              value: statusFilter, onChange: v => { setStatusFilter(v); setPage(1); },
            },
            ...(municipalities.length > 0 ? [{
              key: 'municipality', label: 'Municipality',
              options: municipalities.map(m => ({ label: m, value: m })),
              value: municipalityFilter, onChange: (v: string) => { setMunicipalityFilter(v); setPage(1); },
            }] : []),
          ]}
        />
      )}

      {/* Error */}
      {activeError && (
        <div className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} /><span className="text-[13px]">{activeError}</span>
          <button onClick={() => activeRefetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {activeLoading && !activeData && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" /><span className="text-[13px]">Loading merchants…</span>
        </div>
      )}

      {/* All Merchants table */}
      {activeTab === 'all' && (!activeLoading || data) && (
        <div className="mt-4">
          <DataTable
            data={allMerchants}
            columns={columns}
            keyExtractor={m => String(m.id)}
            onRowClick={m => navigate(`/merchants/${m.id}`)}
            pageSize={20}
            emptyTitle="No merchants found"
            emptyMessage="Try adjusting your filters."
            rowActions={m => (
              <div className="flex items-center justify-center gap-1">
                <button onClick={e => { e.stopPropagation(); navigate(`/merchants/${m.id}`); }}
                  className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View ${m.businessName}`}>
                  <Eye size={14} className="text-[var(--muted-foreground)]" />
                </button>
                {canDoApprove && m.verificationStatus === 'PENDING' && (
                  <>
                    <button onClick={e => quickAction(e, 'approve', m)} className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label={`Approve ${m.businessName}`}>
                      <CheckCircle size={14} className="text-emerald-600" />
                    </button>
                    <button onClick={e => quickAction(e, 'reject', m)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Reject ${m.businessName}`}>
                      <XCircle size={14} className="text-red-600" />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* Onboarding queue */}
      {activeTab === 'onboarding' && (!pendingLoading || pendingList) && (
        <div className="mt-4">
          {pendingMerchants.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4"><CheckCircle size={28} className="text-emerald-500" /></div>
              <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>All caught up!</h3>
              <p className="text-[13px] text-[var(--muted-foreground)] mt-1">No pending merchant applications to review.</p>
            </div>
          ) : (
            <DataTable
              data={pendingMerchants}
              columns={onboardingColumns}
              keyExtractor={m => String(m.id)}
              onRowClick={m => navigate(`/merchants/${m.id}`)}
              pageSize={50}
              emptyTitle="No pending merchants"
              emptyMessage=""
              rowActions={m => (
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); navigate(`/merchants/${m.id}`); }}
                    className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`Review ${m.businessName}`}>
                    <Eye size={14} className="text-[var(--muted-foreground)]" />
                  </button>
                  {canDoApprove && (
                    <>
                      <button onClick={e => quickAction(e, 'approve', m)} className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label={`Approve ${m.businessName}`}>
                        <CheckCircle size={14} className="text-emerald-600" />
                      </button>
                      <button onClick={e => quickAction(e, 'reject', m)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Reject ${m.businessName}`}>
                        <XCircle size={14} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              )}
            />
          )}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <ActionModal
          type={actionModal.type}
          merchant={actionModal.target}
          onClose={() => setActionModal(null)}
          onComplete={() => { setActionModal(null); refetch(); refetchPending(); }}
        />
      )}
    </div>
  );
}
