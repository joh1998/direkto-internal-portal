import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Eye, XCircle, Radio, RefreshCw, AlertCircle, Loader2,
  MapPin, Clock, DollarSign, TrendingUp, Car, ChevronRight, Navigation,
  Phone, User, CheckCircle,
} from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../components/shared/DataTable';
import { useAuth } from '../context/AuthContext';
import { canEdit } from '../lib/permissions';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchTrips, fetchActiveTrips, fetchTripStatistics, fetchTripTimeline, adminCancelTrip,
  type ApiTrip, type TripSearchParams, type TripStatistics, type TripTimelineEntry,
} from '../lib/trips-api';
import type { PaginatedResponse } from '../lib/users-api';

/* ── constants ───────────────────────────────────────────────── */
const ACTIVE_STATUSES = ['REQUESTING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
const LIVE_POLL_MS = 8_000;

/* ── helpers ─────────────────────────────────────────────────── */
function mapStatus(s: string): string {
  const m: Record<string, string> = {
    REQUESTING: 'pending',
    DRIVER_ASSIGNED: 'active',
    DRIVER_ARRIVED: 'active',
    IN_PROGRESS: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    CANCELLED_BY_PASSENGER: 'cancelled',
    CANCELLED_BY_DRIVER: 'cancelled',
    NO_DRIVERS_AVAILABLE: 'inactive',
    EXPIRED: 'inactive',
  };
  return m[s] ?? 'inactive';
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFare(val: string | number | null) {
  if (val == null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return '—';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDistance(meters: number | null) {
  if (!meters) return '—';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—';
  const m = Math.round(seconds / 60);
  return m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function TripsPage() {
  const { user: admin } = useAuth();
  const canDoEdit = admin ? canEdit(admin.role, 'trips') : false;

  /* ── tab state ─── */
  const [activeTab, setActiveTab] = useState<'all' | 'live'>('all');

  /* ── all-trips filters ─── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  /* ── detail / cancel ─── */
  const [selected, setSelected] = useState<ApiTrip | null>(null);
  const [timeline, setTimeline] = useState<TripTimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [tripToCancel, setTripToCancel] = useState<ApiTrip | null>(null);

  /* ── all trips data ─── */
  const params: TripSearchParams = {
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    vehicleType: vehicleFilter !== 'all' ? vehicleFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: 15,
  };

  const { data, isLoading, error, refetch } = useApiQuery<PaginatedResponse<ApiTrip>>(
    () => fetchTrips(params),
    [search, statusFilter, vehicleFilter, dateFrom, dateTo, page],
  );

  const allTrips = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 0;

  /* ── stats ─── */
  const { data: stats } = useApiQuery<TripStatistics>(
    () => fetchTripStatistics(),
    [],
  );

  /* ── active/live trips ─── */
  const [liveTrips, setLiveTrips] = useState<ApiTrip[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const liveTimerRef = useRef<ReturnType<typeof setInterval>>();

  const loadLiveTrips = useCallback(async () => {
    try {
      const result = await fetchActiveTrips();
      setLiveTrips(result);
    } catch {
      // silent
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'live') {
      setLiveLoading(true);
      loadLiveTrips();
      liveTimerRef.current = setInterval(loadLiveTrips, LIVE_POLL_MS);
    }
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [activeTab, loadLiveTrips]);

  /* ── open detail ─── */
  const openDetail = useCallback(async (trip: ApiTrip) => {
    setSelected(trip);
    setTimelineLoading(true);
    try {
      const tl = await fetchTripTimeline(trip.id);
      setTimeline(tl);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  /* ── cancel ─── */
  async function executeCancel() {
    if (!tripToCancel) return;
    try {
      await adminCancelTrip(tripToCancel.id, 'Cancelled by admin');
      toast.success(`Trip #${tripToCancel.id} has been cancelled`);
      setTripToCancel(null);
      setSelected(null);
      refetch();
      if (activeTab === 'live') loadLiveTrips();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel trip');
    }
  }

  /* ── reset page on filter change ─── */
  useEffect(() => { setPage(1); }, [search, statusFilter, vehicleFilter, dateFrom, dateTo]);

  /* ═══════════════════════════════════════════════════════════════
     TABLE COLUMNS
     ═══════════════════════════════════════════════════════════════ */
  const columns: Column<ApiTrip>[] = [
    {
      key: 'id',
      label: 'Trip',
      sortable: true,
      sortValue: (t) => t.id,
      render: (t) => (
        <div>
          <p className="text-[13px] font-mono text-[var(--foreground)]" style={{ fontWeight: 500 }}>#{t.id}</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">{timeAgo(t.requestedAt)}</p>
        </div>
      ),
    },
    {
      key: 'passenger',
      label: 'Passenger',
      sortable: true,
      sortValue: (t) => t.passenger?.name ?? '',
      render: (t) => (
        <span className="text-[13px] text-[var(--foreground)]">{t.passenger?.name ?? '—'}</span>
      ),
    },
    {
      key: 'driver',
      label: 'Driver',
      sortable: true,
      sortValue: (t) => t.driver?.user?.name ?? '',
      render: (t) => (
        <span className="text-[13px] text-[var(--foreground)]">{t.driver?.user?.name ?? '—'}</span>
      ),
    },
    {
      key: 'route',
      label: 'Route',
      render: (t) => (
        <p className="text-[12px] text-[var(--muted-foreground)] truncate max-w-[220px]">
          {t.pickupAddress ? t.pickupAddress.split(',')[0] : 'Unknown'} → {t.dropoffAddress ? t.dropoffAddress.split(',')[0] : 'Unknown'}
        </p>
      ),
    },
    {
      key: 'vehicleType',
      label: 'Type',
      render: (t) => (
        <span className="text-[12px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" style={{ fontWeight: 500 }}>
          {t.vehicleType?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (t) => t.status,
      render: (t) => <StatusBadge status={mapStatus(t.status)} label={statusLabel(t.status)} />,
    },
    {
      key: 'fare',
      label: 'Fare',
      align: 'right',
      sortable: true,
      sortValue: (t) => parseFloat(t.finalFare ?? t.estimatedFare ?? '0'),
      render: (t) => (
        <span className="text-[13px] tabular-nums text-[var(--foreground)]">
          {formatFare(t.finalFare ?? t.estimatedFare)}
        </span>
      ),
    },
    {
      key: 'commission',
      label: 'Commission',
      align: 'right',
      sortable: true,
      sortValue: (t) => parseFloat(t.commission ?? '0'),
      render: (t) => (
        <span className="text-[12px] tabular-nums text-[var(--muted-foreground)]">
          {formatFare(t.commission)}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      sortValue: (t) => new Date(t.requestedAt).getTime(),
      render: (t) => (
        <span className="text-[12px] text-[var(--muted-foreground)]">{formatDateTime(t.requestedAt)}</span>
      ),
    },
  ];

  /* ── live columns ─── */
  const liveColumns: Column<ApiTrip>[] = [
    columns[0],
    columns[1],
    columns[2],
    {
      key: 'liveStatus',
      label: 'Status',
      sortable: true,
      sortValue: (t) => t.status,
      render: (t) => {
        const isLive = t.status === 'IN_PROGRESS';
        return (
          <div className="flex items-center gap-1.5">
            {isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
            <StatusBadge status={mapStatus(t.status)} label={statusLabel(t.status)} />
          </div>
        );
      },
    },
    columns[4],
    {
      key: 'elapsed',
      label: 'Elapsed',
      align: 'right',
      sortable: true,
      sortValue: (t) => new Date(t.startedAt ?? t.requestedAt).getTime(),
      render: (t) => {
        const start = t.startedAt ?? t.acceptedAt ?? t.requestedAt;
        return <span className="text-[12px] tabular-nums text-[var(--muted-foreground)]">{timeAgo(start)}</span>;
      },
    },
    {
      key: 'fare',
      label: 'Est. Fare',
      align: 'right',
      render: (t) => <span className="text-[13px] tabular-nums">{formatFare(t.estimatedFare)}</span>,
    },
  ];

  /* ═══════════════════════════════════════════════════════════════
     DETAIL DRAWER
     ═══════════════════════════════════════════════════════════════ */
  const overviewContent = selected && (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <StatusBadge status={mapStatus(selected.status)} label={statusLabel(selected.status)} size="md" />
        {ACTIVE_STATUSES.includes(selected.status) && (
          <span className="flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
            <Radio size={12} className="animate-pulse" /> Live
          </span>
        )}
      </div>

      {/* route */}
      <div className="bg-[var(--accent)] rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pickup</p>
            <p className="text-[13px] text-[var(--foreground)]">{selected.pickupAddress ?? '—'}</p>
          </div>
        </div>
        <div className="ml-1 border-l-2 border-dashed border-[var(--border)] h-3" />
        <div className="flex items-start gap-2">
          <div className="mt-1 w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Dropoff</p>
            <p className="text-[13px] text-[var(--foreground)]">{selected.dropoffAddress ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* key metrics */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Est. Fare', value: formatFare(selected.estimatedFare) },
          { label: 'Final Fare', value: formatFare(selected.finalFare) },
          { label: 'Est. Distance', value: formatDistance(selected.estimatedDistance) },
          { label: 'Actual Distance', value: formatDistance(selected.actualDistance) },
          { label: 'Est. Duration', value: formatDuration(selected.estimatedDuration) },
          { label: 'Actual Duration', value: formatDuration(selected.actualDuration) },
          { label: 'Commission', value: formatFare(selected.commission) },
          { label: 'Driver Earnings', value: formatFare(selected.driverEarnings) },
          { label: 'Surge', value: selected.surgeMultiplier && parseFloat(selected.surgeMultiplier) > 1 ? `${selected.surgeMultiplier}x` : 'None' },
          { label: 'Vehicle', value: selected.vehicleType?.replace(/_/g, ' ') ?? '—' },
        ].map(item => (
          <div key={item.label}>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
            <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
          </div>
        ))}
      </div>

      {/* passenger & driver */}
      <div className="space-y-3">
        <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider" style={{ fontWeight: 600 }}>People</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--accent)] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-[var(--muted-foreground)]" />
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Passenger</p>
            </div>
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{selected.passenger?.name ?? '—'}</p>
            {selected.passenger?.phone && (
              <p className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                <Phone size={10} /> {selected.passenger.phone}
              </p>
            )}
          </div>
          <div className="bg-[var(--accent)] rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Car size={14} className="text-[var(--muted-foreground)]" />
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Driver</p>
            </div>
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{selected.driver?.user?.name ?? '—'}</p>
            {selected.vehicle && (
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                {selected.vehicle.make} {selected.vehicle.model} · {selected.vehicle.plateNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ratings */}
      {(selected.passengerRating || selected.driverRating) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>Passenger rating</p>
            <p className="text-[13px]">{selected.passengerRating ? `⭐ ${selected.passengerRating}` : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>Driver rating</p>
            <p className="text-[13px]">{selected.driverRating ? `⭐ ${selected.driverRating}` : '—'}</p>
          </div>
        </div>
      )}

      {/* cancellation info */}
      {selected.cancelledAt && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-[11px] uppercase text-red-600 dark:text-red-400 tracking-wider mb-1" style={{ fontWeight: 600 }}>Cancelled</p>
          <p className="text-[12px] text-red-700 dark:text-red-300">
            By {selected.cancelledBy ?? 'unknown'} · {formatDateTime(selected.cancelledAt)}
          </p>
          {selected.cancellationReason && (
            <p className="text-[12px] text-red-600 dark:text-red-400 mt-1">Reason: {selected.cancellationReason}</p>
          )}
        </div>
      )}
    </div>
  );

  const timelineContent = selected && (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-3" style={{ fontWeight: 600 }}>Timeline</p>
      {timelineLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" /> <span className="text-[12px]">Loading…</span>
        </div>
      ) : timeline.length === 0 ? (
        <p className="text-[12px] text-[var(--muted-foreground)]">No timeline events</p>
      ) : (
        <div className="space-y-0">
          {timeline.map((entry, i) => {
            const isLast = i === timeline.length - 1;
            const isCancelled = entry.status.includes('CANCELLED');
            const isCompleted = entry.status === 'COMPLETED';
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                    isCancelled ? 'bg-red-500' : isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} />
                  {!isLast && <div className="w-px flex-1 bg-[var(--border)]" />}
                </div>
                <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                  <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{entry.description}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{formatDateTime(entry.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const drawerTabs = selected ? [
    { id: 'overview', label: 'Overview', content: overviewContent },
    { id: 'timeline', label: 'Timeline', content: timelineContent },
  ] : undefined;

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6">
      <PageHeader
        title="Trips"
        description={stats ? `${Number(stats.activeTrips)} active · ${Number(stats.totalTrips).toLocaleString()} total` : 'Loading…'}
      />

      {/* ── Stats cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Trips', value: Number(stats.totalTrips).toLocaleString(), icon: <Navigation size={16} />, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Active Now', value: Number(stats.activeTrips).toLocaleString(), icon: <Radio size={16} />, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Revenue', value: formatFare(stats.totalRevenue), icon: <DollarSign size={16} />, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Avg Fare', value: formatFare(stats.averageFare), icon: <TrendingUp size={16} />, color: 'text-purple-600 dark:text-purple-400' },
          ].map(card => (
            <div key={card.label} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>{card.label}</p>
                <span className={card.color}>{card.icon}</span>
              </div>
              <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ─── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 p-1 bg-[var(--accent)] rounded-lg w-fit">
          {[
            { key: 'all' as const, label: 'All Trips' },
            { key: 'live' as const, label: `Live (${liveTrips.length})`, icon: <Radio size={12} className="text-emerald-600" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
                activeTab === tab.key ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
              style={{ fontWeight: 500 }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'live' && (
          <button
            onClick={() => { setLiveLoading(true); loadLiveTrips(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <RefreshCw size={12} className={liveLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
      </div>

      {/* ═══ LIVE TAB ═══════════════════════════════════════════ */}
      {activeTab === 'live' && (
        <>
          {liveLoading && liveTrips.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)] mr-2" />
              <span className="text-[13px] text-[var(--muted-foreground)]">Loading active trips…</span>
            </div>
          ) : liveTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Navigation size={32} className="text-[var(--muted-foreground)] mb-3 opacity-40" />
              <p className="text-[14px] text-[var(--foreground)] mb-1" style={{ fontWeight: 500 }}>No active trips</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">When drivers and riders are on trips, they'll appear here in real-time.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3 text-[12px] text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                  {liveTrips.filter(t => t.status === 'IN_PROGRESS').length} in progress
                </span>
                <span>{liveTrips.filter(t => t.status === 'REQUESTING').length} requesting</span>
                <span>{liveTrips.filter(t => t.status === 'DRIVER_ASSIGNED' || t.status === 'DRIVER_ARRIVED').length} assigned/arrived</span>
                <span className="ml-auto opacity-50">Updates every {LIVE_POLL_MS / 1000}s</span>
              </div>

              <DataTable
                data={liveTrips}
                columns={liveColumns}
                keyExtractor={(t) => String(t.id)}
                onRowClick={openDetail}
                pageSize={50}
                emptyTitle="No active trips"
                emptyMessage="All trips are completed or idle."
                rowActions={(t) => (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openDetail(t); }} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View trip #${t.id}`}>
                      <Eye size={14} className="text-[var(--muted-foreground)]" />
                    </button>
                    {canDoEdit && (
                      <button onClick={(e) => { e.stopPropagation(); setTripToCancel(t); }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Cancel trip #${t.id}`}>
                        <XCircle size={14} className="text-red-500" />
                      </button>
                    )}
                  </div>
                )}
              />
            </>
          )}
        </>
      )}

      {/* ═══ ALL TRIPS TAB ══════════════════════════════════════ */}
      {activeTab === 'all' && (
        <>
          <FilterBar
            searchPlaceholder="Search by trip ID, pickup or dropoff address…"
            searchValue={search}
            onSearchChange={setSearch}
            showDateRange
            onDateRangeChange={(from, to) => {
              if (from) setDateFrom(from);
              if (to) setDateTo(to);
            }}
            filters={[
              {
                key: 'status', label: 'Status',
                options: [
                  { label: 'Requesting', value: 'REQUESTING' },
                  { label: 'Driver Assigned', value: 'DRIVER_ASSIGNED' },
                  { label: 'Driver Arrived', value: 'DRIVER_ARRIVED' },
                  { label: 'In Progress', value: 'IN_PROGRESS' },
                  { label: 'Completed', value: 'COMPLETED' },
                  { label: 'Cancelled', value: 'CANCELLED' },
                  { label: 'No Drivers', value: 'NO_DRIVERS_AVAILABLE' },
                ],
                value: statusFilter, onChange: setStatusFilter,
              },
              {
                key: 'vehicleType', label: 'Vehicle Type',
                options: [
                  { label: 'Habal-Habal', value: 'HABAL_HABAL' },
                  { label: 'Multicab', value: 'MULTICAB' },
                  { label: 'Car', value: 'CAR' },
                  { label: 'Van', value: 'VAN' },
                ],
                value: vehicleFilter, onChange: setVehicleFilter,
              },
            ]}
          />

          <div className="mt-4">
            {isLoading && allTrips.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin text-[var(--muted-foreground)] mr-2" />
                <span className="text-[13px] text-[var(--muted-foreground)]">Loading trips…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertCircle size={24} className="text-red-500 mb-2" />
                <p className="text-[13px] text-red-600 dark:text-red-400 mb-3">{error}</p>
                <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[var(--accent)] rounded-md hover:bg-[var(--border)]">
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : (
              <>
                <DataTable
                  data={allTrips}
                  columns={columns}
                  keyExtractor={(t) => String(t.id)}
                  onRowClick={openDetail}
                  pageSize={15}
                  emptyTitle="No trips found"
                  emptyMessage="Try adjusting your filters or search terms."
                  rowActions={(t) => (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openDetail(t); }} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View trip #${t.id}`}>
                        <Eye size={14} className="text-[var(--muted-foreground)]" />
                      </button>
                      {canDoEdit && ACTIVE_STATUSES.includes(t.status) && (
                        <button onClick={(e) => { e.stopPropagation(); setTripToCancel(t); }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Cancel trip #${t.id}`}>
                          <XCircle size={14} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  )}
                />

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-[12px] text-[var(--muted-foreground)]">
                    <span>Showing {allTrips.length} of {total.toLocaleString()} trips</span>
                    <div className="flex gap-1">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 rounded-md bg-[var(--accent)] disabled:opacity-40 hover:bg-[var(--border)] transition-colors"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1.5">Page {page} of {totalPages}</span>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 rounded-md bg-[var(--accent)] disabled:opacity-40 hover:bg-[var(--border)] transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Detail Drawer ─── */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Trip #${selected.id}` : ''}
        subtitle={selected ? statusLabel(selected.status) : undefined}
        tabs={drawerTabs}
        actions={
          selected && canDoEdit && ACTIVE_STATUSES.includes(selected.status) ? (
            <button
              onClick={() => { setTripToCancel(selected); setSelected(null); }}
              className="py-2 px-4 text-[13px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
              style={{ fontWeight: 500 }}
            >
              Cancel Trip
            </button>
          ) : undefined
        }
      />

      {/* ── Cancel dialog ─── */}
      <ConfirmDialog
        open={!!tripToCancel}
        onClose={() => setTripToCancel(null)}
        onConfirm={executeCancel}
        title="Cancel Trip"
        objectId={tripToCancel ? `#${tripToCancel.id}` : undefined}
        message={`Are you sure you want to cancel trip #${tripToCancel?.id}? The rider and driver will be notified immediately.`}
        confirmLabel="Cancel Trip"
        variant="danger"
      />
    </div>
  );
}