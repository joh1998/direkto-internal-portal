import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, MapPin, ChevronRight, ChevronLeft, Loader2, Sparkles, Globe, Phone } from 'lucide-react';
import type { POIKind } from '../../../lib/poi-api';
import { POI_STATUS_OPTIONS, type POIStatus } from '../../../lib/poi-api';
import { type CreatePoiForm, EMPTY_CREATE_FORM } from '../hooks/usePOIData';

/* ── Kind visual config ─────────────────────────── */

const KIND_META: Record<string, { icon: string; color: string; bg: string }> = {
  attraction:   { icon: '🏖️', color: 'text-sky-700 dark:text-sky-300',    bg: 'bg-sky-50 dark:bg-sky-950 border-sky-200 dark:border-sky-800' },
  essential:    { icon: '🏥', color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' },
  transport:    { icon: '🚢', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800' },
  merchant:     { icon: '🏪', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' },
  public_place: { icon: '🏛️', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' },
  landmark:     { icon: '📍', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800' },
};

function getKindMeta(kind: string) {
  return KIND_META[kind] || { icon: '📌', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' };
}

/* ── Helpers ─────────────────────────────────────── */

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

async function reverseGeocode(lat: number, lng: number): Promise<{ address?: string; barangay?: string; city?: string; province?: string }> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
      headers: { 'User-Agent': 'DirktoAdmin/1.0' },
    });
    if (!r.ok) return {};
    const d = await r.json();
    const a = d.address || {};
    return {
      address: d.display_name?.split(',').slice(0, 3).join(',').trim(),
      barangay: a.suburb || a.neighbourhood || a.village || '',
      city: a.city || a.town || a.municipality || '',
      province: a.state || a.province || '',
    };
  } catch {
    return {};
  }
}

/* ── Props ──────────────────────────────────────── */

interface POICreateFormProps {
  poiTypes: { id: string; label: string; kindId?: string }[];
  poiKinds: POIKind[];
  onCancel: () => void;
  onSubmit: (form: CreatePoiForm) => Promise<void>;
  mapCoords: { lat: number; lng: number } | null;
}

/* ── Steps ──────────────────────────────────────── */

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'What & Where',
  2: 'Details',
  3: 'Review',
};

/* ── Component ──────────────────────────────────── */

export function POICreateForm({ poiTypes, poiKinds, onCancel, onSubmit, mapCoords }: POICreateFormProps) {
  const [form, setForm] = useState<CreatePoiForm>({ ...EMPTY_CREATE_FORM });
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback(<K extends keyof CreatePoiForm>(key: K, val: CreatePoiForm[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      // Auto-generate ID from name
      if (key === 'name') {
        next.id = slugify(val as string);
        if (!prev.displayName) next.displayName = val as string;
      }
      return next;
    });
  }, []);

  /* ── Kind → filtered types ────────────────────── */

  const filteredTypes = useMemo(() => {
    if (!form.kind) return poiTypes;
    return poiTypes.filter(t => !t.kindId || t.kindId === form.kind);
  }, [form.kind, poiTypes]);

  // Auto-select first type when kind changes
  useEffect(() => {
    if (filteredTypes.length > 0 && !filteredTypes.find(t => t.id === form.type)) {
      set('type', filteredTypes[0].id);
    }
  }, [form.kind, filteredTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Map coord sync ───────────────────────────── */

  useEffect(() => {
    if (!mapCoords) return;
    setForm(prev => ({
      ...prev,
      centerLat: parseFloat(mapCoords.lat.toFixed(6)),
      centerLng: parseFloat(mapCoords.lng.toFixed(6)),
    }));

    // Debounced reverse geocode
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const geo = await reverseGeocode(mapCoords.lat, mapCoords.lng);
      setForm(prev => ({
        ...prev,
        address: geo.address || prev.address,
        barangay: geo.barangay || prev.barangay,
        city: geo.city || prev.city,
        province: geo.province || prev.province,
      }));
      setGeocoding(false);
    }, 600);
  }, [mapCoords]);

  /* ── Submit ───────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.kind || !form.type) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }, [form, onSubmit]);

  /* ── Validation ───────────────────────────────── */

  const step1Valid = form.name.trim().length > 0 && form.kind && form.type;
  const canSubmit = step1Valid;

  /* ── Shared styles ────────────────────────────── */

  const inputCls = 'w-full px-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60';
  const labelCls = 'text-[11px] text-[var(--muted-foreground)] mb-1 block font-semibold';
  const selectCls = inputCls;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--card)]">
      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-[var(--border)] bg-[var(--accent)]/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <MapPin size={12} className="text-[var(--primary-foreground)]" />
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--foreground)]">New POI</h3>
        </div>
        <button onClick={onCancel} className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)]">
          <X size={14} />
        </button>
      </div>

      {/* ── Step indicator ── */}
      <div className="px-4 py-2 flex items-center gap-1 border-b border-[var(--border)] bg-[var(--accent)]/15">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-px bg-[var(--border)]" />}
            <button
              onClick={() => s <= step && setStep(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                s === step
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold'
                  : s < step
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium'
                    : 'bg-[var(--accent)] text-[var(--muted-foreground)]'
              }`}
            >
              {s}. {STEP_LABELS[s]}
            </button>
          </div>
        ))}
      </div>

      {/* ── Step content ── */}
      <div className="px-4 py-3 max-h-[420px] overflow-y-auto space-y-3">
        {/* ─── STEP 1: What & Where ─── */}
        {step === 1 && (
          <>
            {/* Kind selector (visual cards) */}
            <div>
              <label className={labelCls}>Kind *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {poiKinds.filter(k => k.isActive).map(k => {
                  const meta = getKindMeta(k.id);
                  const active = form.kind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => set('kind', k.id)}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-center transition-all ${
                        active
                          ? `${meta.bg} ring-2 ring-[var(--primary)]/40`
                          : 'border-[var(--border)] hover:bg-[var(--accent)]'
                      }`}
                    >
                      <span className="text-[16px]">{meta.icon}</span>
                      <span className={`text-[10px] font-medium ${active ? meta.color : 'text-[var(--foreground)]'}`}>
                        {k.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type */}
            <div>
              <label className={labelCls}>Type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={selectCls}>
                <option value="">Select type…</option>
                {filteredTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              {filteredTypes.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">No types available for this kind.</p>
              )}
            </div>

            {/* Name + Display Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Name (slug) *</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. cloud_9"
                  className={inputCls}
                />
                {form.id && (
                  <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5">ID: {form.id}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => set('displayName', e.target.value)}
                  placeholder="e.g. Cloud 9"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Map coordinates */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Location</label>
                {geocoding && (
                  <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Geocoding…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-background)]">
                <MapPin size={13} className="text-blue-500 shrink-0" />
                <span className="text-[12px] text-[var(--foreground)] font-mono">
                  {form.centerLat.toFixed(5)}, {form.centerLng.toFixed(5)}
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                ← Drag the pin on the map to set location
              </p>
            </div>

            {/* Address (auto-filled) */}
            <div>
              <label className={labelCls}>Address</label>
              <input
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="Auto-filled from map"
                className={inputCls}
              />
              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                <input value={form.barangay} onChange={e => set('barangay', e.target.value)} placeholder="Barangay" className={inputCls} />
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" className={inputCls} />
                <input value={form.province} onChange={e => set('province', e.target.value)} placeholder="Province" className={inputCls} />
              </div>
            </div>
          </>
        )}

        {/* ─── STEP 2: Details ─── */}
        {step === 2 && (
          <>
            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as POIStatus)} className={selectCls}>
                {POI_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* One-liner */}
            <div>
              <label className={labelCls}>One-liner</label>
              <input
                value={form.oneLiner}
                onChange={e => set('oneLiner', e.target.value)}
                placeholder="A short catchy tagline…"
                className={inputCls}
                maxLength={120}
              />
              <p className="text-[9px] text-[var(--muted-foreground)] mt-0.5 text-right">{form.oneLiner.length}/120</p>
            </div>

            {/* Descriptions */}
            <div>
              <label className={labelCls}>Short Description</label>
              <textarea
                value={form.descriptionShort}
                onChange={e => set('descriptionShort', e.target.value)}
                placeholder="Brief intro (1-2 sentences)"
                className={inputCls + ' resize-none'}
                rows={2}
              />
            </div>
            <div>
              <label className={labelCls}>Full Description</label>
              <textarea
                value={form.descriptionLong}
                onChange={e => set('descriptionLong', e.target.value)}
                placeholder="Detailed description…"
                className={inputCls + ' resize-none'}
                rows={3}
              />
            </div>

            {/* Hints */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Visit Hint</label>
                <input
                  value={form.visitHint}
                  onChange={e => set('visitHint', e.target.value)}
                  placeholder="Best time to visit…"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Access Hint</label>
                <input
                  value={form.accessHint}
                  onChange={e => set('accessHint', e.target.value)}
                  placeholder="How to get there…"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Contact & Web */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}><Phone size={9} className="inline mr-1" />Phone</label>
                <input
                  value={form.contactPhone}
                  onChange={e => set('contactPhone', e.target.value)}
                  placeholder="+63…"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}><Globe size={9} className="inline mr-1" />Website</label>
                <input
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Price Level & Visibility */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Price Level</label>
                <select value={form.priceLevel} onChange={e => set('priceLevel', e.target.value)} className={selectCls}>
                  <option value="">Not set</option>
                  <option value="free">Free</option>
                  <option value="$">$ Budget</option>
                  <option value="$$">$$ Mid</option>
                  <option value="$$$">$$$ Premium</option>
                  <option value="$$$$">$$$$ Luxury</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Visibility</label>
                <select value={form.visibility} onChange={e => set('visibility', e.target.value as 'public' | 'private' | 'ops_only')} className={selectCls}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="ops_only">Ops Only</option>
                </select>
              </div>
            </div>

            {/* Tags + Hotspot flags */}
            <div>
              <label className={labelCls}>Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="surf, beach, sunset…"
                className={inputCls}
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-[12px] text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isIslandHotspot}
                  onChange={e => set('isIslandHotspot', e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                Island Hotspot
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isTouristArea}
                  onChange={e => set('isTouristArea', e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                Tourist Area
              </label>
            </div>

            {/* Cover Image URL */}
            <div>
              <label className={labelCls}>Cover Image URL</label>
              <input
                value={form.coverImageUrl}
                onChange={e => set('coverImageUrl', e.target.value)}
                placeholder="https://images…"
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* ─── STEP 3: Review ─── */}
        {step === 3 && (
          <div className="space-y-2.5">
            <p className="text-[12px] text-[var(--muted-foreground)] flex items-center gap-1">
              <Sparkles size={12} /> Review before creating
            </p>

            {/* Summary card */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/20 p-3 space-y-2">
              {/* Kind + Type */}
              <div className="flex items-center gap-2">
                <span className="text-[16px]">{getKindMeta(form.kind).icon}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">
                    {form.displayName || form.name || '(untitled)'}
                  </p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {poiKinds.find(k => k.id === form.kind)?.label || form.kind} · {filteredTypes.find(t => t.id === form.type)?.label || form.type}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2 text-[11px]">
                <MapPin size={11} className="text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-mono text-[var(--foreground)]">{form.centerLat.toFixed(5)}, {form.centerLng.toFixed(5)}</p>
                  {form.address && <p className="text-[var(--muted-foreground)] mt-0.5">{form.address}</p>}
                  {(form.barangay || form.city) && (
                    <p className="text-[var(--muted-foreground)]">{[form.barangay, form.city, form.province].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              {/* Details */}
              {form.oneLiner && (
                <p className="text-[11px] italic text-[var(--foreground)]">"{form.oneLiner}"</p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-[var(--accent)] border border-[var(--border)]">
                  {form.status}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--accent)] border border-[var(--border)]">
                  {form.visibility}
                </span>
                {form.priceLevel && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--accent)] border border-[var(--border)]">
                    {form.priceLevel}
                  </span>
                )}
                {form.isIslandHotspot && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                    Hotspot
                  </span>
                )}
                {form.isTouristArea && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                    Tourist
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation footer ── */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[var(--accent)]/15">
        {step > 1 ? (
          <button
            onClick={() => setStep((step - 1) as Step)}
            className="flex items-center gap-1 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <ChevronLeft size={13} /> Back
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        )}

        {step < 3 ? (
          <button
            onClick={() => setStep((step + 1) as Step)}
            disabled={step === 1 && !step1Valid}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-[12px] font-medium hover:opacity-90 disabled:opacity-40 transition-all"
          >
            Next <ChevronRight size={13} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 disabled:opacity-40 transition-all"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Create POI
          </button>
        )}
      </div>
    </div>
  );
}
