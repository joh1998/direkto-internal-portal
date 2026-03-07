import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, AlertCircle, Loader2 } from 'lucide-react';
import type { CreatePoiForm } from '../hooks/usePOIData';

/* ── Props ──────────────────────────────────────── */

interface POICreateFormProps {
  poiTypes: { id: string; label: string }[];
  onCancel: () => void;
  onSubmit: (form: CreatePoiForm) => Promise<void>;
  /** Coordinates set by dragging the marker or clicking on the map */
  mapCoords: { lat: number; lng: number } | null;
}

/* ── Helpers ────────────────────────────────────── */

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/** Reverse geocode via Nominatim (OSM) — returns address components */
async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  barangay?: string;
  city?: string;
  province?: string;
} | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'Accept-Language': 'en' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.address) return null;
    const a = data.address;
    return {
      address: data.display_name || '',
      barangay: a.suburb || a.neighbourhood || a.village || a.hamlet || '',
      city: a.city || a.town || a.municipality || '',
      province: a.state || a.province || a.county || '',
    };
  } catch {
    return null;
  }
}

/* ── Component ──────────────────────────────────── */

export function POICreateForm({ poiTypes, onCancel, onSubmit, mapCoords }: POICreateFormProps) {
  const [form, setForm] = useState<CreatePoiForm>({
    id: '',
    name: '',
    displayName: '',
    type: poiTypes[0]?.id || 'restaurant',
    address: '',
    barangay: '',
    city: '',
    province: '',
    centerLat: mapCoords?.lat ?? 0,
    centerLng: mapCoords?.lng ?? 0,
    serviceAreaId: '',
    visibility: 'public',
    tags: '',
    isIslandHotspot: false,
    isTouristArea: false,
    description: '',
    contactPhone: '',
    website: '',
    priceLevel: '',
    amenities: '',
  });
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedRef = useRef('');

  // Reverse geocode when coordinates change (debounced)
  const doReverseGeocode = useCallback(async (lat: number, lng: number) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === lastGeocodedRef.current) return;
    if (lat === 0 && lng === 0) return;
    lastGeocodedRef.current = key;
    setGeocoding(true);
    const result = await reverseGeocode(lat, lng);
    setGeocoding(false);
    if (result) {
      setForm(prev => ({
        ...prev,
        address: result.address,
        barangay: result.barangay || prev.barangay,
        city: result.city || prev.city,
        province: result.province || prev.province,
      }));
    }
  }, []);

  // Sync map drag/click coords + trigger geocode
  if (mapCoords && (mapCoords.lat !== form.centerLat || mapCoords.lng !== form.centerLng)) {
    setForm(prev => ({ ...prev, centerLat: mapCoords.lat, centerLng: mapCoords.lng }));
    // Debounced reverse geocode
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => doReverseGeocode(mapCoords.lat, mapCoords.lng), 500);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    const slug = form.id.trim() || slugify(form.name);
    if (!slug) errs.id = 'Slug ID is required';
    else if (!/^[a-z0-9_]+$/.test(slug)) errs.id = 'Only lowercase letters, numbers, and underscores';
    if (!form.centerLat && !form.centerLng) errs.coords = 'Click the map to set coordinates';
    else if (form.centerLat < -90 || form.centerLat > 90) errs.coords = 'Latitude must be between -90 and 90';
    else if (form.centerLng < -180 || form.centerLng > 180) errs.coords = 'Longitude must be between -180 and 180';
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create POI';
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('409')) {
        setErrors({ id: 'This slug ID already exists. Choose a different one.' });
      } else {
        setApiError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]';
  const errorInputCls = 'w-full px-3 py-2 text-[13px] bg-[var(--card)] border border-red-400 rounded-lg outline-none text-[var(--foreground)]';

  return (
    <div className="px-4 py-4 border-b border-[var(--border)] bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Create New POI</p>
        <button onClick={onCancel} className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          Cancel
        </button>
      </div>

      {/* API error banner */}
      {apiError && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle size={12} className="text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400">{apiError}</p>
        </div>
      )}

      {/* Name → auto-slug */}
      <div>
        <input
          value={form.name}
          onChange={e => { setForm({ ...form, name: e.target.value, id: slugify(e.target.value) }); setErrors(prev => ({ ...prev, name: '' })); }}
          placeholder="POI Name *"
          className={errors.name ? errorInputCls : inputCls}
        />
        {errors.name && <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
      </div>

      {/* Slug */}
      <div>
        <input
          value={form.id}
          onChange={e => { setForm({ ...form, id: e.target.value.replace(/[^a-z0-9_]/g, '') }); setErrors(prev => ({ ...prev, id: '' })); }}
          placeholder="unique_slug_id"
          className={`${errors.id ? errorInputCls : inputCls} font-mono`}
        />
        {errors.id && <p className="text-[10px] text-red-500 mt-0.5">{errors.id}</p>}
      </div>

      {/* Display Name (optional) */}
      <input
        value={form.displayName}
        onChange={e => setForm({ ...form, displayName: e.target.value })}
        placeholder="Display name (optional)"
        className={inputCls}
      />

      {/* Address (auto-filled by Nominatim) */}
      <div className="relative">
        <input
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="Address (auto-filled from map)"
          className={inputCls}
        />
        {geocoding && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 size={12} className="animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {/* Type */}
      <select
        value={form.type}
        onChange={e => setForm({ ...form, type: e.target.value })}
        className={inputCls}
      >
        {poiTypes.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>

      {/* Coordinates */}
      <div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.0001"
            value={form.centerLat || ''}
            onChange={e => { setForm({ ...form, centerLat: parseFloat(e.target.value) || 0 }); setErrors(prev => ({ ...prev, coords: '' })); }}
            placeholder="Latitude"
            className={errors.coords ? errorInputCls : inputCls}
          />
          <input
            type="number"
            step="0.0001"
            value={form.centerLng || ''}
            onChange={e => { setForm({ ...form, centerLng: parseFloat(e.target.value) || 0 }); setErrors(prev => ({ ...prev, coords: '' })); }}
            placeholder="Longitude"
            className={errors.coords ? errorInputCls : inputCls}
          />
        </div>
        {errors.coords && <p className="text-[10px] text-red-500 mt-0.5">{errors.coords}</p>}
      </div>

      <div className={`flex items-center gap-1.5 text-[11px] ${!form.centerLat && !form.centerLng ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
        <MapPin size={11} />
        {!form.centerLat && !form.centerLng
          ? 'Drag the pin on the map to set location (required)'
          : `Location set: ${form.centerLat.toFixed(4)}, ${form.centerLng.toFixed(4)}`
        }
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
      >
        {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 pt-1">
          {/* Service Area ID */}
          <input
            value={form.serviceAreaId}
            onChange={e => setForm({ ...form, serviceAreaId: e.target.value })}
            placeholder="Service Area ID (optional)"
            className={`${inputCls} font-mono`}
          />

          {/* Visibility */}
          <select
            value={form.visibility}
            onChange={e => setForm({ ...form, visibility: e.target.value as any })}
            className={inputCls}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="ops_only">Ops Only</option>
          </select>

          {/* Tags */}
          <input
            value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="Tags (comma-separated)"
            className={inputCls}
          />

          {/* Boolean checkboxes */}
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isIslandHotspot}
                onChange={e => setForm({ ...form, isIslandHotspot: e.target.checked })}
                className="rounded"
              />
              Island Hotspot
            </label>
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--foreground)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.isTouristArea}
                onChange={e => setForm({ ...form, isTouristArea: e.target.checked })}
                className="rounded"
              />
              Tourist Area
            </label>
          </div>

          {/* ── Detail Fields ── */}
          <div className="pt-2 border-t border-[var(--border)] space-y-3">
            <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Detail Fields (customer-facing)</p>

            {/* Description */}
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Description (about this place)"
              rows={3}
              className={`${inputCls} resize-none`}
            />

            {/* Contact Phone */}
            <input
              value={form.contactPhone}
              onChange={e => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="Contact phone (e.g. +63 912 345 6789)"
              className={inputCls}
            />

            {/* Website */}
            <input
              value={form.website}
              onChange={e => setForm({ ...form, website: e.target.value })}
              placeholder="Website URL"
              className={inputCls}
            />

            {/* Price Level */}
            <div>
              <label className="text-[10px] text-[var(--muted-foreground)]">Price Level</label>
              <select
                value={form.priceLevel}
                onChange={e => setForm({ ...form, priceLevel: e.target.value })}
                className={inputCls}
              >
                <option value="">Not set</option>
                <option value="free">Free</option>
                <option value="₱">₱ — Budget</option>
                <option value="₱₱">₱₱ — Moderate</option>
                <option value="₱₱₱">₱₱₱ — Upscale</option>
                <option value="₱₱₱₱">₱₱₱₱ — Premium</option>
              </select>
            </div>

            {/* Amenities */}
            <input
              value={form.amenities}
              onChange={e => setForm({ ...form, amenities: e.target.value })}
              placeholder="Amenities (comma-separated, e.g. wifi, parking, restroom)"
              className={inputCls}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-2 text-[13px] bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
        style={{ fontWeight: 500 }}
      >
        {saving ? 'Creating...' : 'Create POI'}
      </button>
    </div>
  );
}
