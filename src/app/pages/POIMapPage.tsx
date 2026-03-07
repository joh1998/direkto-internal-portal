import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, MapPin, CheckCircle, XCircle, Trash2, Image, GripVertical, Upload,
  ChevronDown, Settings2, RefreshCw, Database, Layers,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { canApprove, canEdit, canDelete } from '../lib/permissions';
import { poiApi, type POI } from '../lib/poi-api';

export function POIMapPage() {
  const { user } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [poiList, setPoiList] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<POI | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'verify' | 'deactivate' | 'delete'; target: POI } | null>(null);
  const [showMedia, setShowMedia] = useState(false);

  const [newPoi, setNewPoi] = useState({ name: '', type: 'restaurant', address: '', centerLat: 14.5547, centerLng: 121.0244 });

  const [mapLoaded, setMapLoaded] = useState(false);

  const canDoApprove = user ? canApprove(user.role, 'poi_map') : false;
  const canDoEdit = user ? canEdit(user.role, 'poi_map') : false;
  const canDoDelete = user ? canDelete(user.role, 'poi_map') : false;

  const fetchPois = async () => {
    try {
      setLoading(true);
      const res = await poiApi.listPois({ limit: 100 });
      setPoiList(Array.isArray(res) ? res : (res.data || []));
    } catch (error) {
      toast.error('Failed to load POIs');
      setPoiList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPois();
  }, []);

  const filtered = poiList.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || p.type === categoryFilter;
    return matchSearch && matchCat;
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [121.0, 14.55],
      zoom: 11,
      trackResize: true,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObserver.observe(mapContainer.current);

    map.current.on('load', () => {
      setMapLoaded(true);
      setTimeout(() => {
        map.current?.resize();
      }, 100);
    });

    return () => {
      resizeObserver.disconnect();
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    filtered.forEach(poi => {
      const lng = Number(poi.centerLng);
      const lat = Number(poi.centerLat);
      if (isNaN(lng) || isNaN(lat)) return;

      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${poi.isVerified ? '#1d1d1f' : '#f59e0b'};
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      `;
      el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `POI: ${poi.name}`);

      el.addEventListener('click', () => setSelected(poi));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [filtered, mapLoaded]);

  // Fly to selected
  useEffect(() => {
    if (selected && map.current) {
      const lng = Number(selected.centerLng);
      const lat = Number(selected.centerLat);
      if (!isNaN(lng) && !isNaN(lat)) {
        map.current.flyTo({ center: [lng, lat], zoom: 15, duration: 800 });
      }
    }
  }, [selected]);

  async function handleCreatePoi() {
    try {
      const newEntry = await poiApi.createPoi({
        name: newPoi.name,
        type: newPoi.type,
        centerLat: newPoi.centerLat,
        centerLng: newPoi.centerLng,
        fullAddress: newPoi.address,
        country: 'PH',
        visibility: 'public',
        source: 'manual',
        confidence: 100,
        priorityScore: 0,
        isIslandHotspot: false,
        isTouristArea: false,
        isActive: true,
        isVerified: false,
        tags: [],
        editorialLock: {}
      });
      setPoiList([...poiList, newEntry]);
      setCreateMode(false);
      setNewPoi({ name: '', type: 'restaurant', address: '', centerLat: 14.5547, centerLng: 121.0244 });
      toast.success(`POI "${newPoi.name}" created`);
    } catch (error) {
      toast.error('Failed to create POI');
    }
  }

  async function executeAction() {
    if (!confirmAction) return;
    const { type, target } = confirmAction;
    try {
      if (type === 'verify') {
        await poiApi.updatePoi(target.id, { isVerified: true });
        setPoiList(poiList.map(p => p.id === target.id ? { ...p, isVerified: true } : p));
        toast.success(`${target.name} verified`);
      } else if (type === 'deactivate') {
        await poiApi.updatePoi(target.id, { isActive: false });
        setPoiList(poiList.map(p => p.id === target.id ? { ...p, isActive: false } : p));
        toast.success(`${target.name} deactivated`);
      } else if (type === 'delete') {
        await poiApi.deletePoi(target.id);
        setPoiList(poiList.filter(p => p.id !== target.id));
        setSelected(null);
        toast.success(`${target.name} deleted`);
      }
    } catch (error) {
      toast.error(`Failed to ${type} POI`);
    }
    setConfirmAction(null);
  }

  return (
    <div className="absolute inset-0 flex">
      {/* Left Panel */}
      <div className="w-[360px] border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>POI Manager</h2>
            <div className="flex gap-1">
              {canDoEdit && (
                <button
                  onClick={() => { setCreateMode(true); setSelected(null); }}
                  className="p-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors"
                  aria-label="Create POI"
                >
                  <Plus size={14} />
                </button>
              )}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
                aria-label="Admin operations"
              >
                <Settings2 size={14} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search POIs..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
              aria-label="Search POIs"
            />
          </div>

          {/* Category chips */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {['all', 'Mall', 'Restaurant', 'Attraction'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
                }`}
                style={{ fontWeight: 500 }}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Ops */}
        {showAdvanced && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-amber-50/50 dark:bg-amber-950/30 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2" style={{ fontWeight: 600 }}>Admin Operations</p>
            {[
              { label: 'Resync Typesense', icon: <RefreshCw size={12} /> },
              { label: 'Cleanup Outbox', icon: <Database size={12} /> },
              { label: 'Merchant Backfill', icon: <Layers size={12} /> },
            ].map(op => (
              <button
                key={op.label}
                onClick={() => toast.info(`${op.label} triggered`)}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] bg-[var(--card)] border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors text-left"
                style={{ fontWeight: 500 }}
              >
                {op.icon}
                <span className="flex-1">{op.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Create Mode */}
        {createMode && (
          <div className="px-4 py-4 border-b border-[var(--border)] bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Create New POI</p>
              <button onClick={() => setCreateMode(false)} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Cancel</button>
            </div>
            <input value={newPoi.name} onChange={e => setNewPoi({ ...newPoi, name: e.target.value })} placeholder="POI Name" className="w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]" />
            <input value={newPoi.address} onChange={e => setNewPoi({ ...newPoi, address: e.target.value })} placeholder="Address" className="w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]" />
            <select value={newPoi.type} onChange={e => setNewPoi({ ...newPoi, type: e.target.value })} className="w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]">
              {['Restaurant', 'Mall', 'Attraction', 'Cafe', 'Grocery'].map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.0001" value={newPoi.centerLat} onChange={e => setNewPoi({ ...newPoi, centerLat: parseFloat(e.target.value) })} placeholder="Latitude" className="px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]" />
              <input type="number" step="0.0001" value={newPoi.centerLng} onChange={e => setNewPoi({ ...newPoi, centerLng: parseFloat(e.target.value) })} placeholder="Longitude" className="px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]" />
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">Tip: Click on the map to set coordinates</p>
            <button onClick={handleCreatePoi} disabled={!newPoi.name} className="w-full py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors" style={{ fontWeight: 500 }}>
              Create POI
            </button>
          </div>
        )}

        {/* POI List */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 py-2 text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
            {filtered.length} POIs
          </p>
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <MapPin size={20} className="mx-auto text-[var(--muted-foreground)] mb-2" aria-hidden="true" />
              <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No POIs found</p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">Try a different search or category filter.</p>
            </div>
          )}
          {filtered.map(poi => (
            <button
              key={poi.id}
              onClick={() => { setSelected(poi); setCreateMode(false); }}
              className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                selected?.id === poi.id ? 'bg-blue-50/50 dark:bg-blue-950/30 border-l-2 border-l-[var(--primary)]' : 'hover:bg-[var(--accent)]/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${poi.isVerified ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>
                  <MapPin size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate text-[var(--foreground)]" style={{ fontWeight: 500 }}>{poi.name}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] truncate">{poi.fullAddress || poi.barangay || 'No address'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--muted-foreground)]">{poi.type}</span>
                    {poi.isVerified && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Verified</span>}
                    {!poi.isActive && <span className="text-[10px] text-red-500 dark:text-red-400">Inactive</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Map + Detail */}
      <div className="flex-1 relative h-full">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* POI Detail Panel */}
        {selected && !createMode && (
          <div className="absolute top-4 right-4 w-[340px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-10 max-h-[calc(100%-32px)] overflow-y-auto">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{selected.name}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{selected.id}</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-[var(--accent)]" aria-label="Close detail">
                  <XCircle size={14} className="text-[var(--muted-foreground)]" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <StatusBadge status={selected.isVerified ? 'verified' : 'pending'} />
                <StatusBadge status={selected.isActive ? 'active' : 'inactive'} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div><p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Category</p><p className="text-[var(--foreground)]">{selected.type}</p></div>
                <div><p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Address</p><p className="text-[var(--foreground)]">{selected.fullAddress || selected.barangay || 'No address'}</p></div>
                <div><p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Coordinates</p><p className="font-mono text-[11px] text-[var(--foreground)]">{selected.centerLat}, {selected.centerLng}</p></div>
                <div><p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Anchors</p><p className="text-[var(--foreground)]">{selected.anchors?.length || 0}</p></div>
              </div>

              {/* Anchors */}
              {(selected.anchors?.length || 0) > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>Anchors</p>
                  <div className="space-y-1.5">
                    {selected.anchors?.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-[var(--accent)]/50 rounded-lg text-[12px]">
                        <div className="flex items-center gap-2">
                          <GripVertical size={10} className="text-[var(--muted-foreground)] cursor-grab" aria-hidden="true" />
                          <span className="font-mono text-[11px] text-[var(--foreground)]">{a.pointLat.toFixed(4)}, {a.pointLng.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {a.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Default</span>}
                          {a.isVerified ? (
                            <CheckCircle size={12} className="text-emerald-500" aria-label="Verified" />
                          ) : (
                            canDoApprove && (
                              <button onClick={() => toast.success('Anchor verified')} className="p-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950" aria-label="Verify anchor">
                                <CheckCircle size={12} className="text-[var(--muted-foreground)]" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5">Drag anchors on the map to reposition</p>
                </div>
              )}

              {/* Media */}
              <div>
                <button
                  onClick={() => setShowMedia(!showMedia)}
                  className="flex items-center gap-2 text-[12px] w-full text-[var(--foreground)]"
                  style={{ fontWeight: 500 }}
                >
                  <Image size={12} aria-hidden="true" />
                  Media ({selected.media?.gallery?.length || 0})
                  <ChevronDown size={12} className={`ml-auto transition-transform ${showMedia ? 'rotate-180' : ''}`} />
                </button>
                {showMedia && (
                  <div className="mt-2 space-y-2">
                    {(selected.media?.gallery?.length || 0) > 0 ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {selected.media?.gallery?.map((g, i) => (
                          <div key={i} className="aspect-square bg-[var(--accent)] rounded-lg flex items-center justify-center relative group overflow-hidden">
                            <img src={g.url} alt="Gallery" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <GripVertical size={10} className="text-white cursor-grab" />
                              {canDoDelete && (
                                <button onClick={() => toast.success('Media deleted')} className="p-0.5" aria-label="Delete media">
                                  <Trash2 size={10} className="text-white" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--muted-foreground)]">No media uploaded</p>
                    )}
                    {canDoEdit && (
                      <button
                        onClick={() => toast.info('Media upload dialog would open')}
                        className="flex items-center gap-1.5 w-full py-2 text-[12px] text-blue-600 dark:text-blue-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors justify-center"
                        style={{ fontWeight: 500 }}
                      >
                        <Upload size={12} aria-hidden="true" />
                        Upload Media
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                {canDoApprove && !selected.isVerified && (
                  <button
                    onClick={() => setConfirmAction({ type: 'verify', target: selected })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    style={{ fontWeight: 500 }}
                  >
                    <CheckCircle size={12} aria-hidden="true" />
                    Verify
                  </button>
                )}
                {canDoEdit && selected.isActive && (
                  <button
                    onClick={() => setConfirmAction({ type: 'deactivate', target: selected })}
                    className="flex-1 py-2 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
                    style={{ fontWeight: 500 }}
                  >
                    Deactivate
                  </button>
                )}
                {canDoDelete && (
                  <button
                    onClick={() => setConfirmAction({ type: 'delete', target: selected })}
                    className="py-2 px-3 text-[12px] border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                    style={{ fontWeight: 500 }}
                    aria-label="Delete POI"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeAction}
        objectId={confirmAction?.target?.id}
        title={
          confirmAction?.type === 'verify' ? 'Verify POI' :
          confirmAction?.type === 'deactivate' ? 'Deactivate POI' : 'Delete POI'
        }
        message={
          confirmAction?.type === 'verify'
            ? `Verify "${confirmAction.target.name}" as an accurate point of interest?`
            : confirmAction?.type === 'deactivate'
            ? `Deactivate "${confirmAction?.target.name}"? It will no longer appear in search results.`
            : `Permanently delete "${confirmAction?.target.name}"? This cannot be undone.`
        }
        confirmLabel={confirmAction?.type === 'verify' ? 'Verify' : confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Delete'}
        variant={confirmAction?.type === 'delete' ? 'danger' : 'default'}
      />
    </div>
  );
}