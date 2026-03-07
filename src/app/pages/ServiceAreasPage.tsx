import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, Navigation, CheckCircle, XCircle, Trash2,
  ChevronDown, MapPin, Globe, Clock, Activity,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete, canApprove } from '../lib/permissions';
import { poiApi, type ServiceArea } from '../lib/poi-api';

/* ── Helpers ────────────────────────────────────── */

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/* ── Types ──────────────────────────────────────── */

interface BoundaryPoint { lat: number; lng: number }

interface CreateForm {
  id: string;
  name: string;
  country: string;
  timezone: string;
  isActive: boolean;
  boundary: BoundaryPoint[];
}

const EMPTY_FORM: CreateForm = {
  id: '',
  name: '',
  country: 'PH',
  timezone: 'Asia/Manila',
  isActive: true,
  boundary: [],
};

/* ── Component ──────────────────────────────────── */

export function ServiceAreasPage() {
  const { user } = useAuth();

  /* map refs */
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const drawMarkersRef = useRef<maplibregl.Marker[]>([]);

  /* data */
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  /* selection */
  const [selected, setSelected] = useState<ServiceArea | null>(null);

  /* create / edit mode */
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view');
  const [form, setForm] = useState<CreateForm>({ ...EMPTY_FORM });
  const [mapLoaded, setMapLoaded] = useState(false);

  /* confirm dialog */
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'deactivate' | 'delete';
    target: ServiceArea;
  } | null>(null);

  /* perms */
  const canDoEdit = user ? canEdit(user.role, 'poi_map') : false;
  const canDoDelete = user ? canDelete(user.role, 'poi_map') : false;

  /* ── Fetch ────────────────────────────────────── */

  const fetchAreas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await poiApi.listServiceAreas();
      setAreas(Array.isArray(res) ? res : []);
    } catch {
      toast.error('Failed to load service areas');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  /* ── Filter ───────────────────────────────────── */

  const filtered = areas.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && a.is_active) ||
      (statusFilter === 'inactive' && !a.is_active);
    return matchSearch && matchStatus;
  });

  /* ── Map init ─────────────────────────────────── */

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [126.05, 9.85],
      zoom: 11,
      trackResize: true,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const resizeObserver = new ResizeObserver(() => map.current?.resize());
    resizeObserver.observe(mapContainer.current);

    map.current.on('load', () => {
      setMapLoaded(true);
      setTimeout(() => map.current?.resize(), 100);
    });

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  /* ── Draw polygons on map ─────────────────────── */

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const m = map.current;

    // Remove old layers/sources
    areas.forEach(a => {
      try {
        if (m.getLayer(`sa-fill-${a.id}`)) m.removeLayer(`sa-fill-${a.id}`);
        if (m.getLayer(`sa-outline-${a.id}`)) m.removeLayer(`sa-outline-${a.id}`);
        if (m.getLayer(`sa-label-${a.id}`)) m.removeLayer(`sa-label-${a.id}`);
        if (m.getSource(`sa-${a.id}`)) m.removeSource(`sa-${a.id}`);
        if (m.getSource(`sa-label-src-${a.id}`)) m.removeSource(`sa-label-src-${a.id}`);
      } catch { /* map may be in invalid state during HMR */ }
    });

    // Add each service area as a polygon
    filtered.forEach(area => {
      const geo = area.boundary_geojson;
      if (!geo) return;

      const isSelected = selected?.id === area.id;
      const fillColor = area.is_active
        ? (isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.15)')
        : 'rgba(239,68,68,0.12)';
      const outlineColor = area.is_active
        ? (isSelected ? '#3b82f6' : '#10b981')
        : '#ef4444';

      m.addSource(`sa-${area.id}`, {
        type: 'geojson',
        data: { type: 'Feature', geometry: geo, properties: { name: area.name } },
      });

      m.addLayer({
        id: `sa-fill-${area.id}`,
        type: 'fill',
        source: `sa-${area.id}`,
        paint: { 'fill-color': fillColor, 'fill-opacity': 0.6 },
      });

      m.addLayer({
        id: `sa-outline-${area.id}`,
        type: 'line',
        source: `sa-${area.id}`,
        paint: { 'line-color': outlineColor, 'line-width': isSelected ? 3 : 2 },
      });

      // Label at centroid
      const coords = geo.type === 'Polygon' ? geo.coordinates[0] : [];
      if (coords.length > 0) {
        const centroid = coords.reduce(
          (acc: [number, number], c: [number, number]) => [acc[0] + c[0], acc[1] + c[1]],
          [0, 0],
        );
        centroid[0] /= coords.length;
        centroid[1] /= coords.length;

        m.addSource(`sa-label-src-${area.id}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: centroid },
            properties: { name: area.name },
          },
        });

        m.addLayer({
          id: `sa-label-${area.id}`,
          type: 'symbol',
          source: `sa-label-src-${area.id}`,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#1d1d1f',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
          },
        });
      }
    });

    // Cleanup all layers/sources added by this effect
    return () => {
      if (!map.current) return;
      // Remove area polygons + labels
      areas.forEach(a => {
        try {
          if (map.current!.getLayer(`sa-fill-${a.id}`)) map.current!.removeLayer(`sa-fill-${a.id}`);
          if (map.current!.getLayer(`sa-outline-${a.id}`)) map.current!.removeLayer(`sa-outline-${a.id}`);
          if (map.current!.getLayer(`sa-label-${a.id}`)) map.current!.removeLayer(`sa-label-${a.id}`);
          if (map.current!.getSource(`sa-${a.id}`)) map.current!.removeSource(`sa-${a.id}`);
          if (map.current!.getSource(`sa-label-src-${a.id}`)) map.current!.removeSource(`sa-label-src-${a.id}`);
        } catch { /* map already destroyed */ }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, mapLoaded, selected]);

  /* ── Fly to selected ──────────────────────────── */

  useEffect(() => {
    if (!selected || !map.current) return;
    const geo = selected.boundary_geojson;
    if (!geo) return;

    const coords: [number, number][] =
      geo.type === 'Polygon' ? geo.coordinates[0] : [];
    if (coords.length === 0) return;

    const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
    coords.forEach(c => bounds.extend(c));
    map.current.fitBounds(bounds, { padding: 60, duration: 800 });
  }, [selected]);

  /* ── Drawing mode (create/edit) ───────────────── */

  // Place markers on map click during create/edit
  useEffect(() => {
    if (!map.current || mode === 'view') return;
    const m = map.current;

    function handleClick(e: maplibregl.MapMouseEvent) {
      const pt: BoundaryPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setForm(prev => {
        const newBoundary = [...prev.boundary, pt];
        return { ...prev, boundary: newBoundary };
      });
    }

    m.on('click', handleClick);
    m.getCanvas().style.cursor = 'crosshair';

    return () => {
      if (!map.current) return;
      m.off('click', handleClick);
      try { m.getCanvas().style.cursor = ''; } catch { /* map destroyed */ }
    };
  }, [mode]);

  // Render draw markers + preview polygon
  useEffect(() => {
    // Clear old markers
    drawMarkersRef.current.forEach(m => m.remove());
    drawMarkersRef.current = [];

    if (mode === 'view' || !map.current || !mapLoaded) return;
    const m = map.current;

    // Markers for each point
    form.boundary.forEach((pt, i) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 14px; height: 14px; border-radius: 50%;
        background: #3b82f6; border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
      `;
      el.title = `Point ${i + 1} (${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)})`;

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([pt.lng, pt.lat])
        .addTo(m);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        setForm(prev => {
          const updated = [...prev.boundary];
          updated[i] = { lat: pos.lat, lng: pos.lng };
          return { ...prev, boundary: updated };
        });
      });

      drawMarkersRef.current.push(marker);
    });

    // Preview polygon
    if (form.boundary.length >= 3) {
      const ring = form.boundary.map(p => [p.lng, p.lat] as [number, number]);
      ring.push(ring[0]); // close

      if (m.getLayer('draw-fill')) m.removeLayer('draw-fill');
      if (m.getLayer('draw-outline')) m.removeLayer('draw-outline');
      if (m.getSource('draw-polygon')) m.removeSource('draw-polygon');

      m.addSource('draw-polygon', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {},
        },
      });
      m.addLayer({
        id: 'draw-fill',
        type: 'fill',
        source: 'draw-polygon',
        paint: { 'fill-color': 'rgba(59,130,246,0.2)', 'fill-opacity': 0.7 },
      });
      m.addLayer({
        id: 'draw-outline',
        type: 'line',
        source: 'draw-polygon',
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
    }

    return () => {
      if (!map.current) return;
      try {
        if (m.getLayer('draw-fill')) m.removeLayer('draw-fill');
        if (m.getLayer('draw-outline')) m.removeLayer('draw-outline');
        if (m.getSource('draw-polygon')) m.removeSource('draw-polygon');
      } catch { /* map destroyed */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.boundary, mode, mapLoaded]);

  /* ── Actions ──────────────────────────────────── */

  function startCreate() {
    setMode('create');
    setSelected(null);
    setForm({ ...EMPTY_FORM });
  }

  function startEdit(area: ServiceArea) {
    const geo = area.boundary_geojson;
    const pts: BoundaryPoint[] =
      geo?.type === 'Polygon'
        ? geo.coordinates[0].slice(0, -1).map((c: [number, number]) => ({ lng: c[0], lat: c[1] }))
        : [];

    setForm({
      id: area.id,
      name: area.name,
      country: area.country,
      timezone: area.timezone,
      isActive: area.is_active,
      boundary: pts,
    });
    setMode('edit');
    setSelected(area);
  }

  function cancelDraw() {
    setMode('view');
    setForm({ ...EMPTY_FORM });
    drawMarkersRef.current.forEach(m => m.remove());
    drawMarkersRef.current = [];
  }

  function removeLastPoint() {
    setForm(prev => ({ ...prev, boundary: prev.boundary.slice(0, -1) }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.boundary.length < 4) { toast.error('Draw at least 4 boundary points'); return; }

    // Close polygon: ensure first == last
    const boundary = [...form.boundary];
    const first = boundary[0];
    const last = boundary[boundary.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) {
      boundary.push({ ...first });
    }

    try {
      if (mode === 'create') {
        const id = form.id.trim() || slugify(form.name);
        await poiApi.createServiceArea({
          id,
          name: form.name,
          country: form.country,
          timezone: form.timezone,
          isActive: form.isActive,
          boundary,
        });
        toast.success(`Service Area "${form.name}" created`);
      } else {
        await poiApi.updateServiceArea(form.id, {
          name: form.name,
          country: form.country,
          timezone: form.timezone,
          isActive: form.isActive,
          boundary,
        });
        toast.success(`Service Area "${form.name}" updated`);
      }

      cancelDraw();
      fetchAreas();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save service area');
    }
  }

  async function executeAction() {
    if (!confirmAction) return;
    const { type, target } = confirmAction;
    try {
      if (type === 'activate') {
        await poiApi.updateServiceArea(target.id, { isActive: true } as any);
        setAreas(areas.map(a => a.id === target.id ? { ...a, is_active: true } : a));
        toast.success(`${target.name} activated`);
      } else if (type === 'deactivate') {
        await poiApi.updateServiceArea(target.id, { isActive: false } as any);
        setAreas(areas.map(a => a.id === target.id ? { ...a, is_active: false } : a));
        toast.success(`${target.name} deactivated`);
      } else if (type === 'delete') {
        await poiApi.deleteServiceArea(target.id);
        setAreas(areas.filter(a => a.id !== target.id));
        if (selected?.id === target.id) setSelected(null);
        toast.success(`${target.name} deleted`);
      }
    } catch {
      toast.error(`Failed to ${type} service area`);
    }
    setConfirmAction(null);
  }

  /* ── Render ───────────────────────────────────── */

  return (
    <div className="absolute inset-0 flex">
      {/* ── Left Panel ──────────────────────────── */}
      <div className="w-[360px] border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
              Service Areas
            </h2>
            {canDoEdit && mode === 'view' && (
              <button
                onClick={startCreate}
                className="p-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors"
                aria-label="Create Service Area"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search service areas..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
            />
          </div>

          {/* Status chips */}
          <div className="flex gap-1 mt-2">
            {(['all', 'active', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-[11px] rounded-full capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
                }`}
                style={{ fontWeight: 500 }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Create / Edit form */}
        {mode !== 'view' && (
          <div className="px-4 py-4 border-b border-[var(--border)] bg-blue-50/30 dark:bg-blue-950/20 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                {mode === 'create' ? 'Create Service Area' : 'Edit Service Area'}
              </p>
              <button onClick={cancelDraw} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Cancel
              </button>
            </div>

            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value, id: mode === 'create' ? slugify(e.target.value) : form.id })}
              placeholder="Area name"
              className="w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
            />

            {mode === 'create' && (
              <input
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                placeholder="unique_slug_id"
                className="w-full px-3 py-2 text-[13px] font-mono bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
                placeholder="Country (PH)"
                className="px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
              />
              <input
                value={form.timezone}
                onChange={e => setForm({ ...form, timezone: e.target.value })}
                placeholder="Timezone"
                className="px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
              />
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
              Active
            </label>

            {/* Boundary info */}
            <div className="p-3 bg-[var(--accent)]/50 rounded-lg space-y-1">
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
                BOUNDARY ({form.boundary.length} points)
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Click on the map to place boundary points. Min 4 required.
              </p>
              {form.boundary.length > 0 && (
                <div className="max-h-[120px] overflow-y-auto space-y-0.5 mt-1">
                  {form.boundary.map((pt, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono text-[var(--muted-foreground)]">
                      <span>#{i + 1}: {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span>
                    </div>
                  ))}
                </div>
              )}
              {form.boundary.length > 0 && (
                <button
                  onClick={removeLastPoint}
                  className="text-[11px] text-red-500 hover:text-red-600 mt-1"
                >
                  Remove last point
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={!form.name || form.boundary.length < 4}
              className="w-full py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
              style={{ fontWeight: 500 }}
            >
              {mode === 'create' ? 'Create Service Area' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 py-2 text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
            {loading ? 'Loading...' : `${filtered.length} service area${filtered.length !== 1 ? 's' : ''}`}
          </p>

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Navigation size={20} className="mx-auto text-[var(--muted-foreground)] mb-2" />
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No service areas</p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                {areas.length === 0 ? 'Create one to get started.' : 'Try a different filter.'}
              </p>
            </div>
          )}

          {filtered.map(area => (
            <button
              key={area.id}
              onClick={() => { setSelected(area); setMode('view'); }}
              className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                selected?.id === area.id
                  ? 'bg-blue-50/50 dark:bg-blue-950/30 border-l-2 border-l-[var(--primary)]'
                  : 'hover:bg-[var(--accent)]/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  area.is_active
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400'
                }`}>
                  <Navigation size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                    {area.name}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate font-mono">{area.id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--muted-foreground)]">
                      {area.country}
                    </span>
                    {area.is_active ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Active</span>
                    ) : (
                      <span className="text-[10px] text-red-500 dark:text-red-400">Inactive</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Map + Detail ────────────────────────── */}
      <div className="flex-1 relative h-full">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Drawing mode hint */}
        {mode !== 'view' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-[12px] flex items-center gap-2" style={{ fontWeight: 500 }}>
            <MapPin size={14} />
            Click map to place boundary points · {form.boundary.length} placed
          </div>
        )}

        {/* Detail Panel */}
        {selected && mode === 'view' && (
          <div className="absolute top-4 right-4 w-[340px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-10 max-h-[calc(100%-32px)] overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                    {selected.name}
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{selected.id}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded hover:bg-[var(--accent)]"
                  aria-label="Close detail"
                >
                  <XCircle size={14} className="text-[var(--muted-foreground)]" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex gap-2">
                <StatusBadge status={selected.is_active ? 'active' : 'inactive'} />
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-[var(--muted-foreground)] flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <Globe size={10} /> Country
                  </p>
                  <p className="text-[var(--foreground)]">{selected.country}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)] flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <Clock size={10} /> Timezone
                  </p>
                  <p className="text-[var(--foreground)]">{selected.timezone}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Created</p>
                  <p className="text-[var(--foreground)]">{formatDate(selected.created_at)}</p>
                </div>
                <div>
                  <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Updated</p>
                  <p className="text-[var(--foreground)]">{formatDate(selected.updated_at)}</p>
                </div>
              </div>

              {/* Boundary info */}
              {selected.boundary_geojson && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
                    Boundary
                  </p>
                  <div className="p-2 bg-[var(--accent)]/50 rounded-lg text-[11px] font-mono text-[var(--muted-foreground)] max-h-[100px] overflow-y-auto">
                    {selected.boundary_geojson.type === 'Polygon' && (
                      <p>{selected.boundary_geojson.coordinates[0].length - 1} vertices</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                {canDoEdit && (
                  <button
                    onClick={() => startEdit(selected)}
                    className="flex-1 py-2 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
                    style={{ fontWeight: 500 }}
                  >
                    Edit Boundary
                  </button>
                )}
                {canDoEdit && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        type: selected.is_active ? 'deactivate' : 'activate',
                        target: selected,
                      })
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] rounded-lg ${
                      selected.is_active
                        ? 'border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--foreground)]'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {selected.is_active ? (
                      <>
                        <Activity size={12} />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle size={12} />
                        Activate
                      </>
                    )}
                  </button>
                )}
                {canDoDelete && (
                  <button
                    onClick={() => setConfirmAction({ type: 'delete', target: selected })}
                    className="py-2 px-3 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                    style={{ fontWeight: 500 }}
                    aria-label="Delete service area"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm Dialog ──────────────────────── */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        objectId={confirmAction?.target?.id}
        title={
          confirmAction?.type === 'activate' ? 'Activate Service Area' :
          confirmAction?.type === 'deactivate' ? 'Deactivate Service Area' :
          'Delete Service Area'
        }
        message={
          confirmAction?.type === 'activate'
            ? `Activate "${confirmAction.target.name}"? It will become visible to drivers and users.`
            : confirmAction?.type === 'deactivate'
            ? `Deactivate "${confirmAction?.target.name}"? Drivers will no longer receive trips in this area.`
            : `Permanently delete "${confirmAction?.target.name}"? This cannot be undone.`
        }
        confirmLabel={
          confirmAction?.type === 'activate' ? 'Activate' :
          confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Delete'
        }
        variant={confirmAction?.type === 'delete' ? 'danger' : 'default'}
      />
    </div>
  );
}
