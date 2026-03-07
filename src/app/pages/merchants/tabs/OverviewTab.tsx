// ── Overview Tab ─────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Loader2, MapPin, ExternalLink, ShieldCheck, Star, Lock,
  ScrollText, StickyNote, Pencil, X, Save, Navigation, Search,
  Package, CheckCircle, TrendingUp, Wallet,
  Upload, ImageIcon, Camera, Trash2, GripVertical,
  ChevronLeft, ChevronRight, Plus, Maximize2,
} from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import {
  fetchMerchantStats, updateMerchant,
  type ApiMerchant, type MerchantStats,
} from '../../../lib/merchants-api';
import { api } from '../../../lib/api';
import { getMerchantStatus, formatDate, peso, timeAgo } from '../helpers';

const PRIMARY_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const FALLBACK_MAP_STYLE: any = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f3f4f6' } }],
};

interface Props {
  merchant: ApiMerchant;
  canEdit: boolean;
  onUpdate: (m: ApiMerchant) => void;
}

export function OverviewTab({ merchant: m, canEdit, onUpdate }: Props) {
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Location override modal ────────────────────────────────
  const [locationModal, setLocationModal] = useState(false);
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locSaving, setLocSaving] = useState(false);
  const [locSearching, setLocSearching] = useState(false);

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const modalMapContainer = useRef<HTMLDivElement>(null);
  const modalMapRef = useRef<maplibregl.Map | null>(null);
  const modalMarkerRef = useRef<maplibregl.Marker | null>(null);

  // ── Photo management ───────────────────────────────────────
  const [photoUploading, setPhotoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [galleryModal, setGalleryModal] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await fetchMerchantStats(m.id)); } catch { /* optional */ }
    finally { setLoading(false); }
  }, [m.id]);

  useEffect(() => { load(); }, [load]);

  // ── Overview map (read-only preview) ───────────────────────
  useEffect(() => {
    if (!mapContainer.current || !m.latitude || !m.longitude) return;
    const lat = parseFloat(m.latitude);
    const lng = parseFloat(m.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    // Clean up previous map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: PRIMARY_MAP_STYLE,
      center: [lng, lat],
      zoom: 15,
      interactive: false, // read-only preview
      attributionControl: false,
    });

    const marker = new maplibregl.Marker({ color: '#1d4ed8' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => { map.remove(); mapRef.current = null; };
  }, [m.latitude, m.longitude]);

  // ── Modal map (interactive for location override) ──────────
  useEffect(() => {
    if (!locationModal) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const initMap = (attempt = 0) => {
      if (cancelled) return;
      const container = modalMapContainer.current;
      if (!container) {
        if (attempt < 10) {
          retryTimer = setTimeout(() => initMap(attempt + 1), 80);
        }
        return;
      }

      if ((container.clientWidth === 0 || container.clientHeight === 0) && attempt < 10) {
        retryTimer = setTimeout(() => initMap(attempt + 1), 80);
        return;
      }

      if (container.clientWidth === 0 || container.clientHeight === 0) return;

      const parsedLat = locLat ? parseFloat(locLat) : NaN;
      const parsedLng = locLng ? parseFloat(locLng) : NaN;
      const merchantLat = m.latitude ? parseFloat(m.latitude) : NaN;
      const merchantLng = m.longitude ? parseFloat(m.longitude) : NaN;
      const lat = Number.isFinite(parsedLat) ? parsedLat : (Number.isFinite(merchantLat) ? merchantLat : 9.8114);
      const lng = Number.isFinite(parsedLng) ? parsedLng : (Number.isFinite(merchantLng) ? merchantLng : 126.1625);

      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
      modalMarkerRef.current = null;

      const map = new maplibregl.Map({
        container,
        style: PRIMARY_MAP_STYLE,
        center: [lng, lat],
        zoom: 15,
        attributionControl: false,
      });

      let fallbackApplied = false;
      const applyFallbackStyle = () => {
        if (fallbackApplied || cancelled) return;
        fallbackApplied = true;
        map.setStyle(FALLBACK_MAP_STYLE);
      };

      map.on('error', () => {
        applyFallbackStyle();
      });

      const styleGuardTimer = setTimeout(() => {
        if (cancelled || fallbackApplied) return;
        if (!map.isStyleLoaded()) {
          applyFallbackStyle();
        }
      }, 1500);

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      const marker = new maplibregl.Marker({ color: '#dc2626', draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      // Update coords when marker is dragged
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        setLocLat(pos.lat.toFixed(8));
        setLocLng(pos.lng.toFixed(8));
      });

      // Click on map to move marker
      map.on('click', (e) => {
        marker.setLngLat(e.lngLat);
        setLocLat(e.lngLat.lat.toFixed(8));
        setLocLng(e.lngLat.lng.toFixed(8));
      });

      map.once('load', () => {
        map.resize();
      });
      requestAnimationFrame(() => {
        if (cancelled) return;
        map.resize();
      });
      setTimeout(() => {
        if (cancelled) return;
        map.resize();
      }, 200);

      const resizeObserver = new ResizeObserver(() => {
        if (!cancelled) map.resize();
      });
      resizeObserver.observe(container);

      modalMapRef.current = map;
      modalMarkerRef.current = marker;

      const originalRemove = map.remove.bind(map);
      map.remove = () => {
        clearTimeout(styleGuardTimer);
        resizeObserver.disconnect();
        originalRemove();
      };
    };

    retryTimer = setTimeout(() => initMap(0), 0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
      }
      modalMarkerRef.current = null;
    };
  }, [locationModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync marker when lat/lng inputs change manually
  useEffect(() => {
    if (!modalMapRef.current || !modalMarkerRef.current) return;
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    if (isNaN(lat) || isNaN(lng)) return;
    modalMarkerRef.current.setLngLat([lng, lat]);
    modalMapRef.current.flyTo({ center: [lng, lat], duration: 300 });
  }, [locLat, locLng]);

  // ── Open location modal ────────────────────────────────────
  function openLocationModal() {
    setLocLat(m.latitude || '');
    setLocLng(m.longitude || '');
    setLocAddress(m.businessAddress || '');
    setLocationModal(true);
  }

  // ── Reverse geocode via Nominatim ──────────────────────────
  async function reverseGeocode(lat: string, lng: string) {
    try {
      setLocSearching(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      if (data.display_name) {
        setLocAddress(data.display_name);
        toast.success('Address found via reverse geocode');
      }
    } catch {
      toast.error('Reverse geocode failed — Nominatim may be down');
    } finally {
      setLocSearching(false);
    }
  }

  // ── Save location override ─────────────────────────────────
  async function handleSaveLocation() {
    if (!locLat || !locLng) {
      toast.error('Latitude and longitude are required');
      return;
    }
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    if (isNaN(lat) || lat < -90 || lat > 90) { toast.error('Invalid latitude'); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { toast.error('Invalid longitude'); return; }

    setLocSaving(true);
    try {
      const updated = await updateMerchant(m.id, {
        latitude: lat.toFixed(8),
        longitude: lng.toFixed(8),
        businessAddress: locAddress.trim() || undefined,
      });
      toast.success('Location updated successfully');
      onUpdate(updated);
      setLocationModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update location');
    } finally {
      setLocSaving(false);
    }
  }

  // ── Completion rate ────────────────────────────────────────

  // ── Cover photo upload ──────────────────────────────────────
  async function handleCoverPhotoUpload(file: File) {
    setCoverUploading(true);
    try {
      const result = await api.uploadFile(file, 'merchants');
      const updated = await updateMerchant(m.id, { coverPhotoUrl: result.url });
      onUpdate(updated);
      toast.success('Cover photo updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload cover photo');
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleRemoveCover() {
    setPhotoSaving(true);
    try {
      // Send empty string instead of null to avoid validator issues
      const updated = await updateMerchant(m.id, { coverPhotoUrl: '' });
      onUpdate(updated);
      toast.success('Cover photo removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove cover photo');
    } finally {
      setPhotoSaving(false);
    }
  }

  // ── Gallery photos ─────────────────────────────────────────
  async function handleAddGalleryPhotos(files: File[]) {
    setPhotoUploading(true);
    try {
      const results = await api.uploadFiles(files, 'merchants');
      const newUrls = results.map((r: any) => r.url);
      const merged = [...(m.photos || []), ...newUrls];
      const updated = await updateMerchant(m.id, { photos: merged });
      onUpdate(updated);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photos');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemoveGalleryPhoto(index: number) {
    setPhotoSaving(true);
    try {
      const newPhotos = [...(m.photos || [])];
      newPhotos.splice(index, 1);
      const updated = await updateMerchant(m.id, { photos: newPhotos });
      onUpdate(updated);
      toast.success('Photo removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove photo');
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleReorderPhotos(newOrder: string[]) {
    setPhotoSaving(true);
    try {
      const updated = await updateMerchant(m.id, { photos: newOrder });
      onUpdate(updated);
      toast.success('Photo order saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reorder photos');
    } finally {
      setPhotoSaving(false);
    }
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const photos = [...(m.photos || [])];
    const [moved] = photos.splice(dragIdx, 1);
    photos.splice(idx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    handleReorderPhotos(photos);
  }

  // All photos for lightbox (cover + gallery)
  const allPhotos = [
    ...(m.coverPhotoUrl ? [m.coverPhotoUrl] : []),
    ...(m.photos || []),
  ];

  const completionRate = m.totalBookings > 0
    ? Math.round((m.completedBookings / m.totalBookings) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Status + date */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={getMerchantStatus(m)} size="md" />
        {m.isFeatured && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
            <Star size={10} className="fill-amber-500" /> Featured
          </span>
        )}
        <span className="text-[12px] text-[var(--muted-foreground)]">Applied {formatDate(m.createdAt)}</span>
        {m.verifiedAt && (
          <span className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={12} /> Verified {formatDate(m.verifiedAt)}
          </span>
        )}
        {m.updatedAt && (
          <span className="text-[12px] text-[var(--muted-foreground)]">· Updated {timeAgo(m.updatedAt)}</span>
        )}
      </div>

      {/* ═══ Cover Photo + Gallery Preview ═══ */}
      <div className="space-y-3">
        {/* Cover Photo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
              <Camera size={12} className="inline mr-1" />Cover Photo
            </p>
            {canEdit && m.coverPhotoUrl && (
              <button onClick={handleRemoveCover} disabled={photoSaving}
                className="flex items-center gap-1 text-[10px] text-red-500 hover:underline disabled:opacity-50" style={{ fontWeight: 500 }}>
                <Trash2 size={10} /> Remove
              </button>
            )}
          </div>

          {m.coverPhotoUrl ? (
            <div className="relative group rounded-xl overflow-hidden border border-[var(--border)]">
              <img src={m.coverPhotoUrl} alt="Cover" className="w-full h-[180px] object-cover cursor-pointer"
                onClick={() => setLightboxIdx(0)} />
              {canEdit && (
                <label className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
                  <span className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-black/70 rounded-xl text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                    {coverUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {coverUploading ? 'Uploading…' : 'Change Cover'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" disabled={coverUploading}
                    onChange={e => { if (e.target.files?.[0]) handleCoverPhotoUpload(e.target.files[0]); e.target.value = ''; }} />
                </label>
              )}
            </div>
          ) : canEdit ? (
            <label className="flex flex-col items-center justify-center h-[140px] border-2 border-dashed border-[var(--border)] rounded-xl hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-colors">
              {coverUploading ? (
                <Loader2 size={24} className="animate-spin text-blue-500 mb-2" />
              ) : (
                <Camera size={24} className="text-muted-foreground/40 mb-2" />
              )}
              <p className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
                {coverUploading ? 'Uploading…' : 'Click to add cover photo'}
              </p>
              <input type="file" accept="image/*" className="hidden" disabled={coverUploading}
                onChange={e => { if (e.target.files?.[0]) handleCoverPhotoUpload(e.target.files[0]); e.target.value = ''; }} />
            </label>
          ) : (
            <div className="flex items-center justify-center h-[100px] border border-dashed border-[var(--border)] rounded-xl">
              <p className="text-[12px] text-muted-foreground">No cover photo</p>
            </div>
          )}
        </div>

        {/* Gallery Preview (small thumbnails + manage button) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
              <ImageIcon size={12} className="inline mr-1" />Gallery
              {(m.photos || []).length > 0 && (
                <span className="ml-1.5 text-[10px] bg-[var(--accent)] text-foreground px-1.5 py-0.5 rounded-full">
                  {(m.photos || []).length}
                </span>
              )}
            </p>
            {canEdit && (
              <button onClick={() => setGalleryModal(true)}
                className="flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
                <Maximize2 size={10} /> Manage Gallery
              </button>
            )}
          </div>

          {(m.photos || []).length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(m.photos || []).slice(0, 6).map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative shrink-0 w-[80px] h-[80px] rounded-lg overflow-hidden border border-[var(--border)] cursor-pointer group"
                  onClick={() => setLightboxIdx(m.coverPhotoUrl ? idx + 1 : idx)}>
                  <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
              {(m.photos || []).length > 6 && (
                <button onClick={() => setGalleryModal(true)}
                  className="shrink-0 w-[80px] h-[80px] rounded-lg border border-[var(--border)] flex items-center justify-center bg-[var(--accent)]/50 hover:bg-[var(--accent)] transition-colors">
                  <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>+{(m.photos || []).length - 6}</span>
                </button>
              )}
              {canEdit && (m.photos || []).length <= 6 && (
                <label className="shrink-0 w-[80px] h-[80px] rounded-lg border-2 border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                  {photoUploading ? (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  ) : (
                    <Plus size={18} className="text-muted-foreground/40" />
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" disabled={photoUploading}
                    onChange={e => { if (e.target.files?.length) handleAddGalleryPhotos(Array.from(e.target.files)); e.target.value = ''; }} />
                </label>
              )}
            </div>
          ) : canEdit ? (
            <label className="flex flex-col items-center justify-center h-[80px] border-2 border-dashed border-[var(--border)] rounded-xl hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-colors">
              {photoUploading ? (
                <Loader2 size={18} className="animate-spin text-blue-500" />
              ) : (
                <Upload size={18} className="text-muted-foreground/40 mb-1" />
              )}
              <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>
                {photoUploading ? 'Uploading…' : 'Add gallery photos'}
              </p>
              <input type="file" accept="image/*" multiple className="hidden" disabled={photoUploading}
                onChange={e => { if (e.target.files?.length) handleAddGalleryPhotos(Array.from(e.target.files)); e.target.value = ''; }} />
            </label>
          ) : (
            <div className="flex items-center justify-center h-[60px] border border-dashed border-[var(--border)] rounded-xl">
              <p className="text-[12px] text-muted-foreground">No gallery photos</p>
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Contact Person', value: m.contactPerson },
          { label: 'Business Type', value: m.businessType || 'N/A' },
          { label: 'Email', value: m.contactEmail },
          { label: 'Phone', value: m.contactPhone },
          { label: 'Address', value: m.businessAddress || 'N/A' },
          { label: 'Municipality', value: m.municipality || 'N/A' },
          { label: 'Registration #', value: m.businessRegistrationNumber || 'N/A' },
          {
            label: 'Effective Commission',
            value: m.commissionRateOverride
              ? `${parseFloat(m.commissionRateOverride)}% (override)`
              : `${parseFloat(m.contractedCommissionRate) || 0}%`,
          },
        ].map(item => (
          <div key={item.label}>
            <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{item.label}</p>
            <p className="text-[13px] text-[var(--foreground)]">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Stats cards — 2 rows */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-emerald-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Revenue</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{peso(m.totalRevenue)}</p>
        </div>
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={12} className="text-blue-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Bookings</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>
            {m.totalBookings.toLocaleString()}
            {m.totalBookings > 0 && (
              <span className="text-[11px] text-[var(--muted-foreground)] ml-1" style={{ fontWeight: 400 }}>
                ({completionRate}% completed)
              </span>
            )}
          </p>
        </div>
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Star size={12} className="text-amber-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Rating</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>
            {parseFloat(m.averageRating) > 0 ? `${parseFloat(m.averageRating).toFixed(1)} ★` : '—'}
            {m.totalReviews > 0 && (
              <span className="text-[11px] text-[var(--muted-foreground)] ml-1" style={{ fontWeight: 400 }}>
                ({m.totalReviews} reviews)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Secondary stats: Inventory + Payout */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Package size={12} className="text-indigo-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Inventory</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>
            {m.activeItems}<span className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 400 }}>/{m.totalItems} active</span>
          </p>
        </div>
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={12} className="text-orange-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pending Payout</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>{peso(m.pendingPayout)}</p>
        </div>
        <div className="bg-[var(--accent)]/50 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={12} className="text-teal-500" />
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Completed</p>
          </div>
          <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 600 }}>
            {m.completedBookings.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Monthly stats */}
      {loading && (
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[12px]">Loading monthly stats…</span>
        </div>
      )}
      {stats && (
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>This Month</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-900">
              <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>Monthly Revenue</p>
              <p className="text-[16px] mt-1 text-blue-700 dark:text-blue-300 tabular-nums" style={{ fontWeight: 600 }}>{peso(stats.thisMonth.revenue)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-900">
              <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 500 }}>Monthly Bookings</p>
              <p className="text-[16px] mt-1 text-blue-700 dark:text-blue-300 tabular-nums" style={{ fontWeight: 600 }}>{stats.thisMonth.bookings}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Location with MapLibre ═══ */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>
            <MapPin size={12} className="inline mr-1" />Location
          </p>
          {canEdit && (
            <button onClick={openLocationModal}
              className="flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
              <Pencil size={10} /> Override Location
            </button>
          )}
        </div>

        {m.latitude && m.longitude ? (
          <div className="rounded-xl overflow-hidden border border-[var(--border)]">
            {/* Map preview */}
            <div ref={mapContainer} className="w-full h-[200px]" />
            {/* Info bar below map */}
            <div className="p-3 bg-[var(--accent)]/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--foreground)] truncate">{m.businessAddress || 'No address set'}</p>
                <p className="text-[10px] text-[var(--muted-foreground)] font-mono mt-0.5">{m.latitude}, {m.longitude}</p>
              </div>
              <a href={`https://www.google.com/maps?q=${m.latitude},${m.longitude}`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--primary)] hover:underline px-2 py-1 bg-[var(--card)] rounded-lg border border-[var(--border)]" style={{ fontWeight: 500 }}>
                <ExternalLink size={10} /> Google Maps
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center border-2 border-dashed border-[var(--border)] rounded-xl">
            <MapPin size={24} className="mx-auto text-[var(--muted-foreground)]/30 mb-2" />
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No location set</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">This merchant hasn't provided coordinates yet.</p>
            {canEdit && (
              <button onClick={openLocationModal}
                className="mt-3 px-3 py-1.5 text-[11px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" style={{ fontWeight: 500 }}>
                <MapPin size={10} className="inline mr-1" /> Set Location
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contract info */}
      {(m.contractSignedDate || m.launchBonusEndDate || m.contractDocumentUrl) && (
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            <ScrollText size={12} className="inline mr-1" />Contract
          </p>
          <div className="grid grid-cols-2 gap-3">
            {m.contractSignedDate && (
              <div className="p-3 bg-[var(--accent)]/50 rounded-xl">
                <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>Contract Signed</p>
                <p className="text-[12px] text-[var(--foreground)]">{formatDate(m.contractSignedDate)}</p>
              </div>
            )}
            {m.launchBonusEndDate && (
              <div className="p-3 bg-[var(--accent)]/50 rounded-xl">
                <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>Launch Bonus Ends</p>
                <p className="text-[12px] text-[var(--foreground)]">{formatDate(m.launchBonusEndDate)}</p>
              </div>
            )}
          </div>
          {m.contractDocumentUrl && (
            <a href={m.contractDocumentUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-[var(--primary)] hover:underline" style={{ fontWeight: 500 }}>
              <ExternalLink size={10} /> View Contract Document
            </a>
          )}
        </div>
      )}

      {/* Notes */}
      {m.notes && (
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            <StickyNote size={12} className="inline mr-1" />Admin Notes
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <p className="text-[12px] text-amber-800 dark:text-amber-200 whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>{m.notes}</p>
          </div>
        </div>
      )}

      {/* Policies */}
      {(m.cancellationPolicy || m.termsAndConditions) && (
        <div>
          <p className="text-[12px] text-[var(--muted-foreground)] mb-2" style={{ fontWeight: 600 }}>
            <ScrollText size={12} className="inline mr-1" />Policies
          </p>
          <div className="space-y-3">
            {m.cancellationPolicy && (
              <div className="p-3 bg-[var(--accent)]/50 rounded-xl">
                <p className="text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Cancellation Policy</p>
                <p className="text-[12px] text-[var(--foreground)] whitespace-pre-wrap" style={{ lineHeight: 1.5 }}>{m.cancellationPolicy}</p>
              </div>
            )}
            {m.termsAndConditions && (
              <div className="p-3 bg-[var(--accent)]/50 rounded-xl">
                <p className="text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Terms & Conditions</p>
                <p className="text-[12px] text-[var(--foreground)] whitespace-pre-wrap" style={{ lineHeight: 1.5 }}>{m.termsAndConditions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Read-only notice */}
      {!canEdit && (
        <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/50 rounded-xl text-[var(--muted-foreground)]">
          <Lock size={14} />
          <span className="text-[12px]">You have <strong>view-only</strong> access. Contact a Merchant Manager or Super Admin to edit.</span>
        </div>
      )}

      {/* ═══ Gallery Manager Modal (Full Screen) ═══ */}
      {galleryModal && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={() => setGalleryModal(false)} />
          <div className="fixed inset-4 md:inset-6 lg:inset-8 bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col" role="dialog" aria-modal="true">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                  <ImageIcon size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>Photo Gallery</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {m.businessName} — {(m.photos || []).length} photo{(m.photos || []).length !== 1 ? 's' : ''}
                    {canEdit && ' · Drag to reorder'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <label className="px-4 py-2 text-[12px] rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2 shadow-sm" style={{ fontWeight: 500 }}>
                    {photoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {photoUploading ? 'Uploading…' : 'Add Photos'}
                    <input type="file" accept="image/*" multiple className="hidden" disabled={photoUploading}
                      onChange={e => { if (e.target.files?.length) handleAddGalleryPhotos(Array.from(e.target.files)); e.target.value = ''; }} />
                  </label>
                )}
                <button onClick={() => setGalleryModal(false)} className="p-2 rounded-xl hover:bg-[var(--accent)] transition-colors">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Body — Photo Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {(m.photos || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ImageIcon size={48} className="text-muted-foreground/20 mb-4" />
                  <p className="text-[15px] text-foreground mb-1" style={{ fontWeight: 500 }}>No gallery photos yet</p>
                  <p className="text-[12px] text-muted-foreground mb-4">Upload photos to showcase this merchant</p>
                  {canEdit && (
                    <label className="px-5 py-2.5 text-[13px] rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2" style={{ fontWeight: 500 }}>
                      <Upload size={14} /> Upload Photos
                      <input type="file" accept="image/*" multiple className="hidden" disabled={photoUploading}
                        onChange={e => { if (e.target.files?.length) handleAddGalleryPhotos(Array.from(e.target.files)); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {(m.photos || []).map((url, idx) => (
                    <div
                      key={`gal-${url}-${idx}`}
                      draggable={canEdit}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      onDrop={() => handleDrop(idx)}
                      className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        dragOverIdx === idx ? 'border-blue-500 scale-105 shadow-lg' :
                        dragIdx === idx ? 'opacity-40 border-[var(--border)]' :
                        'border-[var(--border)] hover:border-[var(--primary)]/30'
                      }`}
                    >
                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover"
                        onClick={() => { setLightboxIdx(m.coverPhotoUrl ? idx + 1 : idx); }} />

                      {/* Position badge */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px]" style={{ fontWeight: 600 }}>
                        {idx + 1}
                      </div>

                      {/* Hover overlay */}
                      {canEdit && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                          <div className="flex items-center gap-1 text-white/80">
                            <GripVertical size={14} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveGalleryPhoto(idx); }}
                            disabled={photoSaving}
                            className="p-1.5 bg-red-500/90 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={12} className="text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add more photos tile */}
                  {canEdit && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                      {photoUploading ? (
                        <Loader2 size={22} className="animate-spin text-blue-500" />
                      ) : (
                        <>
                          <Plus size={22} className="text-muted-foreground/40 mb-1" />
                          <span className="text-[10px] text-muted-foreground" style={{ fontWeight: 500 }}>Add More</span>
                        </>
                      )}
                      <input type="file" accept="image/*" multiple className="hidden" disabled={photoUploading}
                        onChange={e => { if (e.target.files?.length) handleAddGalleryPhotos(Array.from(e.target.files)); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 bg-[var(--accent)]/30 border-t border-[var(--border)] shrink-0">
              <p className="text-[11px] text-muted-foreground">
                {photoSaving && <><Loader2 size={10} className="animate-spin inline mr-1" />Saving…</>}
                {!photoSaving && canEdit && 'Drag photos to reorder · Click to preview'}
              </p>
              <button onClick={() => setGalleryModal(false)}
                className="px-5 py-2 text-[13px] rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-foreground" style={{ fontWeight: 500 }}>
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Lightbox ═══ */}
      {lightboxIdx !== null && allPhotos.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
            {/* Close */}
            <button className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors z-10"
              onClick={() => setLightboxIdx(null)}>
              <X size={20} className="text-white" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/10 rounded-lg">
              <span className="text-[13px] text-white/80" style={{ fontWeight: 500 }}>
                {(lightboxIdx ?? 0) + 1} / {allPhotos.length}
              </span>
            </div>

            {/* Prev */}
            {(lightboxIdx ?? 0) > 0 && (
              <button className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 1) - 1); }}>
                <ChevronLeft size={24} className="text-white" />
              </button>
            )}

            {/* Next */}
            {(lightboxIdx ?? 0) < allPhotos.length - 1 && (
              <button className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx ?? 0) + 1); }}>
                <ChevronRight size={24} className="text-white" />
              </button>
            )}

            {/* Image */}
            <img
              src={allPhotos[lightboxIdx ?? 0]}
              alt={`Photo ${(lightboxIdx ?? 0) + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </>
      )}

      {/* ═══ Location Override Modal ═══ */}
      {locationModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setLocationModal(false)} />
          <div className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-[15%] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col" role="dialog" aria-modal="true">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Navigation size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Override Location</h3>
                  <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{m.businessName} — click map or drag pin to set</p>
                </div>
              </div>
              <button onClick={() => setLocationModal(false)} className="p-2 rounded-xl hover:bg-[var(--accent)] transition-colors">
                <X size={18} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Body: Map + Form side by side */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Map (left side) */}
              <div className="relative min-h-[320px] lg:min-h-0 lg:flex-1">
                <div ref={modalMapContainer} className="w-full h-full min-h-[320px]" />
                {/* Crosshair hint */}
                <div className="absolute top-3 left-3 bg-[var(--card)]/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[var(--border)] shadow-sm">
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    🖱️ Click map to set pin · Drag pin to adjust
                  </p>
                </div>
              </div>

              {/* Form (right side) */}
              <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border)] p-5 overflow-y-auto space-y-5">
                <div className="space-y-3">
                  <h4 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Coordinates</h4>
                  <div>
                    <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Latitude <span className="text-red-400">*</span></label>
                    <input type="text" value={locLat} onChange={e => setLocLat(e.target.value)}
                      placeholder="e.g. 9.81140000"
                      className="w-full px-3 py-2.5 text-[13px] font-mono bg-[var(--input-background)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--ring)] text-[var(--foreground)] transition-all placeholder:text-[var(--muted-foreground)]/60" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Longitude <span className="text-red-400">*</span></label>
                    <input type="text" value={locLng} onChange={e => setLocLng(e.target.value)}
                      placeholder="e.g. 126.16250000"
                      className="w-full px-3 py-2.5 text-[13px] font-mono bg-[var(--input-background)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--ring)] text-[var(--foreground)] transition-all placeholder:text-[var(--muted-foreground)]/60" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Address</h4>
                    {locLat && locLng && (
                      <button onClick={() => reverseGeocode(locLat, locLng)} disabled={locSearching}
                        className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50" style={{ fontWeight: 500 }}>
                        {locSearching ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                        Auto-fill from coords
                      </button>
                    )}
                  </div>
                  <textarea value={locAddress} onChange={e => setLocAddress(e.target.value)}
                    placeholder="Business address…"
                    rows={3}
                    className="w-full px-3 py-2.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--ring)] text-[var(--foreground)] transition-all placeholder:text-[var(--muted-foreground)]/60 resize-none" />
                </div>

                {/* Current vs New comparison */}
                {m.latitude && m.longitude && locLat && locLng && (
                  <div className="p-3 bg-[var(--accent)]/50 rounded-xl space-y-2">
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>CHANGE PREVIEW</p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-[var(--muted-foreground)]">Current</p>
                        <p className="font-mono text-[var(--foreground)]">{m.latitude}</p>
                        <p className="font-mono text-[var(--foreground)]">{m.longitude}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">New</p>
                        <p className="font-mono text-blue-700 dark:text-blue-300">{locLat}</p>
                        <p className="font-mono text-blue-700 dark:text-blue-300">{locLng}</p>
                      </div>
                    </div>
                    {locLat !== m.latitude || locLng !== m.longitude ? (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">⚠ Coordinates will be changed</p>
                    ) : (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ No coordinate change</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)] shrink-0">
              <button onClick={() => setLocationModal(false)}
                className="px-5 py-2.5 text-[13px] rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                Cancel
              </button>
              <button onClick={handleSaveLocation} disabled={locSaving || !locLat || !locLng}
                className="px-6 py-2.5 text-[13px] rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm" style={{ fontWeight: 500 }}>
                {locSaving && <Loader2 size={14} className="animate-spin" />}
                {locSaving ? 'Saving…' : 'Save Location'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
