// ── Market Detail Page ────────────────────────────────────────
// Full-page detail view with sidebar tabs: Overview, Fare Plans, Surge, Settings.
// Pattern matches MerchantDetailPage / DriverDetailPage.
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Globe, MapPin, Zap, DollarSign,
  Plus, Pencil, Trash2, Save, X, LayoutDashboard, Car, Settings, AlertTriangle,
  CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { canEdit as canEditPerm } from '../lib/permissions';
import type { Role } from '../lib/permissions';
import {
  fetchMarketById, updateMarket, deleteMarket, setSurge,
  fetchFarePlans, createFarePlan, updateFarePlan, deleteFarePlan,
  fetchVehicleTypes, createVehicleType, updateVehicleType, deleteVehicleType,
  type Market, type FarePlan, type VehicleType, type UpdateMarketDto,
  type CreateFarePlanDto, type UpdateFarePlanDto,
  type CreateVehicleTypeDto, type UpdateVehicleTypeDto,
} from '../lib/markets-api';
import { poiApi, type ServiceArea } from '../lib/poi-api';

/* ── Types ──────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vehicle-types', label: 'Vehicle Types', icon: Car },
  { id: 'fare-plans', label: 'Fare Plans', icon: DollarSign },
  { id: 'surge', label: 'Surge', icon: Zap },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type TabId = (typeof TABS)[number]['id'];

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon?: React.ElementType }) {
  return (
    <div className="bg-[var(--accent)]/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{label}</p>
        {Icon && <Icon size={14} className="text-[var(--muted-foreground)]" />}
      </div>
      <p className="text-[20px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */
function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function peso(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role as Role | undefined;
  const canDoEdit = role ? canEditPerm(role, 'settings') : false;

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadMarket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMarketById(Number(id));
      setMarket(m);
    } catch (err: any) {
      setError(err?.message || 'Failed to load market');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadMarket(); }, [loadMarket]);

  async function handleDelete() {
    if (!market) return;
    try {
      await deleteMarket(market.id);
      toast.success(`Market "${market.displayName}" deleted`);
      navigate('/markets');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    }
  }

  // ── Loading / Error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="ml-2 text-[13px] text-[var(--muted-foreground)]">Loading market…</span>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle size={32} className="text-red-500" />
        <p className="text-[13px] text-[var(--muted-foreground)]">{error || 'Market not found'}</p>
        <button onClick={() => navigate('/markets')} className="text-[13px] text-[var(--primary)] underline">Back to Markets</button>
      </div>
    );
  }

  const surgeVal = parseFloat(market.surgeMultiplier);

  return (
    <div className="flex h-full">
      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <div className="w-[260px] min-w-[260px] bg-[var(--card)] border-r border-[var(--border)] flex flex-col">
        {/* Back + Header */}
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => navigate('/markets')} className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-3 transition-colors">
            <ArrowLeft size={14} /> Back to Markets
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} className="text-[var(--primary)]" />
            <h1 className="text-[16px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>{market.displayName}</h1>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mb-2">{market.slug} · {market.currency}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={market.isActive ? 'active' : 'inactive'} />
            {surgeVal > 1 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>
                <Zap size={10} className="fill-amber-500" /> {surgeVal.toFixed(1)}×
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="p-4 border-b border-[var(--border)] space-y-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Radius</span>
            <span className="text-[var(--foreground)] tabular-nums">{parseFloat(market.radiusKm)} km</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Fare Plans</span>
            <span className="text-[var(--foreground)] tabular-nums">{market.farePlans?.length ?? 0}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Vehicle Types</span>
            <span className="text-[var(--foreground)] tabular-nums">{market.vehicleTypes?.length ?? 0}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Timezone</span>
            <span className="text-[var(--foreground)]">{market.timezone}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Service Area</span>
            <span className="text-[var(--foreground)]">{market.serviceArea?.name ?? '—'}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--muted-foreground)]">Launch</span>
            <span className="text-[var(--foreground)]">{formatDate(market.launchDate)}</span>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 hover:text-[var(--foreground)]'
                }`}
                style={{ fontWeight: isActive ? 500 : 400 }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── CONTENT AREA ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && <OverviewTab market={market} />}
        {activeTab === 'vehicle-types' && <VehicleTypesTab market={market} canEdit={canDoEdit} onRefresh={loadMarket} />}
        {activeTab === 'fare-plans' && <FarePlansTab market={market} canEdit={canDoEdit} onRefresh={loadMarket} />}
        {activeTab === 'surge' && <SurgeTab market={market} canEdit={canDoEdit} onRefresh={loadMarket} />}
        {activeTab === 'settings' && <SettingsTab market={market} canEdit={canDoEdit} onRefresh={loadMarket} onDelete={() => setDeleteConfirm(true)} />}
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Market"
        message={`Permanently delete "${market.displayName}" and all its fare plans? This cannot be undone.`}
        confirmLabel="Delete Market"
        variant="danger"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════════ */
function OverviewTab({ market }: { market: Market }) {
  const surgeVal = parseFloat(market.surgeMultiplier);
  const activePlans = market.farePlans?.filter(p => p.isActive) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Overview</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Fare Plans" value={market.farePlans?.length ?? 0} sub={`${activePlans.length} active`} icon={DollarSign} />
        <StatCard label="Radius" value={`${parseFloat(market.radiusKm)} km`} icon={MapPin} />
        <StatCard label="Surge" value={`${surgeVal.toFixed(1)}×`} sub={market.surgeReason || 'No surge'} icon={Zap} />
        <StatCard label="Currency" value={market.currency} sub={market.timezone} icon={Globe} />
      </div>

      {/* Info grid */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-[13px] text-[var(--foreground)] mb-4" style={{ fontWeight: 600 }}>Market Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Display Name', value: market.displayName },
            { label: 'Slug', value: market.slug },
            { label: 'Service Area', value: market.serviceArea?.name || 'None (manual boundary)' },
            { label: 'Description', value: market.description || 'N/A' },
            { label: 'Center', value: `${parseFloat(market.centerLat).toFixed(6)}, ${parseFloat(market.centerLng).toFixed(6)}` },
            { label: 'Radius', value: `${parseFloat(market.radiusKm)} km` },
            { label: 'Currency', value: market.currency },
            { label: 'Timezone', value: market.timezone },
            { label: 'Launch Date', value: formatDate(market.launchDate) },
            { label: 'Created', value: formatDate(market.createdAt) },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
              <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Fare Plans preview */}
      {activePlans.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[13px] text-[var(--foreground)] mb-4" style={{ fontWeight: 600 }}>Active Fare Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePlans.map(plan => (
              <div key={plan.id} className="border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{plan.vehicleLabel}</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">{plan.vehicleType}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--muted-foreground)]">
                  <span>Base: {peso(plan.baseFare)}</span>
                  <span>·</span>
                  <span>{peso(plan.perKmRate)}/km</span>
                  <span>·</span>
                  <span>Min: {peso(plan.minFare)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VEHICLE TYPES TAB
   ═══════════════════════════════════════════════════════════════ */
function VehicleTypesTab({ market, canEdit, onRefresh }: { market: Market; canEdit: boolean; onRefresh: () => void }) {
  const [types, setTypes] = useState<VehicleType[]>(market.vehicleTypes ?? []);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<VehicleType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleType | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY_FORM: CreateVehicleTypeDto = {
    key: '', label: '', description: '', emoji: '', iconUrl: '',
    maxPassengers: 2, isActive: true, sortOrder: 0,
  };

  const [form, setForm] = useState<CreateVehicleTypeDto>(EMPTY_FORM);

  async function loadTypes() {
    setLoadingTypes(true);
    try {
      const t = await fetchVehicleTypes(market.id);
      setTypes(t);
    } catch { /* ignore */ } finally {
      setLoadingTypes(false);
    }
  }

  useEffect(() => { loadTypes(); }, [market.id]);

  function openEdit(vt: VehicleType) {
    setEditingType(vt);
    setForm({
      key: vt.key,
      label: vt.label,
      description: vt.description ?? '',
      emoji: vt.emoji ?? '',
      iconUrl: vt.iconUrl ?? '',
      maxPassengers: vt.maxPassengers,
      isActive: vt.isActive,
      sortOrder: vt.sortOrder,
    });
    setShowForm(true);
  }

  function openCreate() {
    setEditingType(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.key || !form.label) {
      toast.error('Key and label are required');
      return;
    }
    setSaving(true);
    try {
      if (editingType) {
        const { key, ...updateData } = form;
        await updateVehicleType(editingType.id, updateData as UpdateVehicleTypeDto);
        toast.success(`"${form.label}" updated`);
      } else {
        await createVehicleType(market.id, form);
        toast.success(`"${form.label}" created`);
      }
      setShowForm(false);
      setEditingType(null);
      await loadTypes();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save vehicle type');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteType() {
    if (!deleteTarget) return;
    try {
      await deleteVehicleType(deleteTarget.id);
      toast.success(`"${deleteTarget.label}" deleted`);
      setDeleteTarget(null);
      await loadTypes();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    }
  }

  const activeCount = types.filter(t => t.isActive).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Vehicle Types</h2>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            {types.length} total · {activeCount} active — define the vehicles available in this market
          </p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity" style={{ fontWeight: 500 }}>
            <Plus size={14} /> Add Vehicle Type
          </button>
        )}
      </div>

      {loadingTypes && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {!loadingTypes && types.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
          <Car size={32} className="mb-2 opacity-40" />
          <p className="text-[13px]">No vehicle types yet</p>
          <p className="text-[11px]">Add vehicle types this market offers (e.g. Bajaj, Motor, Car).</p>
        </div>
      )}

      {/* Vehicle types grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(vt => (
          <div key={vt.id} className={`bg-[var(--card)] border rounded-xl p-4 transition-all ${vt.isActive ? 'border-[var(--border)]' : 'border-dashed border-[var(--border)] opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{vt.emoji || '🚗'}</span>
                <div>
                  <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{vt.label}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{vt.key}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge status={vt.isActive ? 'active' : 'inactive'} />
              </div>
            </div>

            {vt.description && (
              <p className="text-[11px] text-[var(--muted-foreground)] mb-3">{vt.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[var(--accent)]/50 rounded-lg p-2">
                <p className="text-[10px] text-[var(--muted-foreground)]">Max Passengers</p>
                <p className="text-[14px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 500 }}>{vt.maxPassengers}</p>
              </div>
              <div className="bg-[var(--accent)]/50 rounded-lg p-2">
                <p className="text-[10px] text-[var(--muted-foreground)]">Sort Order</p>
                <p className="text-[14px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 500 }}>{vt.sortOrder}</p>
              </div>
            </div>

            {canEdit && (
              <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                <button onClick={() => openEdit(vt)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded-md transition-colors">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => setDeleteTarget(vt)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Vehicle Type Form Modal ───────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowForm(false); setEditingType(null); }}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                {editingType ? `Edit "${editingType.label}"` : 'New Vehicle Type'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingType(null); }} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg">&times;</button>
            </div>

            <div className="space-y-4">
              {/* Key + Label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Key *</label>
                  <input
                    value={form.key}
                    onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                    placeholder="BAJAJ"
                    disabled={!!editingType}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono disabled:opacity-50"
                  />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Unique within this market</p>
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Label *</label>
                  <input
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Bajaj"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>

              {/* Emoji + Max Passengers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Emoji</label>
                  <input
                    value={form.emoji ?? ''}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🛺"
                    maxLength={4}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Max Passengers</label>
                  <input
                    type="number"
                    min={1} max={20} step={1}
                    value={form.maxPassengers ?? 2}
                    onChange={e => setForm(f => ({ ...f, maxPassengers: parseInt(e.target.value) || 2 }))}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Description</label>
                <textarea
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Three-wheeled auto-rickshaw popular in Siargao"
                  rows={2}
                  maxLength={200}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                />
              </div>

              {/* Icon URL */}
              <div>
                <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Icon URL (optional)</label>
                <input
                  value={form.iconUrl ?? ''}
                  onChange={e => setForm(f => ({ ...f, iconUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Active + Sort Order */}
              <div className="flex items-center gap-6 pt-2 border-t border-[var(--border)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-[13px] text-[var(--foreground)]">Active</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Sort Order</label>
                  <input
                    type="number" step="1"
                    value={form.sortOrder ?? 0}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-1 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setEditingType(null); }}
                className="flex-1 py-2.5 text-[13px] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--accent)]"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                <Save size={14} />
                {saving ? 'Saving…' : editingType ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteType}
        title="Delete Vehicle Type"
        message={`Delete "${deleteTarget?.label}" (${deleteTarget?.key})? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FARE PLANS TAB
   ═══════════════════════════════════════════════════════════════ */
function FarePlansTab({ market, canEdit, onRefresh }: { market: Market; canEdit: boolean; onRefresh: () => void }) {
  const [plans, setPlans] = useState<FarePlan[]>(market.farePlans ?? []);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(market.vehicleTypes ?? []);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FarePlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FarePlan | null>(null);
  const [saving, setSaving] = useState(false);

  const EMPTY_FORM: CreateFarePlanDto = {
    vehicleType: '', vehicleLabel: '', baseFare: 0, perKmRate: 0, minFare: 0,
    vehicleDescription: '', maxPassengers: 2, baseDistanceKm: 2, perMinRate: 0,
    pickupFee: 0, roundTo: 5, commissionRate: 0.12, cancelFeeAssigned: 25,
    cancelFeeInProgress: 50, surgeCap: 1.5, isActive: true, sortOrder: 0,
    vehicleTypeId: undefined,
  };

  const [form, setForm] = useState<CreateFarePlanDto>(EMPTY_FORM);

  async function loadPlans() {
    setLoadingPlans(true);
    try {
      const [p, vt] = await Promise.all([
        fetchFarePlans(market.id, true),
        fetchVehicleTypes(market.id),
      ]);
      setPlans(p);
      setVehicleTypes(vt);
    } catch { /* ignore */ } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => { loadPlans(); }, [market.id]);

  function openEdit(plan: FarePlan) {
    setEditingPlan(plan);
    setForm({
      vehicleType: plan.vehicleType,
      vehicleLabel: plan.vehicleLabel,
      vehicleDescription: plan.vehicleDescription ?? '',
      maxPassengers: plan.maxPassengers,
      baseFare: parseFloat(plan.baseFare),
      baseDistanceKm: parseFloat(plan.baseDistanceKm),
      perKmRate: parseFloat(plan.perKmRate),
      perMinRate: parseFloat(plan.perMinRate),
      minFare: parseFloat(plan.minFare),
      pickupFee: parseFloat(plan.pickupFee),
      roundTo: parseFloat(plan.roundTo),
      commissionRate: parseFloat(plan.commissionRate),
      cancelFeeAssigned: parseFloat(plan.cancelFeeAssigned),
      cancelFeeInProgress: parseFloat(plan.cancelFeeInProgress),
      surgeCap: parseFloat(plan.surgeCap),
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      vehicleTypeId: plan.vehicleTypeId ?? undefined,
    });
    setShowForm(true);
  }

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.vehicleType || !form.vehicleLabel) {
      toast.error('Vehicle type and label are required');
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        const { vehicleType, ...updateData } = form;
        await updateFarePlan(editingPlan.id, updateData as UpdateFarePlanDto);
        toast.success(`"${form.vehicleLabel}" updated`);
      } else {
        await createFarePlan(market.id, form);
        toast.success(`"${form.vehicleLabel}" created`);
      }
      setShowForm(false);
      setEditingPlan(null);
      await loadPlans();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save fare plan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan() {
    if (!deleteTarget) return;
    try {
      await deleteFarePlan(deleteTarget.id);
      toast.success(`"${deleteTarget.vehicleLabel}" deleted`);
      setDeleteTarget(null);
      await loadPlans();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    }
  }

  // ── Number input helper ────────────────────────────────────
  function numInput(label: string, key: keyof CreateFarePlanDto, opts?: { step?: string; prefix?: string; suffix?: string }) {
    return (
      <div>
        <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>{label}</label>
        <div className="relative">
          {opts?.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted-foreground)]">{opts.prefix}</span>}
          <input
            type="number"
            step={opts?.step ?? '0.01'}
            value={(form[key] as number) ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
            className={`w-full py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums ${opts?.prefix ? 'pl-7 pr-3' : 'px-3'}`}
          />
          {opts?.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted-foreground)]">{opts.suffix}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Fare Plans</h2>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center gap-2 px-3 py-2 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity" style={{ fontWeight: 500 }}>
            <Plus size={14} /> Add Fare Plan
          </button>
        )}
      </div>

      {loadingPlans && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {!loadingPlans && plans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--muted-foreground)]">
          <DollarSign size={32} className="mb-2 opacity-40" />
          <p className="text-[13px]">No fare plans yet</p>
          <p className="text-[11px]">Create one to define pricing for this market.</p>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plans.map(plan => (
          <div key={plan.id} className={`bg-[var(--card)] border rounded-xl p-4 ${plan.isActive ? 'border-[var(--border)]' : 'border-dashed border-[var(--border)] opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Car size={14} className="text-[var(--primary)]" />
                  <span className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{plan.vehicleLabel}</span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{plan.vehicleType} · Max {plan.maxPassengers} pax</p>
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge status={plan.isActive ? 'active' : 'inactive'} />
                {canEdit && (
                  <>
                    <button onClick={() => openEdit(plan)} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label="Edit">
                      <Pencil size={13} className="text-[var(--muted-foreground)]" />
                    </button>
                    <button onClick={() => setDeleteTarget(plan)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label="Delete">
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {plan.vehicleDescription && (
              <p className="text-[11px] text-[var(--muted-foreground)] mb-3">{plan.vehicleDescription}</p>
            )}

            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div className="bg-[var(--accent)]/50 rounded-lg p-2">
                <p className="text-[10px] text-[var(--muted-foreground)]">Base Fare</p>
                <p className="text-[var(--foreground)] tabular-nums" style={{ fontWeight: 500 }}>{peso(plan.baseFare)}</p>
              </div>
              <div className="bg-[var(--accent)]/50 rounded-lg p-2">
                <p className="text-[10px] text-[var(--muted-foreground)]">Per km</p>
                <p className="text-[var(--foreground)] tabular-nums" style={{ fontWeight: 500 }}>{peso(plan.perKmRate)}</p>
              </div>
              <div className="bg-[var(--accent)]/50 rounded-lg p-2">
                <p className="text-[10px] text-[var(--muted-foreground)]">Min Fare</p>
                <p className="text-[var(--foreground)] tabular-nums" style={{ fontWeight: 500 }}>{peso(plan.minFare)}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-2 text-[11px] text-[var(--muted-foreground)]">
              <div>
                <p className="text-[10px]">Per min</p>
                <p className="text-[var(--foreground)] tabular-nums">{peso(plan.perMinRate)}</p>
              </div>
              <div>
                <p className="text-[10px]">Pickup</p>
                <p className="text-[var(--foreground)] tabular-nums">{peso(plan.pickupFee)}</p>
              </div>
              <div>
                <p className="text-[10px]">Commission</p>
                <p className="text-[var(--foreground)] tabular-nums">{(parseFloat(plan.commissionRate) * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px]">Surge Cap</p>
                <p className="text-[var(--foreground)] tabular-nums">{parseFloat(plan.surgeCap).toFixed(1)}×</p>
              </div>
            </div>

            {/* Effective dates */}
            {(plan.effectiveFrom || plan.effectiveUntil) && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--muted-foreground)]">
                <Clock size={10} />
                {plan.effectiveFrom && <span>From {formatDate(plan.effectiveFrom)}</span>}
                {plan.effectiveUntil && <span>Until {formatDate(plan.effectiveUntil)}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Fare Plan Form Modal ──────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowForm(false); setEditingPlan(null); }}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                {editingPlan ? `Edit "${editingPlan.vehicleLabel}"` : 'New Fare Plan'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingPlan(null); }} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg">&times;</button>
            </div>

            <div className="space-y-4">
              {/* Vehicle info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Vehicle Type *</label>
                  {vehicleTypes.length > 0 ? (
                    <select
                      value={form.vehicleTypeId ?? ''}
                      onChange={e => {
                        const vtId = e.target.value ? Number(e.target.value) : undefined;
                        const vt = vehicleTypes.find(v => v.id === vtId);
                        setForm(f => ({
                          ...f,
                          vehicleTypeId: vtId,
                          vehicleType: vt?.key ?? f.vehicleType,
                          vehicleLabel: vt?.label ?? f.vehicleLabel,
                          vehicleDescription: vt?.description ?? f.vehicleDescription,
                          maxPassengers: vt?.maxPassengers ?? f.maxPassengers,
                        }));
                      }}
                      disabled={!!editingPlan}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
                    >
                      <option value="">Select vehicle type...</option>
                      {vehicleTypes.filter(v => v.isActive).map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.emoji || ''} {vt.label} ({vt.key})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.vehicleType}
                      onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                      placeholder="MOTOR"
                      disabled={!!editingPlan}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
                    />
                  )}
                  {vehicleTypes.length === 0 && <p className="text-[10px] text-amber-500 mt-0.5">Add vehicle types first for dropdown</p>}
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Vehicle Label *</label>
                  <input
                    value={form.vehicleLabel}
                    onChange={e => setForm(f => ({ ...f, vehicleLabel: e.target.value }))}
                    placeholder="Habal-Habal"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Description</label>
                  <input
                    value={form.vehicleDescription ?? ''}
                    onChange={e => setForm(f => ({ ...f, vehicleDescription: e.target.value }))}
                    placeholder="Motorcycle taxi..."
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                {numInput('Max Passengers', 'maxPassengers', { step: '1' })}
              </div>

              {/* Pricing */}
              <p className="text-[12px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]" style={{ fontWeight: 600 }}>PRICING</p>
              <div className="grid grid-cols-3 gap-3">
                {numInput('Base Fare *', 'baseFare', { prefix: '₱' })}
                {numInput('Per km Rate *', 'perKmRate', { prefix: '₱' })}
                {numInput('Min Fare *', 'minFare', { prefix: '₱' })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {numInput('Per min Rate', 'perMinRate', { prefix: '₱' })}
                {numInput('Pickup Fee', 'pickupFee', { prefix: '₱' })}
                {numInput('Base Distance (km)', 'baseDistanceKm')}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {numInput('Round To', 'roundTo', { prefix: '₱' })}
                {numInput('Commission Rate', 'commissionRate', { step: '0.01' })}
                {numInput('Surge Cap', 'surgeCap', { suffix: '×' })}
              </div>

              {/* Cancel fees */}
              <p className="text-[12px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]" style={{ fontWeight: 600 }}>CANCELLATION</p>
              <div className="grid grid-cols-2 gap-3">
                {numInput('Cancel Fee (Assigned)', 'cancelFeeAssigned', { prefix: '₱' })}
                {numInput('Cancel Fee (In Progress)', 'cancelFeeInProgress', { prefix: '₱' })}
              </div>

              {/* Active + sort */}
              <div className="flex items-center gap-6 pt-2 border-t border-[var(--border)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                  <span className="text-[13px] text-[var(--foreground)]">Active</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Sort Order</label>
                  <input
                    type="number" step="1"
                    value={form.sortOrder ?? 0}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-16 px-2 py-1 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setEditingPlan(null); }}
                className="flex-1 py-2.5 text-[13px] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--accent)]"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                <Save size={14} />
                {saving ? 'Saving…' : editingPlan ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePlan}
        title="Delete Fare Plan"
        message={`Delete "${deleteTarget?.vehicleLabel}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SURGE TAB
   ═══════════════════════════════════════════════════════════════ */
function SurgeTab({ market, canEdit, onRefresh }: { market: Market; canEdit: boolean; onRefresh: () => void }) {
  const currentSurge = parseFloat(market.surgeMultiplier);
  const [multiplier, setMultiplier] = useState(currentSurge);
  const [reason, setReason] = useState(market.surgeReason ?? '');
  const [saving, setSaving] = useState(false);

  const hasChanges = multiplier !== currentSurge || reason !== (market.surgeReason ?? '');

  async function handleSave() {
    setSaving(true);
    try {
      await setSurge(market.id, multiplier, reason || undefined);
      toast.success(multiplier > 1 ? `Surge set to ${multiplier.toFixed(1)}×` : 'Surge cleared');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update surge');
    } finally {
      setSaving(false);
    }
  }

  const presets = [1.0, 1.2, 1.5, 1.8, 2.0, 2.5];

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Surge Pricing</h2>

      {/* Current surge status */}
      <div className={`p-5 rounded-xl border ${currentSurge > 1 ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30' : 'border-[var(--border)] bg-[var(--card)]'}`}>
        <div className="flex items-center gap-3 mb-2">
          <Zap size={20} className={currentSurge > 1 ? 'text-amber-500 fill-amber-500' : 'text-[var(--muted-foreground)]'} />
          <div>
            <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
              {currentSurge > 1 ? `Surge Active — ${currentSurge.toFixed(1)}×` : 'No Surge Active'}
            </p>
            {market.surgeReason && <p className="text-[12px] text-[var(--muted-foreground)]">{market.surgeReason}</p>}
          </div>
        </div>
      </div>

      {canEdit && (
        <>
          {/* Multiplier input */}
          <div>
            <label className="block text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 500 }}>Multiplier</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1" max="3" step="0.1"
                value={multiplier}
                onChange={e => setMultiplier(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
              />
              <span className="text-[18px] text-[var(--foreground)] tabular-nums w-16 text-center" style={{ fontWeight: 600 }}>
                {multiplier.toFixed(1)}×
              </span>
            </div>

            {/* Presets */}
            <div className="flex gap-2 mt-3">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setMultiplier(p)}
                  className={`px-3 py-1.5 text-[12px] rounded-lg border transition-colors ${
                    multiplier === p
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {p.toFixed(1)}×
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Reason (optional)</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. High demand, holiday, weather..."
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ fontWeight: 500 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Update Surge'}
          </button>

          {/* Quick clear */}
          {currentSurge > 1 && (
            <button
              onClick={() => { setMultiplier(1.0); setReason(''); }}
              className="flex items-center gap-2 px-4 py-2 text-[13px] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--accent)]"
              style={{ fontWeight: 500 }}
            >
              <X size={14} />
              Clear Surge
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS TAB
   ═══════════════════════════════════════════════════════════════ */
function SettingsTab({ market, canEdit, onRefresh, onDelete }: { market: Market; canEdit: boolean; onRefresh: () => void; onDelete: () => void }) {
  const [serviceAreasList, setServiceAreasList] = useState<ServiceArea[]>([]);
  const [form, setForm] = useState<UpdateMarketDto>({
    displayName: market.displayName,
    description: market.description ?? '',
    currency: market.currency,
    timezone: market.timezone,
    centerLat: parseFloat(market.centerLat),
    centerLng: parseFloat(market.centerLng),
    radiusKm: parseFloat(market.radiusKm),
    isActive: market.isActive,
    launchDate: market.launchDate ?? '',
    serviceAreaId: market.serviceAreaId ?? undefined,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    poiApi.listServiceAreas().then(setServiceAreasList).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await updateMarket(market.id, form);
      toast.success('Market updated');
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Market Settings</h2>

      {canEdit ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Display Name</label>
              <input
                value={form.displayName ?? ''}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Slug</label>
              <input value={market.slug} disabled className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--accent)] text-[var(--muted-foreground)] cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
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
                  serviceAreaId: saId === '' ? null : saId,
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
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Changing service area auto-updates boundary, center &amp; timezone</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Center Lat</label>
              <input
                type="number" step="any"
                value={form.centerLat ?? ''}
                onChange={e => setForm(f => ({ ...f, centerLat: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Center Lng</label>
              <input
                type="number" step="any"
                value={form.centerLng ?? ''}
                onChange={e => setForm(f => ({ ...f, centerLng: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Radius (km)</label>
              <input
                type="number" step="0.5"
                value={form.radiusKm ?? ''}
                onChange={e => setForm(f => ({ ...f, radiusKm: parseFloat(e.target.value) || 30 }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Currency</label>
              <input
                value={form.currency ?? ''}
                maxLength={3}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Timezone</label>
              <input
                value={form.timezone ?? ''}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Launch Date</label>
            <input
              type="date"
              value={form.launchDate ?? ''}
              onChange={e => setForm(f => ({ ...f, launchDate: e.target.value || undefined }))}
              className="w-full px-3 py-2 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive ?? true} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
            <span className="text-[13px] text-[var(--foreground)]">Market is active</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] bg-[var(--primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ fontWeight: 500 }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* Danger zone */}
          <div className="mt-8 pt-6 border-t border-red-200 dark:border-red-900">
            <h3 className="text-[13px] text-red-600 dark:text-red-400 mb-2" style={{ fontWeight: 600 }}>Danger Zone</h3>
            <p className="text-[12px] text-[var(--muted-foreground)] mb-3">
              Deleting this market will permanently remove it and all associated fare plans.
            </p>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              style={{ fontWeight: 500 }}
            >
              <Trash2 size={14} />
              Delete Market
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--muted-foreground)]">You don't have permission to edit market settings.</p>
      )}
    </div>
  );
}
