// ── Markets List Page ─────────────────────────────────────────
// Shows all markets with status, fare plan count, and surge indicator.
// Clicking a row navigates to /markets/:id (detail page).
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  RefreshCw, AlertCircle, Loader2, Plus, Globe, Zap, MapPin, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DataTable, type Column } from '../components/shared/DataTable';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { canEdit as canEditPerm } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchMarkets, createMarket, deleteMarket,
  type Market, type CreateMarketDto,
} from '../lib/markets-api';
import { poiApi, type ServiceArea } from '../lib/poi-api';
import type { Role } from '../lib/permissions';

/* ── helpers ─────────────────────────────────────────────────── */
function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MarketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as Role | undefined;
  const canDoEdit = role ? canEditPerm(role, 'settings') : false;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Market | null>(null);
  const [creating, setCreating] = useState(false);
  const [serviceAreasList, setServiceAreasList] = useState<ServiceArea[]>([]);

  // ── Form state ─────────────────────────────────────────────
  const [form, setForm] = useState<CreateMarketDto>({
    slug: '', displayName: '', centerLat: 0, centerLng: 0,
    currency: 'PHP', timezone: 'Asia/Manila', radiusKm: 30,
    description: '', isActive: true, serviceAreaId: undefined,
  });

  // ── Load service areas when create modal opens ──────────────
  useEffect(() => {
    if (showCreate && serviceAreasList.length === 0) {
      poiApi.listServiceAreas().then(setServiceAreasList).catch(() => {});
    }
  }, [showCreate]);

  // ── API data ───────────────────────────────────────────────
  const { data: markets, isLoading, error, refetch } = useApiQuery<Market[]>(
    () => fetchMarkets(),
    [],
  );

  const filtered = (markets ?? []).filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (!m.displayName.toLowerCase().includes(q) && !m.slug.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === 'active' && !m.isActive) return false;
    if (statusFilter === 'inactive' && m.isActive) return false;
    if (statusFilter === 'surge' && parseFloat(m.surgeMultiplier) <= 1) return false;
    return true;
  });

  // ── actions ────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.slug || !form.displayName) {
      toast.error('Slug and display name are required');
      return;
    }
    setCreating(true);
    try {
      const created = await createMarket(form);
      toast.success(`Market "${created.displayName}" created`);
      setShowCreate(false);
      setForm({ slug: '', displayName: '', centerLat: 0, centerLng: 0, currency: 'PHP', timezone: 'Asia/Manila', radiusKm: 30, description: '', isActive: true, serviceAreaId: undefined });
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create market');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMarket(deleteTarget.id);
      toast.success(`Market "${deleteTarget.displayName}" deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete market');
    }
  }

  // ── table columns ─────────────────────────────────────────
  const columns: Column<Market>[] = [
    {
      key: 'name',
      label: 'Market',
      sortable: true,
      sortValue: (m) => m.displayName,
      render: (m) => (
        <div>
          <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.displayName}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{m.slug} · {m.currency}</p>
        </div>
      ),
    },
    {
      key: 'serviceArea',
      label: 'Service Area',
      sortable: true,
      sortValue: (m) => m.serviceArea?.name ?? '',
      render: (m) => m.serviceArea?.name
        ? <span className="text-[12px] text-[var(--foreground)]">{m.serviceArea.name}</span>
        : <span className="text-[11px] text-[var(--muted-foreground)] italic">None</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (m) => m.isActive ? 'active' : 'inactive',
      render: (m) => <StatusBadge status={m.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'center',
      label: 'Center',
      render: (m) => (
        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--muted-foreground)]">
          <MapPin size={12} />
          {parseFloat(m.centerLat).toFixed(4)}, {parseFloat(m.centerLng).toFixed(4)}
        </span>
      ),
    },
    {
      key: 'radius',
      label: 'Radius',
      align: 'right',
      sortable: true,
      sortValue: (m) => parseFloat(m.radiusKm),
      render: (m) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{parseFloat(m.radiusKm)} km</span>,
    },
    {
      key: 'surge',
      label: 'Surge',
      align: 'center',
      sortable: true,
      sortValue: (m) => parseFloat(m.surgeMultiplier),
      render: (m) => {
        const s = parseFloat(m.surgeMultiplier);
        return s > 1 ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-amber-600 dark:text-amber-400" style={{ fontWeight: 600 }}>
            <Zap size={12} className="fill-amber-500" /> {s.toFixed(1)}×
          </span>
        ) : (
          <span className="text-[12px] text-[var(--muted-foreground)]">1.0×</span>
        );
      },
    },
    {
      key: 'farePlans',
      label: 'Fare Plans',
      align: 'center',
      sortable: true,
      sortValue: (m) => m.farePlans?.length ?? 0,
      render: (m) => (
        <span className="inline-flex items-center gap-1 text-[13px] tabular-nums text-[var(--foreground)]">
          <DollarSign size={12} className="text-[var(--muted-foreground)]" />
          {m.farePlans?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'launch',
      label: 'Launch Date',
      sortable: true,
      sortValue: (m) => m.launchDate ?? '',
      render: (m) => <span className="text-[13px] text-[var(--foreground)]">{formatDate(m.launchDate)}</span>,
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Markets"
        description={`${filtered.length} market${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
            {canDoEdit && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ fontWeight: 500 }}
              >
                <Plus size={14} aria-hidden="true" />
                New Market
              </button>
            )}
          </div>
        }
      />

      <FilterBar
        searchPlaceholder="Search by name or slug..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
              { label: 'Surge Active', value: 'surge' },
            ],
            value: statusFilter,
            onChange: setStatusFilter,
          },
        ]}
      />

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
          <AlertCircle size={16} />
          <span className="text-[13px]">{error}</span>
          <button onClick={() => refetch()} className="ml-auto text-[13px] underline" style={{ fontWeight: 500 }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !markets && (
        <div className="mt-8 flex items-center justify-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading markets…</span>
        </div>
      )}

      {/* Table */}
      {(!isLoading || markets) && (
        <div className="mt-4">
          <DataTable
            data={filtered}
            columns={columns}
            keyExtractor={(m) => String(m.id)}
            onRowClick={(m) => navigate(`/markets/${m.id}`)}
            pageSize={20}
            emptyTitle="No markets found"
            emptyMessage={markets?.length === 0 ? 'Create your first market to get started.' : 'Try adjusting your search or filter.'}
          />
        </div>
      )}

      {/* ── Create Market Modal ───────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Create Market</h2>
              <button onClick={() => setShowCreate(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg">&times;</button>
            </div>

            <div className="space-y-4">
              {/* Row 1: slug + name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Slug *</label>
                  <input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="manila-metro"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Display Name *</label>
                  <input
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    placeholder="Metro Manila"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Description</label>
                <input
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="National Capital Region..."
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Service Area */}
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Service Area</label>
                <select
                  value={form.serviceAreaId ?? ''}
                  onChange={e => {
                    const saId = e.target.value || undefined;
                    const sa = serviceAreasList.find(s => s.id === saId);
                    setForm(f => ({
                      ...f,
                      serviceAreaId: saId,
                      ...(sa ? { timezone: sa.timezone } : {}),
                    }));
                  }}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                >
                  <option value="">None (manual boundary)</option>
                  {serviceAreasList.filter(s => s.is_active).map(sa => (
                    <option key={sa.id} value={sa.id}>{sa.name} ({sa.country})</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Links boundary, center &amp; timezone from the service area</p>
              </div>

              {/* Row 2: center coords + radius */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Center Lat *</label>
                  <input
                    type="number" step="any"
                    value={form.centerLat || ''}
                    onChange={e => setForm(f => ({ ...f, centerLat: parseFloat(e.target.value) || 0 }))}
                    placeholder="14.5995"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Center Lng *</label>
                  <input
                    type="number" step="any"
                    value={form.centerLng || ''}
                    onChange={e => setForm(f => ({ ...f, centerLng: parseFloat(e.target.value) || 0 }))}
                    placeholder="120.9842"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Radius (km)</label>
                  <input
                    type="number" step="0.5"
                    value={form.radiusKm ?? 30}
                    onChange={e => setForm(f => ({ ...f, radiusKm: parseFloat(e.target.value) || 30 }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
              </div>

              {/* Row 3: currency + timezone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Currency</label>
                  <input
                    value={form.currency ?? 'PHP'}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    maxLength={3}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Timezone</label>
                  <input
                    value={form.timezone ?? 'Asia/Manila'}
                    onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <span className="text-[13px] text-[var(--foreground)]">Active on creation</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 text-[13px] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--accent)] transition-colors"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2.5 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                {creating ? 'Creating…' : 'Create Market'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Market"
        message={`Are you sure you want to delete "${deleteTarget?.displayName}"? This will also remove all associated fare plans.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
