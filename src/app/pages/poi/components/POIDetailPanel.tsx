import { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  XCircle, CheckCircle, Trash2, Image, GripVertical, Upload,
  ChevronDown, Plus, Star, Edit3, Loader2, MapPin, Flame, Palmtree,
  Lock, Car, CloudRain, Phone, Navigation, Store, Link2,
} from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import type { POI, POIAnchor, POIKind, POIStatus } from '../../../lib/poi-api';
import { POI_STATUS_OPTIONS } from '../../../lib/poi-api';
import type { ConfirmAction } from '../hooks/usePOIData';
import { api } from '../../../lib/api';

/* ── Props ──────────────────────────────────────── */

interface POIDetailPanelProps {
  poi: POI;
  onClose: () => void;
  onConfirmAction: (action: ConfirmAction) => void;
  onUpdatePoi: (id: string, data: Partial<POI>) => Promise<any>;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onVerifyAnchor: (id: string) => Promise<void>;
  onSetDefaultAnchor: (id: string) => Promise<void>;
  onDeleteAnchor: (id: string) => Promise<void>;
  onCreateAnchor: (data: {
    id: string; poiId: string; label: string;
    pointLat: number; pointLng: number;
    dropoffZoneType?: string; roadAccessType?: string;
    pickupNotes?: string; entranceSide?: string;
    requiresContact?: boolean; weatherBlocked?: boolean;
  }) => Promise<void>;
  onUpdateAnchor: (id: string, data: Record<string, any>) => Promise<void>;
  onDeleteMedia: (mediaId: number) => Promise<void>;
  onAddMedia: (poiId: string, kind: 'cover' | 'gallery' | 'icon', url: string) => Promise<void>;
  poiTypes: { id: string; label: string; kindId?: string }[];
  poiKinds: POIKind[];
  dropoffZoneTypes: { id: string; label: string }[];
  roadAccessTypes: { id: string; label: string }[];
  // Anchor placement (drag-to-place)
  anchorPlacing: boolean;
  anchorDragCoords: { lat: number; lng: number } | null;
  onStartAnchorPlace: () => void;
  onCancelAnchorPlace: () => void;
  onConfirmAnchorPlace: () => void;
  // Anchor edit draggable marker
  onStartAnchorEdit: (anchor: POIAnchor) => void;
  onCancelAnchorEdit: () => void;
}

/* ── Helpers ────────────────────────────────────── */

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/* ── Component ──────────────────────────────────── */

export function POIDetailPanel({
  poi, onClose, onConfirmAction, onUpdatePoi,
  canApprove, canEdit, canDelete,
  onVerifyAnchor, onSetDefaultAnchor, onDeleteAnchor, onCreateAnchor, onUpdateAnchor,
  onDeleteMedia, onAddMedia,
  poiTypes, poiKinds, dropoffZoneTypes, roadAccessTypes,
  anchorPlacing, anchorDragCoords,
  onStartAnchorPlace, onCancelAnchorPlace, onConfirmAnchorPlace,
  onStartAnchorEdit, onCancelAnchorEdit,
}: POIDetailPanelProps) {
  const [showMedia, setShowMedia] = useState(false);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showGeo, setShowGeo] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({
    name: poi.name,
    displayName: poi.displayName || '',
    kind: poi.kind || 'attraction',
    type: poi.type,
    status: (poi.status || 'unknown') as POIStatus,
    fullAddress: poi.fullAddress || '',
    barangay: poi.barangay || '',
    city: poi.city || '',
    province: poi.province || '',
    priorityScore: poi.priorityScore,
    visibility: poi.visibility,
    isIslandHotspot: poi.isIslandHotspot,
    isTouristArea: poi.isTouristArea,
    oneLiner: poi.oneLiner || '',
    descriptionShort: poi.descriptionShort || '',
    descriptionLong: poi.descriptionLong || '',
    visitHint: poi.visitHint || '',
    accessHint: poi.accessHint || '',
    coverImageUrl: poi.coverImageUrl || '',
    contactPhone: poi.contactPhone || '',
    website: poi.website || '',
    priceLevel: poi.priceLevel || '',
    operatingHours: JSON.stringify(poi.operatingHours || {}, null, 2),
    socialLinks: JSON.stringify(poi.socialLinks || {}, null, 2),
  });
  const [saving, setSaving] = useState(false);

  // New anchor form
  const [showNewAnchor, setShowNewAnchor] = useState(false);
  const [newAnchor, setNewAnchor] = useState({
    label: '', pointLat: '', pointLng: '',
    dropoffZoneType: dropoffZoneTypes[0]?.id || 'main_gate',
    roadAccessType: roadAccessTypes[0]?.id || 'all_vehicles',
    pickupNotes: '',
    entranceSide: '',
    requiresContact: false,
    weatherBlocked: false,
  });
  const [anchorSaving, setAnchorSaving] = useState(false);

  // Anchor edit state
  const [editingAnchorId, setEditingAnchorId] = useState<string | null>(null);
  const [anchorEditFields, setAnchorEditFields] = useState<Record<string, any>>({});
  const [anchorEditSaving, setAnchorEditSaving] = useState(false);

  // Anchor verify loading state
  const [verifyingAnchorId, setVerifyingAnchorId] = useState<string | null>(null);

  // Media URL input
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaSaving, setMediaSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  async function handleSaveEdit() {
    setSaving(true);
    try {
      await onUpdatePoi(poi.id, {
        name: editFields.name,
        displayName: editFields.displayName || undefined,
        kind: editFields.kind,
        type: editFields.type,
        status: editFields.status,
        fullAddress: editFields.fullAddress || undefined,
        barangay: editFields.barangay || undefined,
        city: editFields.city || undefined,
        province: editFields.province || undefined,
        priorityScore: editFields.priorityScore,
        visibility: editFields.visibility,
        isIslandHotspot: editFields.isIslandHotspot,
        isTouristArea: editFields.isTouristArea,
        oneLiner: editFields.oneLiner || undefined,
        descriptionShort: editFields.descriptionShort || undefined,
        descriptionLong: editFields.descriptionLong || undefined,
        visitHint: editFields.visitHint || undefined,
        accessHint: editFields.accessHint || undefined,
        coverImageUrl: editFields.coverImageUrl || undefined,
        contactPhone: editFields.contactPhone || undefined,
        website: editFields.website || undefined,
        priceLevel: editFields.priceLevel || undefined,
        operatingHours: editFields.operatingHours ? (() => { try { return JSON.parse(editFields.operatingHours); } catch { return undefined; } })() : undefined,
        socialLinks: editFields.socialLinks ? (() => { try { return JSON.parse(editFields.socialLinks); } catch { return undefined; } })() : undefined,
      } as any);
      setEditMode(false);
      toast.success('POI updated');
    } catch {
      toast.error('Failed to update POI');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAnchor() {
    if (!newAnchor.label) return;
    const lat = anchorDragCoords?.lat ?? parseFloat(newAnchor.pointLat);
    const lng = anchorDragCoords?.lng ?? parseFloat(newAnchor.pointLng);
    if (isNaN(lat) || isNaN(lng)) { toast.error('Set anchor location on map'); return; }
    setAnchorSaving(true);
    try {
      await onCreateAnchor({
        id: `${poi.id}_${slugify(newAnchor.label)}`,
        poiId: poi.id,
        label: newAnchor.label,
        pointLat: lat,
        pointLng: lng,
        dropoffZoneType: newAnchor.dropoffZoneType,
        roadAccessType: newAnchor.roadAccessType,
        pickupNotes: newAnchor.pickupNotes || undefined,
        entranceSide: newAnchor.entranceSide || undefined,
        requiresContact: newAnchor.requiresContact,
        weatherBlocked: newAnchor.weatherBlocked,
      });
      setNewAnchor({
        label: '', pointLat: '', pointLng: '',
        dropoffZoneType: dropoffZoneTypes[0]?.id || 'main_gate',
        roadAccessType: roadAccessTypes[0]?.id || 'all_vehicles',
        pickupNotes: '', entranceSide: '',
        requiresContact: false, weatherBlocked: false,
      });
      setShowNewAnchor(false);
      onConfirmAnchorPlace();
    } catch {
      toast.error('Failed to create anchor');
    } finally {
      setAnchorSaving(false);
    }
  }

  async function handleSaveAnchorEdit(anchorId: string) {
    setAnchorEditSaving(true);
    try {
      // Include dragged coordinates if the marker was moved
      const payload = { ...anchorEditFields };
      if (anchorDragCoords) {
        payload.pointLat = anchorDragCoords.lat;
        payload.pointLng = anchorDragCoords.lng;
      }
      await onUpdateAnchor(anchorId, payload);
      setEditingAnchorId(null);
      setAnchorEditFields({});
      onCancelAnchorEdit(); // hide the draggable marker
    } catch {
      toast.error('Failed to update anchor');
    } finally {
      setAnchorEditSaving(false);
    }
  }

  function startEditAnchor(a: POIAnchor) {
    setEditingAnchorId(a.id);
    setAnchorEditFields({
      label: a.label,
      dropoffZoneType: a.dropoffZoneType,
      roadAccessType: a.roadAccessType,
      pickupNotes: a.pickupNotes || '',
      entranceSide: a.entranceSide || '',
      requiresContact: a.requiresContact,
      weatherBlocked: a.weatherBlocked,
    });
    // Show draggable marker at anchor's current position
    onStartAnchorEdit(a);
  }

  async function handleAddMedia() {
    if (!mediaUrl.trim()) return;
    setMediaSaving(true);
    try {
      await onAddMedia(poi.id, 'gallery', mediaUrl.trim());
      setMediaUrl('');
      setShowUrlInput(false);
    } catch {
      toast.error('Failed to add media');
    } finally {
      setMediaSaving(false);
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMediaUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await api.uploadFile(file, 'pois');
        await onAddMedia(poi.id, 'gallery', result.url);
      }
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload photo');
    } finally {
      setMediaUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Helpers
  const isMerchantPoi = !!poi.merchantId;
  const merchantMedia = poi.media?.gallery?.filter(g => g.source === 'merchant_sync') || [];
  const adminMedia = poi.media?.gallery?.filter(g => g.source !== 'merchant_sync') || [];
  const coverIsMerchant = poi.media?.cover?.source === 'merchant_sync';

  const inputCls = 'w-full px-2.5 py-1.5 text-[12px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]';

  // Editorial lock keys
  const lockedFields = Object.keys(poi.editorialLock || {}).filter(k => (poi.editorialLock as any)?.[k]);

  return (
    <div className="absolute top-4 right-4 w-[380px] bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-lg overflow-hidden z-10 max-h-[calc(100%-32px)] overflow-y-auto">
      {/* ── Header ────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editMode ? (
              <input
                value={editFields.name}
                onChange={e => setEditFields({ ...editFields, name: e.target.value })}
                className="text-[14px] w-full bg-transparent border-b border-[var(--border)] outline-none text-[var(--foreground)] pb-0.5"
                style={{ fontWeight: 600 }}
              />
            ) : (
              <h3 className="text-[14px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>
                {poi.displayName || poi.name}
              </h3>
            )}
            {poi.displayName && !editMode && (
              <p className="text-[11px] text-[var(--muted-foreground)] truncate">{poi.name}</p>
            )}
            <p className="text-[11px] text-[var(--muted-foreground)] font-mono truncate">{poi.id}</p>
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {canEdit && !editMode && (
              <button
                onClick={() => {
                  setEditMode(true);
                  setEditFields({
                    name: poi.name, displayName: poi.displayName || '',
                    kind: poi.kind || 'attraction',
                    type: poi.type,
                    status: (poi.status || 'unknown') as POIStatus,
                    fullAddress: poi.fullAddress || '',
                    barangay: poi.barangay || '', city: poi.city || '', province: poi.province || '',
                    priorityScore: poi.priorityScore, visibility: poi.visibility,
                    isIslandHotspot: poi.isIslandHotspot, isTouristArea: poi.isTouristArea,
                    oneLiner: poi.oneLiner || '',
                    descriptionShort: poi.descriptionShort || '',
                    descriptionLong: poi.descriptionLong || '',
                    visitHint: poi.visitHint || '',
                    accessHint: poi.accessHint || '',
                    coverImageUrl: poi.coverImageUrl || '',
                    contactPhone: poi.contactPhone || '',
                    website: poi.website || '',
                    priceLevel: poi.priceLevel || '',
                    operatingHours: JSON.stringify(poi.operatingHours || {}, null, 2),
                    socialLinks: JSON.stringify(poi.socialLinks || {}, null, 2),
                  });
                }}
                className="p-1 rounded hover:bg-[var(--accent)]"
                aria-label="Edit POI"
              >
                <Edit3 size={12} className="text-[var(--muted-foreground)]" />
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--accent)]" aria-label="Close detail">
              <XCircle size={14} className="text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status badges */}
        <div className="flex gap-1.5 flex-wrap">
          <StatusBadge status={poi.isVerified ? 'verified' : 'pending'} />
          <StatusBadge status={poi.isActive ? 'active' : 'inactive'} />
          {poi.kind && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800" style={{ fontWeight: 600 }}>
              {poi.kind.replace('_', ' ')}
            </span>
          )}
          {poi.status && poi.status !== 'unknown' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              poi.status === 'open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
              : poi.status === 'closed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
            }`}>
              {poi.status.replace('_', ' ')}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
            {poi.visibility}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--muted-foreground)]">
            rev {poi.revision}
          </span>
          {poi.isIslandHotspot && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800 flex items-center gap-1">
              <Flame size={8} /> Hotspot
            </span>
          )}
          {poi.isTouristArea && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800 flex items-center gap-1">
              <Palmtree size={8} /> Tourist
            </span>
          )}
        </div>

        {/* Editorial Lock Warning */}
        {lockedFields.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <Lock size={12} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400" style={{ fontWeight: 600 }}>Editorial Lock</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500">
                Locked fields skip merchant sync: {lockedFields.join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Info grid */}
        {editMode ? (
          <div className="space-y-2">
            <input value={editFields.displayName} onChange={e => setEditFields({ ...editFields, displayName: e.target.value })} placeholder="Display name (user-facing)" className={inputCls} />
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Kind</label>
                <select value={editFields.kind} onChange={e => setEditFields({ ...editFields, kind: e.target.value })} className={inputCls}>
                  {poiKinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Type</label>
                <select value={editFields.type} onChange={e => setEditFields({ ...editFields, type: e.target.value })} className={inputCls}>
                  {poiTypes.filter(t => !t.kindId || t.kindId === editFields.kind).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Status</label>
              <select value={editFields.status} onChange={e => setEditFields({ ...editFields, status: e.target.value as POIStatus })} className={inputCls}>
                {POI_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <input value={editFields.fullAddress} onChange={e => setEditFields({ ...editFields, fullAddress: e.target.value })} placeholder="Full address" className={inputCls} />
            <div className="grid grid-cols-3 gap-1.5">
              <input value={editFields.barangay} onChange={e => setEditFields({ ...editFields, barangay: e.target.value })} placeholder="Barangay" className={inputCls} />
              <input value={editFields.city} onChange={e => setEditFields({ ...editFields, city: e.target.value })} placeholder="City" className={inputCls} />
              <input value={editFields.province} onChange={e => setEditFields({ ...editFields, province: e.target.value })} placeholder="Province" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]">Priority (0–100)</label>
                <input type="number" min={0} max={100} value={editFields.priorityScore} onChange={e => setEditFields({ ...editFields, priorityScore: parseInt(e.target.value) || 0 })} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]">Visibility</label>
                <select value={editFields.visibility} onChange={e => setEditFields({ ...editFields, visibility: e.target.value as any })} className={inputCls}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="ops_only">Ops Only</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--foreground)] cursor-pointer">
                <input type="checkbox" checked={editFields.isIslandHotspot} onChange={e => setEditFields({ ...editFields, isIslandHotspot: e.target.checked })} className="rounded" />
                Island Hotspot
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--foreground)] cursor-pointer">
                <input type="checkbox" checked={editFields.isTouristArea} onChange={e => setEditFields({ ...editFields, isTouristArea: e.target.checked })} className="rounded" />
                Tourist Area
              </label>
            </div>

            {/* ── Detail Fields ── */}
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Detail Fields</p>
              <input value={editFields.oneLiner} onChange={e => setEditFields({ ...editFields, oneLiner: e.target.value })} placeholder="One-liner (e.g. Best sunset view)" className={inputCls} />
              <textarea value={editFields.descriptionShort} onChange={e => setEditFields({ ...editFields, descriptionShort: e.target.value })} placeholder="Short description (1-2 sentences)" rows={2} className={`${inputCls} resize-none`} />
              <textarea value={editFields.descriptionLong} onChange={e => setEditFields({ ...editFields, descriptionLong: e.target.value })} placeholder="Full description" rows={4} className={`${inputCls} resize-none`} />
              <input value={editFields.visitHint} onChange={e => setEditFields({ ...editFields, visitHint: e.target.value })} placeholder="Visit hint (e.g. Best in early morning)" className={inputCls} />
              <input value={editFields.accessHint} onChange={e => setEditFields({ ...editFields, accessHint: e.target.value })} placeholder="Access hint (e.g. Take habal-habal from GL)" className={inputCls} />
              <input value={editFields.coverImageUrl} onChange={e => setEditFields({ ...editFields, coverImageUrl: e.target.value })} placeholder="Cover image URL" className={inputCls} />
              <input value={editFields.contactPhone} onChange={e => setEditFields({ ...editFields, contactPhone: e.target.value })} placeholder="Contact phone" className={inputCls} />
              <input value={editFields.website} onChange={e => setEditFields({ ...editFields, website: e.target.value })} placeholder="Website URL" className={inputCls} />
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]">Price Level</label>
                <select value={editFields.priceLevel} onChange={e => setEditFields({ ...editFields, priceLevel: e.target.value })} className={inputCls}>
                  <option value="">Not set</option>
                  <option value="free">Free</option>
                  <option value="₱">₱ Budget</option>
                  <option value="₱₱">₱₱ Moderate</option>
                  <option value="₱₱₱">₱₱₱ Upscale</option>
                  <option value="₱₱₱₱">₱₱₱₱ Premium</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]">Operating Hours (JSON)</label>
                <textarea value={editFields.operatingHours} onChange={e => setEditFields({ ...editFields, operatingHours: e.target.value })} rows={4} className={`${inputCls} resize-none font-mono text-[11px]`} placeholder='{"mon":{"open":"08:00","close":"22:00"}}' />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)]">Social Links (JSON)</label>
                <textarea value={editFields.socialLinks} onChange={e => setEditFields({ ...editFields, socialLinks: e.target.value })} rows={3} className={`${inputCls} resize-none font-mono text-[11px]`} placeholder='{"facebook":"url","instagram":"@handle"}' />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-1.5 text-[12px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50" style={{ fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditMode(false)} className="px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Kind</p>
              <p className="text-[var(--foreground)] capitalize">{(poi.kind || 'unknown').replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Category</p>
              <p className="text-[var(--foreground)]">{poi.type}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Source</p>
              <p className="text-[var(--foreground)]">{poi.source}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Address</p>
              <p className="text-[var(--foreground)]">{poi.fullAddress || poi.barangay || 'No address'}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Coordinates</p>
              <p className="font-mono text-[11px] text-[var(--foreground)]">{poi.centerLat}, {poi.centerLng}</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Confidence</p>
              <p className="text-[var(--foreground)]">{Math.round(Number(poi.confidence) * 100)}%</p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Priority</p>
              <p className="text-[var(--foreground)]">{poi.priorityScore}</p>
            </div>
            {poi.merchantId && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Merchant</p>
                <p className="font-mono text-[11px] text-[var(--foreground)] truncate">{poi.merchantId}</p>
              </div>
            )}
            {poi.serviceAreaId && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Service Area</p>
                <p className="font-mono text-[11px] text-[var(--foreground)]">{poi.serviceAreaId}</p>
              </div>
            )}
            {(poi.tags?.length || 0) > 0 && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Tags</p>
                <div className="flex flex-wrap gap-1">
                  {poi.tags.map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* ── New detail fields in view mode ── */}
            {poi.oneLiner && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>One-liner</p>
                <p className="text-[var(--foreground)] text-[12px] italic">{poi.oneLiner}</p>
              </div>
            )}
            {poi.descriptionShort && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Short Description</p>
                <p className="text-[var(--foreground)] text-[11px] leading-relaxed">{poi.descriptionShort}</p>
              </div>
            )}
            {poi.descriptionLong && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Full Description</p>
                <p className="text-[var(--foreground)] text-[11px] leading-relaxed">{poi.descriptionLong}</p>
              </div>
            )}
            {poi.visitHint && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Visit Hint</p>
                <p className="text-[var(--foreground)] text-[11px]">{poi.visitHint}</p>
              </div>
            )}
            {poi.accessHint && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Access Hint</p>
                <p className="text-[var(--foreground)] text-[11px]">{poi.accessHint}</p>
              </div>
            )}
            {poi.coverImageUrl && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Cover Image</p>
                <img src={poi.coverImageUrl} alt="Cover" className="w-full h-24 object-cover rounded-lg" />
              </div>
            )}
            {poi.trustBadges && poi.trustBadges.length > 0 && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Trust Badges</p>
                <div className="flex flex-wrap gap-1">
                  {poi.trustBadges.map((b: string) => (
                    <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {poi.priceLevel && (
              <div>
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Price Level</p>
                <p className="text-[var(--foreground)]">{poi.priceLevel}</p>
              </div>
            )}
            {poi.contactPhone && (
              <div>
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Phone</p>
                <p className="text-[var(--foreground)]">{poi.contactPhone}</p>
              </div>
            )}
            {poi.website && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Website</p>
                <a href={poi.website} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate block">{poi.website}</a>
              </div>
            )}
            {poi.operatingHours && Object.keys(poi.operatingHours).length > 0 && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Operating Hours</p>
                <div className="text-[11px] text-[var(--foreground)] space-y-0.5">
                  {Object.entries(poi.operatingHours).filter(([k]) => k !== 'notes').map(([day, hrs]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize text-[var(--muted-foreground)]">{day}</span>
                      <span>{typeof hrs === 'object' && hrs !== null ? `${(hrs as any).open || '?'} – ${(hrs as any).close || '?'}` : String(hrs)}</span>
                    </div>
                  ))}
                  {(poi.operatingHours as any)?.notes && (
                    <p className="text-[10px] text-[var(--muted-foreground)] italic mt-1">{(poi.operatingHours as any).notes}</p>
                  )}
                </div>
              </div>
            )}
            {poi.socialLinks && Object.keys(poi.socialLinks).length > 0 && (
              <div className="col-span-2">
                <p className="text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Social Links</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(poi.socialLinks).map(([platform, handle]) => (
                    <span key={platform} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                      {platform}: {handle}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Geo Details (collapsible) ────────── */}
        {!editMode && (poi.barangay || poi.city || poi.province || poi.streetName || poi.buildingName) && (
          <div>
            <button
              onClick={() => setShowGeo(!showGeo)}
              className="flex items-center gap-2 text-[12px] w-full text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              <Navigation size={12} aria-hidden="true" />
              Location Details
              <ChevronDown size={12} className={`ml-auto transition-transform ${showGeo ? 'rotate-180' : ''}`} />
            </button>
            {showGeo && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                {poi.barangay && <div><p className="text-[var(--muted-foreground)]">Barangay</p><p className="text-[var(--foreground)]">{poi.barangay}</p></div>}
                {poi.city && <div><p className="text-[var(--muted-foreground)]">City</p><p className="text-[var(--foreground)]">{poi.city}</p></div>}
                {poi.province && <div><p className="text-[var(--muted-foreground)]">Province</p><p className="text-[var(--foreground)]">{poi.province}</p></div>}
                {poi.country && <div><p className="text-[var(--muted-foreground)]">Country</p><p className="text-[var(--foreground)]">{poi.country}</p></div>}
                {poi.streetName && <div><p className="text-[var(--muted-foreground)]">Street</p><p className="text-[var(--foreground)]">{poi.streetNumber ? `${poi.streetNumber} ` : ''}{poi.streetName}</p></div>}
                {poi.buildingName && <div><p className="text-[var(--muted-foreground)]">Building</p><p className="text-[var(--foreground)]">{poi.buildingName}{poi.floor ? `, ${poi.floor}F` : ''}</p></div>}
              </div>
            )}
          </div>
        )}

        {/* ── Anchors ───────────────────────────── */}
        <div>
          <button
            onClick={() => setShowAnchors(!showAnchors)}
            className="flex items-center gap-2 text-[12px] w-full text-[var(--foreground)]"
            style={{ fontWeight: 500 }}
          >
            <GripVertical size={12} aria-hidden="true" />
            Anchors ({poi.anchors?.length || 0})
            <ChevronDown size={12} className={`ml-auto transition-transform ${showAnchors ? 'rotate-180' : ''}`} />
          </button>

          {showAnchors && (
            <div className="mt-2 space-y-1.5">
              {(poi.anchors?.length || 0) === 0 && (
                <p className="text-[11px] text-[var(--muted-foreground)]">No anchors yet — add one to set pickup/dropoff points for drivers.</p>
              )}
              {poi.anchors?.map(a => (
                <div key={a.id} className="p-2 bg-[var(--accent)]/50 rounded-lg text-[12px] space-y-1">
                  {/* ── EDIT MODE for this anchor ── */}
                  {editingAnchorId === a.id ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-blue-600 dark:text-blue-400" style={{ fontWeight: 600 }}>Edit Anchor</p>
                      <input
                        value={anchorEditFields.label || ''}
                        onChange={e => setAnchorEditFields({ ...anchorEditFields, label: e.target.value })}
                        placeholder="Label"
                        className={inputCls}
                      />
                      {/* Live drag coordinates */}
                      <div className="p-2 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                        {anchorDragCoords ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                            <div>
                              <p className="text-[10px] text-[var(--muted-foreground)]">Drag the blue pin to reposition</p>
                              <p className="font-mono text-[11px] text-[var(--foreground)]">
                                {anchorDragCoords.lat.toFixed(6)}, {anchorDragCoords.lng.toFixed(6)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
                            {Number(a.pointLat).toFixed(6)}, {Number(a.pointLng).toFixed(6)}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-[var(--muted-foreground)]">Dropoff Zone</label>
                          <select value={anchorEditFields.dropoffZoneType || ''} onChange={e => setAnchorEditFields({ ...anchorEditFields, dropoffZoneType: e.target.value })} className={inputCls}>
                            {dropoffZoneTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--muted-foreground)]">Road Access</label>
                          <select value={anchorEditFields.roadAccessType || ''} onChange={e => setAnchorEditFields({ ...anchorEditFields, roadAccessType: e.target.value })} className={inputCls}>
                            {roadAccessTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted-foreground)]">Pickup Notes</label>
                        <input
                          value={anchorEditFields.pickupNotes || ''}
                          onChange={e => setAnchorEditFields({ ...anchorEditFields, pickupNotes: e.target.value })}
                          placeholder="e.g. Wait near the surf shop"
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-[var(--muted-foreground)]">Entrance Side</label>
                          <select value={anchorEditFields.entranceSide || ''} onChange={e => setAnchorEditFields({ ...anchorEditFields, entranceSide: e.target.value })} className={inputCls}>
                            <option value="">None</option>
                            <option value="north">North</option>
                            <option value="south">South</option>
                            <option value="east">East</option>
                            <option value="west">West</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 pt-3">
                          <label className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)] cursor-pointer">
                            <input type="checkbox" checked={anchorEditFields.requiresContact || false} onChange={e => setAnchorEditFields({ ...anchorEditFields, requiresContact: e.target.checked })} className="rounded" />
                            <Phone size={9} /> Requires Contact
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)] cursor-pointer">
                            <input type="checkbox" checked={anchorEditFields.weatherBlocked || false} onChange={e => setAnchorEditFields({ ...anchorEditFields, weatherBlocked: e.target.checked })} className="rounded" />
                            <CloudRain size={9} /> Weather Blocked
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleSaveAnchorEdit(a.id)}
                          disabled={anchorEditSaving || !anchorEditFields.label}
                          className="flex-1 py-1.5 text-[11px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg disabled:opacity-40"
                          style={{ fontWeight: 500 }}
                        >
                          {anchorEditSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => { setEditingAnchorId(null); setAnchorEditFields({}); onCancelAnchorEdit(); }}
                          className="px-2 py-1.5 text-[11px] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── VIEW MODE ── */
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[var(--foreground)] truncate" style={{ fontWeight: 500 }}>
                            {a.label}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
                            {Number(a.pointLat).toFixed(4)}, {Number(a.pointLng).toFixed(4)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {a.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Default
                            </span>
                          )}
                          {a.isVerified ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 flex items-center gap-0.5" title="Verified">
                              <CheckCircle size={10} /> Verified
                            </span>
                          ) : (canApprove || canEdit) ? (
                            <button
                              onClick={async () => {
                                setVerifyingAnchorId(a.id);
                                try { await onVerifyAnchor(a.id); } catch { /* toast handled in hook */ }
                                finally { setVerifyingAnchorId(null); }
                              }}
                              disabled={verifyingAnchorId === a.id}
                              className="text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex items-center gap-0.5 transition-colors disabled:opacity-40"
                              title="Click to verify anchor"
                            >
                              {verifyingAnchorId === a.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle size={10} />
                              )}
                              Verify
                            </button>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-0.5">
                              Unverified
                            </span>
                          )}
                          {canEdit && (
                            <button onClick={() => startEditAnchor(a)} className="p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950" title="Edit anchor">
                              <Edit3 size={10} className="text-[var(--muted-foreground)]" />
                            </button>
                          )}
                          {canEdit && !a.isDefault && (
                            <button onClick={() => onSetDefaultAnchor(a.id)} className="p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950" title="Set as default">
                              <Star size={12} className="text-[var(--muted-foreground)]" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => onDeleteAnchor(a.id)} className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950" title="Delete anchor">
                              <Trash2 size={10} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Anchor metadata badges */}
                      <div className="flex flex-wrap gap-1">
                        {a.dropoffZoneType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 flex items-center gap-0.5">
                            <MapPin size={7} /> {a.dropoffZoneType}
                          </span>
                        )}
                        {a.roadAccessType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400 flex items-center gap-0.5">
                            <Car size={7} /> {a.roadAccessType}
                          </span>
                        )}
                        {a.requiresContact && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-0.5">
                            <Phone size={7} /> Contact
                          </span>
                        )}
                        {a.weatherBlocked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400 flex items-center gap-0.5">
                            <CloudRain size={7} /> Weather
                          </span>
                        )}
                        {a.entranceSide && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {a.entranceSide} side
                          </span>
                        )}
                      </div>
                      {a.pickupNotes && (
                        <p className="text-[10px] text-[var(--muted-foreground)] italic">"{a.pickupNotes}"</p>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* Create anchor */}
              {canEdit && (
                showNewAnchor ? (
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg space-y-2 border border-blue-200 dark:border-blue-800">
                    <p className="text-[11px] text-blue-700 dark:text-blue-400" style={{ fontWeight: 600 }}>New Anchor</p>
                    <input value={newAnchor.label} onChange={e => setNewAnchor({ ...newAnchor, label: e.target.value })} placeholder="Label (e.g. Main Gate)" className={inputCls} />

                    {/* Coordinates from drag pin */}
                    <div className="p-2 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                      {anchorPlacing && anchorDragCoords ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pin location (drag to adjust)</p>
                            <p className="font-mono text-[12px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>
                              {anchorDragCoords.lat.toFixed(6)}, {anchorDragCoords.lng.toFixed(6)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={onStartAnchorPlace}
                          className="flex items-center gap-2 w-full py-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <MapPin size={12} />
                          Drop pin on map
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-[var(--muted-foreground)]">Dropoff Zone</label>
                        <select value={newAnchor.dropoffZoneType} onChange={e => setNewAnchor({ ...newAnchor, dropoffZoneType: e.target.value })} className={inputCls}>
                          {dropoffZoneTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--muted-foreground)]">Road Access</label>
                        <select value={newAnchor.roadAccessType} onChange={e => setNewAnchor({ ...newAnchor, roadAccessType: e.target.value })} className={inputCls}>
                          {roadAccessTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--muted-foreground)]">Pickup Notes</label>
                      <input
                        value={newAnchor.pickupNotes}
                        onChange={e => setNewAnchor({ ...newAnchor, pickupNotes: e.target.value })}
                        placeholder="e.g. Wait near the surf shop"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-[var(--muted-foreground)]">Entrance Side</label>
                        <select value={newAnchor.entranceSide} onChange={e => setNewAnchor({ ...newAnchor, entranceSide: e.target.value })} className={inputCls}>
                          <option value="">None</option>
                          <option value="north">North</option>
                          <option value="south">South</option>
                          <option value="east">East</option>
                          <option value="west">West</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1 pt-3">
                        <label className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)] cursor-pointer">
                          <input type="checkbox" checked={newAnchor.requiresContact} onChange={e => setNewAnchor({ ...newAnchor, requiresContact: e.target.checked })} className="rounded" />
                          <Phone size={9} /> Contact Req.
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] text-[var(--foreground)] cursor-pointer">
                          <input type="checkbox" checked={newAnchor.weatherBlocked} onChange={e => setNewAnchor({ ...newAnchor, weatherBlocked: e.target.checked })} className="rounded" />
                          <CloudRain size={9} /> Weather Block
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={handleCreateAnchor} disabled={anchorSaving || !newAnchor.label || (!anchorDragCoords && !newAnchor.pointLat)} className="flex-1 py-1.5 text-[11px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg disabled:opacity-40" style={{ fontWeight: 500 }}>
                        {anchorSaving ? 'Creating...' : 'Add Anchor'}
                      </button>
                      <button onClick={() => { setShowNewAnchor(false); onCancelAnchorPlace(); }} className="px-2 py-1.5 text-[11px] border border-[var(--border)] rounded-lg text-[var(--foreground)]">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowNewAnchor(true); onStartAnchorPlace(); }}
                    className="flex items-center gap-1.5 w-full py-1.5 text-[11px] text-blue-600 dark:text-blue-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-colors justify-center"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus size={10} />
                    Add Anchor
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* ── Media ─────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowMedia(!showMedia)}
            className="flex items-center gap-2 text-[12px] w-full text-[var(--foreground)]"
            style={{ fontWeight: 500 }}
          >
            <Image size={12} aria-hidden="true" />
            Media ({poi.media?.gallery?.length || 0})
            <ChevronDown size={12} className={`ml-auto transition-transform ${showMedia ? 'rotate-180' : ''}`} />
          </button>
          {showMedia && (
            <div className="mt-2 space-y-3">
              {/* Cover photo */}
              {poi.media?.cover && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Cover</p>
                    {coverIsMerchant && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 flex items-center gap-0.5">
                        <Store size={7} /> Merchant
                      </span>
                    )}
                  </div>
                  <div className="relative group rounded-lg overflow-hidden border border-[var(--border)]">
                    <img src={poi.media.cover.url} alt="Cover" className="w-full h-[120px] object-cover cursor-pointer" onClick={() => setLightboxUrl(poi.media!.cover!.url)} />
                    {!coverIsMerchant && canDelete && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button onClick={() => onDeleteMedia(poi.media!.cover!.id)} className="p-1.5 bg-red-500/80 rounded-lg">
                          <Trash2 size={12} className="text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Merchant-synced gallery */}
              {merchantMedia.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>From Merchant</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 flex items-center gap-0.5">
                      <Store size={7} /> {merchantMedia.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {merchantMedia.map((g) => (
                      <div key={g.id} className="aspect-square bg-[var(--accent)] rounded-lg relative group overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(g.url)}>
                        <img src={g.url} alt="Merchant gallery" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-1 pb-0.5 pt-3">
                          <span className="text-[8px] text-white/80 flex items-center gap-0.5"><Store size={6} /> Synced</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1 italic">Photos managed in Merchant page — view only here</p>
                </div>
              )}

              {/* Admin-uploaded gallery */}
              {adminMedia.length > 0 && (
                <div>
                  {isMerchantPoi && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 600 }}>Admin Uploads</p>
                  )}
                  <div className="grid grid-cols-3 gap-1.5">
                    {adminMedia.map((g) => (
                      <div key={g.id} className="aspect-square bg-[var(--accent)] rounded-lg relative group overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(g.url)}>
                        <img src={g.url} alt="Gallery" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteMedia(g.id); }}
                              className="p-1 bg-red-500/80 rounded-lg"
                              aria-label="Delete media"
                            >
                              <Trash2 size={10} className="text-white" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(poi.media?.gallery?.length || 0) === 0 && !poi.media?.cover && (
                <p className="text-[11px] text-[var(--muted-foreground)]">No media yet</p>
              )}

              {/* Add media — file upload + URL */}
              {canEdit && (
                <div className="space-y-1.5">
                  {/* File upload */}
                  <label className="flex items-center gap-1.5 w-full py-2 text-[11px] text-blue-600 dark:text-blue-400 border border-dashed border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors justify-center cursor-pointer"
                    style={{ fontWeight: 500 }}>
                    {mediaUploading ? (
                      <><Loader2 size={10} className="animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload size={10} aria-hidden="true" /> Upload Photos</>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" disabled={mediaUploading}
                      onChange={e => handleFileUpload(e.target.files)} />
                  </label>

                  {/* URL input toggle */}
                  {showUrlInput ? (
                    <div className="flex gap-1.5">
                      <input
                        value={mediaUrl}
                        onChange={e => setMediaUrl(e.target.value)}
                        placeholder="Image URL..."
                        className="flex-1 px-2.5 py-1.5 text-[11px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
                        onKeyDown={e => e.key === 'Enter' && handleAddMedia()}
                      />
                      <button
                        onClick={handleAddMedia}
                        disabled={mediaSaving || !mediaUrl.trim()}
                        className="px-2.5 py-1.5 text-[11px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg disabled:opacity-40"
                        style={{ fontWeight: 500 }}
                      >
                        {mediaSaving ? <Loader2 size={10} className="animate-spin" /> : 'Add'}
                      </button>
                      <button onClick={() => { setShowUrlInput(false); setMediaUrl(''); }} className="px-1.5 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        <XCircle size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowUrlInput(true)}
                      className="flex items-center gap-1.5 w-full py-1.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors justify-center"
                    >
                      <Link2 size={9} /> Or add by URL
                    </button>
                  )}
                </div>
              )}

              {/* Lightbox */}
              {lightboxUrl && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
                  <img src={lightboxUrl} alt="Preview" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" />
                  <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
                    <XCircle size={24} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Actions ───────────────────────────── */}
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          {canApprove && !poi.isVerified && (
            <button
              onClick={() => onConfirmAction({ type: 'verify', target: poi })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              style={{ fontWeight: 500 }}
            >
              <CheckCircle size={12} aria-hidden="true" />
              Verify
            </button>
          )}
          {canEdit && poi.isActive && (
            <button
              onClick={() => onConfirmAction({ type: 'deactivate', target: poi })}
              className="flex-1 py-2 text-[12px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] text-[var(--foreground)]"
              style={{ fontWeight: 500 }}
            >
              Deactivate
            </button>
          )}
          {canEdit && !poi.isActive && (
            <button
              onClick={() => onConfirmAction({ type: 'reactivate', target: poi })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              style={{ fontWeight: 500 }}
            >
              Reactivate
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onConfirmAction({ type: 'delete', target: poi })}
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
  );
}
