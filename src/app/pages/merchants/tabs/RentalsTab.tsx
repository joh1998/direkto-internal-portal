// ── Rentals Tab — Templates + Unit Management (Improved) ─────
// Full-screen modals for template & unit CRUD.
// Template cards with photo preview + stats.
// Click template → fullscreen unit manager.
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown,
  ChevronRight, Wrench, Package, X, Upload, Pencil,
  ArrowLeft, ImageIcon, AlertCircle, Check,
  Hash, Palette, Calendar, Truck, DollarSign, Info,
} from 'lucide-react';
import { api } from '../../../lib/api';
import {
  fetchRentalCategories, fetchMerchantTemplates,
  adminCreateTemplate, adminUpdateTemplate, adminDeleteTemplate,
  fetchTemplateUnits, adminCreateUnit, adminUpdateUnit, adminDeleteUnit,
  type ApiMerchant, type RentalCategory, type RentalTemplate,
  type CreateTemplatePayload, type UpdateTemplatePayload,
  type AdminUnit, type CreateUnitPayload, type UpdateUnitPayload,
} from '../../../lib/merchants-api';
import { peso } from '../helpers';

// ── Types ───────────────────────────────────────────────────
interface Props {
  merchant: ApiMerchant;
  canEdit: boolean;
  onRefreshMerchant: () => void;
}

type TemplateFormData = {
  name: string; categoryId: number | ''; description: string;
  baseDailyRate: string; baseWeeklyRate: string; baseMonthlyRate: string;
  features: string; cancellationPolicy: string;
  photos: { file?: File; preview: string; url?: string }[];
};

type UnitFormData = {
  unitNumber: string; unitName: string; plateNumber: string;
  serialNumber: string; color: string; year: string;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR';
  dailyRate: string; weeklyRate: string; monthlyRate: string;
  depositAmount: string; replacementValue: string;
  deliveryAvailable: boolean; deliveryFee: string;
  photos: { file?: File; preview: string; url?: string }[];
};

const emptyTplForm = (): TemplateFormData => ({
  name: '', categoryId: '', description: '',
  baseDailyRate: '', baseWeeklyRate: '', baseMonthlyRate: '',
  features: '', cancellationPolicy: '', photos: [],
});

const emptyUnitForm = (): UnitFormData => ({
  unitNumber: '', unitName: '', plateNumber: '',
  serialNumber: '', color: '', year: '',
  condition: 'EXCELLENT',
  dailyRate: '', weeklyRate: '', monthlyRate: '',
  depositAmount: '', replacementValue: '',
  deliveryAvailable: false, deliveryFee: '', photos: [],
});

// ── Shared styles ───────────────────────────────────────────
const inp = "w-full px-3 py-2.5 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--ring)]/30 focus:border-[var(--ring)] text-[var(--foreground)] transition-all placeholder:text-[var(--muted-foreground)]/60";
const labelCls = "block text-[12px] text-[var(--muted-foreground)] mb-1.5";
const conditionColors: Record<string, string> = {
  EXCELLENT: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  GOOD: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  FAIR: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

// ═════════════════════════════════════════════════════════════
export function RentalsTab({ merchant: m, canEdit, onRefreshMerchant }: Props) {
  // ── Core state ────────────────────────────────────────────
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [templates, setTemplates] = useState<RentalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // ── Template modal (create / edit) ────────────────────────
  const [tplModal, setTplModal] = useState<'create' | 'edit' | null>(null);
  const [tplForm, setTplForm] = useState<TemplateFormData>(emptyTplForm());
  const [tplEditId, setTplEditId] = useState<number | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplUploading, setTplUploading] = useState(false);

  // ── Unit manager (full screen for a template) ─────────────
  const [unitManagerTpl, setUnitManagerTpl] = useState<RentalTemplate | null>(null);
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsTplMeta, setUnitsTplMeta] = useState<{ total: number; available: number }>({ total: 0, available: 0 });

  // ── Unit modal (create / edit) ────────────────────────────
  const [unitModal, setUnitModal] = useState<'create' | 'edit' | null>(null);
  const [unitForm, setUnitForm] = useState<UnitFormData>(emptyUnitForm());
  const [unitEditId, setUnitEditId] = useState<number | null>(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitUploading, setUnitUploading] = useState(false);

  // ── Confirm delete ────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'template' | 'unit'; id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load data ─────────────────────────────────────────────
  useEffect(() => { fetchRentalCategories().then(setCategories).catch(() => {}); }, []);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    fetchMerchantTemplates(m.id)
      .then(t => { setTemplates(t); setExpandedCats(new Set()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [m.id]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const loadUnits = useCallback(async (tpl: RentalTemplate) => {
    setUnitsLoading(true);
    try {
      const res = await fetchTemplateUnits(m.id, tpl.id);
      setUnits(res.data);
      setUnitsTplMeta({ total: res.totalUnits, available: res.availableUnits });
    } catch { setUnits([]); }
    finally { setUnitsLoading(false); }
  }, [m.id]);

  // ── Template helpers ──────────────────────────────────────
  const categoryMap = new Map<string, RentalTemplate[]>();
  for (const t of templates) {
    const catName = (t as any).categoryName || 'Uncategorized';
    if (!categoryMap.has(catName)) categoryMap.set(catName, []);
    categoryMap.get(catName)!.push(t);
  }

  function toggleCat(name: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function openCreateTemplate() {
    setTplForm(emptyTplForm());
    setTplEditId(null);
    setTplModal('create');
  }

  function openEditTemplate(t: RentalTemplate) {
    setTplForm({
      name: t.name,
      categoryId: t.categoryId || '',
      description: t.description || '',
      baseDailyRate: t.baseDailyRate || '',
      baseWeeklyRate: t.baseWeeklyRate || '',
      baseMonthlyRate: t.baseMonthlyRate || '',
      features: t.features?.join(', ') || '',
      cancellationPolicy: t.cancellationPolicy || '',
      photos: (t.templatePhotos || []).map(url => ({ preview: url, url })),
    });
    setTplEditId(t.id);
    setTplModal('edit');
  }

  function openUnitManager(t: RentalTemplate) {
    setUnitManagerTpl(t);
    loadUnits(t);
  }

  // ── Photo upload helper ───────────────────────────────────
  async function uploadPhotos(photos: { file?: File; url?: string }[], folder: string): Promise<string[]> {
    const existingUrls = photos.filter(p => p.url).map(p => p.url!);
    const newFiles = photos.filter(p => p.file).map(p => p.file!);
    if (newFiles.length === 0) return existingUrls;
    const uploaded = await api.uploadFiles(newFiles, folder);
    return [...existingUrls, ...uploaded.map(r => r.url)];
  }

  // ── Template CRUD ─────────────────────────────────────────
  async function handleSaveTemplate() {
    const f = tplForm;
    if (!f.name.trim() || !f.categoryId || f.description.trim().length < 10 || !f.baseDailyRate) return;
    setTplSaving(true);
    try {
      let photoUrls: string[] = [];
      if (f.photos.length > 0) {
        setTplUploading(true);
        try { photoUrls = await uploadPhotos(f.photos, 'templates'); }
        catch (e: any) { toast.error(`Photo upload failed: ${e?.message}`); setTplUploading(false); setTplSaving(false); return; }
        setTplUploading(false);
      }

      if (tplModal === 'create') {
        const payload: CreateTemplatePayload = {
          name: f.name.trim(), categoryId: Number(f.categoryId),
          description: f.description.trim(), baseDailyRate: parseFloat(f.baseDailyRate),
        };
        if (f.baseWeeklyRate) payload.baseWeeklyRate = parseFloat(f.baseWeeklyRate);
        if (f.baseMonthlyRate) payload.baseMonthlyRate = parseFloat(f.baseMonthlyRate);
        if (f.features.trim()) payload.features = f.features.split(',').map(s => s.trim()).filter(Boolean);
        if (f.cancellationPolicy.trim()) payload.cancellationPolicy = f.cancellationPolicy.trim();
        if (photoUrls.length) payload.templatePhotos = photoUrls;
        const res = await adminCreateTemplate(m.id, payload);
        if (res.success) { toast.success(`Template "${f.name}" created`); setTplModal(null); loadTemplates(); onRefreshMerchant(); }
      } else if (tplModal === 'edit' && tplEditId) {
        const payload: UpdateTemplatePayload = {
          name: f.name.trim(), categoryId: Number(f.categoryId),
          description: f.description.trim(), baseDailyRate: parseFloat(f.baseDailyRate),
        };
        if (f.baseWeeklyRate) payload.baseWeeklyRate = parseFloat(f.baseWeeklyRate);
        if (f.baseMonthlyRate) payload.baseMonthlyRate = parseFloat(f.baseMonthlyRate);
        payload.features = f.features.trim() ? f.features.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (f.cancellationPolicy.trim()) payload.cancellationPolicy = f.cancellationPolicy.trim();
        if (photoUrls.length) payload.templatePhotos = photoUrls;
        const res = await adminUpdateTemplate(m.id, tplEditId, payload);
        if (res.success) { toast.success(`Template updated (${res.changedFields.length} fields)`); setTplModal(null); loadTemplates(); onRefreshMerchant(); }
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to save template'); }
    finally { setTplSaving(false); }
  }

  async function handleToggleTemplate(id: number, active: boolean) {
    try { await adminUpdateTemplate(m.id, id, { isActive: !active }); toast.success(`Template ${active ? 'deactivated' : 'activated'}`); loadTemplates(); }
    catch (err: any) { toast.error(err?.message || 'Failed'); }
  }

  // ── Unit CRUD ─────────────────────────────────────────────
  function openCreateUnit() {
    if (!unitManagerTpl) return;
    const t = unitManagerTpl;
    const f = emptyUnitForm();
    f.dailyRate = t.baseDailyRate || '';
    if (t.baseWeeklyRate) f.weeklyRate = t.baseWeeklyRate;
    if (t.baseMonthlyRate) f.monthlyRate = t.baseMonthlyRate;
    setUnitForm(f);
    setUnitEditId(null);
    setUnitModal('create');
  }

  function openEditUnit(u: AdminUnit) {
    setUnitForm({
      unitNumber: u.unitNumber, unitName: u.unitName || '',
      plateNumber: u.plateNumber || '', serialNumber: u.serialNumber || '',
      color: u.color || '', year: u.year?.toString() || '',
      condition: (u.condition as 'EXCELLENT' | 'GOOD' | 'FAIR') || 'EXCELLENT',
      dailyRate: u.dailyRate, weeklyRate: u.weeklyRate || '',
      monthlyRate: u.monthlyRate || '',
      depositAmount: u.depositAmount, replacementValue: u.replacementValue,
      deliveryAvailable: u.deliveryAvailable,
      deliveryFee: u.deliveryFee || '',
      photos: (u.photos || []).map(url => ({ preview: url, url })),
    });
    setUnitEditId(u.id);
    setUnitModal('edit');
  }

  async function handleSaveUnit() {
    const f = unitForm;
    if (!f.unitNumber.trim() || !f.dailyRate || !f.depositAmount || !f.replacementValue) return;
    if (!unitManagerTpl) return;
    setUnitSaving(true);
    try {
      let photoUrls: string[] = [];
      if (f.photos.length > 0) {
        setUnitUploading(true);
        try { photoUrls = await uploadPhotos(f.photos, 'units'); }
        catch (e: any) { toast.error(`Photo upload failed: ${e?.message}`); setUnitUploading(false); setUnitSaving(false); return; }
        setUnitUploading(false);
      }

      if (unitModal === 'create') {
        const payload: CreateUnitPayload = {
          unitNumber: f.unitNumber.trim(), condition: f.condition,
          dailyRate: parseFloat(f.dailyRate), depositAmount: parseFloat(f.depositAmount),
          replacementValue: parseFloat(f.replacementValue),
        };
        if (f.unitName.trim()) payload.unitName = f.unitName.trim();
        if (f.plateNumber.trim()) payload.plateNumber = f.plateNumber.trim();
        if (f.serialNumber.trim()) payload.serialNumber = f.serialNumber.trim();
        if (f.color.trim()) payload.color = f.color.trim();
        if (f.year) payload.year = parseInt(f.year);
        if (f.weeklyRate) payload.weeklyRate = parseFloat(f.weeklyRate);
        if (f.monthlyRate) payload.monthlyRate = parseFloat(f.monthlyRate);
        if (m.businessAddress) payload.pickupAddress = m.businessAddress;
        if (f.deliveryAvailable) { payload.deliveryAvailable = true; if (f.deliveryFee) payload.deliveryFee = parseFloat(f.deliveryFee); }
        if (photoUrls.length) payload.photos = photoUrls;
        const res = await adminCreateUnit(m.id, unitManagerTpl.id, payload);
        if (res.success) { toast.success(`Unit "${f.unitNumber}" created`); setUnitModal(null); loadUnits(unitManagerTpl); loadTemplates(); onRefreshMerchant(); }
      } else if (unitModal === 'edit' && unitEditId) {
        const payload: UpdateUnitPayload = {
          unitNumber: f.unitNumber.trim(), condition: f.condition,
          dailyRate: parseFloat(f.dailyRate), depositAmount: parseFloat(f.depositAmount),
          replacementValue: parseFloat(f.replacementValue),
        };
        if (f.unitName.trim()) payload.unitName = f.unitName.trim();
        if (f.plateNumber.trim()) payload.plateNumber = f.plateNumber.trim();
        if (f.serialNumber.trim()) payload.serialNumber = f.serialNumber.trim();
        if (f.color.trim()) payload.color = f.color.trim();
        if (f.year) payload.year = parseInt(f.year);
        if (f.weeklyRate) payload.weeklyRate = parseFloat(f.weeklyRate);
        if (f.monthlyRate) payload.monthlyRate = parseFloat(f.monthlyRate);
        if (f.deliveryAvailable) { payload.deliveryAvailable = true; if (f.deliveryFee) payload.deliveryFee = parseFloat(f.deliveryFee); }
        else payload.deliveryAvailable = false;
        if (photoUrls.length) payload.photos = photoUrls;
        const res = await adminUpdateUnit(m.id, unitEditId, payload);
        if (res.success) { toast.success(`Unit updated (${res.changedFields.length} fields)`); setUnitModal(null); loadUnits(unitManagerTpl); }
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to save unit'); }
    finally { setUnitSaving(false); }
  }

  async function handleToggleUnit(uid: number, available: boolean) {
    try {
      await adminUpdateUnit(m.id, uid, { isAvailable: !available });
      toast.success(`Unit ${available ? 'marked unavailable' : 'marked available'}`);
      if (unitManagerTpl) loadUnits(unitManagerTpl);
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  }

  // ── Delete handler ────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === 'template') {
        await adminDeleteTemplate(m.id, deleteConfirm.id);
        toast.success(`Template "${deleteConfirm.name}" deleted`);
        loadTemplates(); onRefreshMerchant();
      } else {
        await adminDeleteUnit(m.id, deleteConfirm.id);
        toast.success(`Unit "${deleteConfirm.name}" deleted`);
        if (unitManagerTpl) loadUnits(unitManagerTpl);
        loadTemplates(); onRefreshMerchant();
      }
      setDeleteConfirm(null);
    } catch (err: any) { toast.error(err?.message || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  // ── Photo helpers ─────────────────────────────────────────
  function handlePhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    current: { file?: File; preview: string; url?: string }[],
    setter: (v: { file?: File; preview: string; url?: string }[]) => void,
  ) {
    const files = Array.from(e.target.files || []);
    const remaining = 10 - current.length;
    setter([...current, ...files.slice(0, remaining).map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    e.target.value = '';
  }

  function removePhoto(
    idx: number,
    current: { file?: File; preview: string; url?: string }[],
    setter: (v: { file?: File; preview: string; url?: string }[]) => void,
  ) {
    const p = current[idx];
    if (p.file) URL.revokeObjectURL(p.preview);
    setter(current.filter((_, i) => i !== idx));
  }

  // ── Form updaters ─────────────────────────────────────────
  const tplSet = (key: keyof TemplateFormData, value: TemplateFormData[keyof TemplateFormData]) => setTplForm(prev => ({ ...prev, [key]: value }));
  const unitSet = (key: keyof UnitFormData, value: UnitFormData[keyof UnitFormData]) => setUnitForm(prev => ({ ...prev, [key]: value }));

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // ── Unit Manager view (when a template is selected) ───────
  if (unitManagerTpl) {
    const tpl = unitManagerTpl;
    return (
      <>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setUnitManagerTpl(null)}
                className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
                <ArrowLeft size={16} className="text-[var(--muted-foreground)]" />
              </button>
              <div>
                <h3 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{tpl.name}</h3>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                  {(tpl as any).categoryName || 'Uncategorized'} · Base rate: {peso(tpl.baseDailyRate)}/day
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 mr-4">
                <div className="text-center">
                  <p className="text-[18px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 700 }}>{unitsTplMeta.total}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">Total</p>
                </div>
                <div className="w-px h-8 bg-[var(--border)]" />
                <div className="text-center">
                  <p className="text-[18px] text-emerald-600 dark:text-emerald-400 tabular-nums" style={{ fontWeight: 700 }}>{unitsTplMeta.available}</p>
                  <p className="text-[10px] text-[var(--muted-foreground)]">Available</p>
                </div>
              </div>
              {canEdit && m.verificationStatus === 'APPROVED' && (
                <button onClick={openCreateUnit}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm" style={{ fontWeight: 500 }}>
                  <Plus size={14} /> Add Unit
                </button>
              )}
            </div>
          </div>

          {/* Units grid */}
          {unitsLoading ? (
            <div className="flex items-center justify-center py-16 text-[var(--muted-foreground)]">
              <Loader2 size={20} className="animate-spin mr-2" /><span className="text-[13px]">Loading units…</span>
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-[var(--border)] rounded-2xl">
              <Wrench size={32} className="mx-auto text-[var(--muted-foreground)]/30 mb-3" />
              <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No units yet</p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
                Add physical inventory items for this template. Each unit represents a specific vehicle or equipment.
              </p>
              {canEdit && (
                <button onClick={openCreateUnit}
                  className="mt-4 px-4 py-2 text-[13px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors" style={{ fontWeight: 500 }}>
                  <Plus size={14} className="inline mr-1" /> Add First Unit
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {units.map(u => (
                <div key={u.id} className="group bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-all">
                  <div className="flex">
                    {/* Photo */}
                    <div className="w-[100px] h-[100px] shrink-0 bg-[var(--accent)] flex items-center justify-center overflow-hidden">
                      {u.mainPhotoUrl || (u.photos && u.photos[0]) ? (
                        <img src={u.mainPhotoUrl || u.photos![0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={24} className="text-[var(--muted-foreground)]/30" />
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>#{u.unitNumber}</p>
                            {u.unitName && <span className="text-[11px] text-[var(--muted-foreground)]">{u.unitName}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isAvailable ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'}`} style={{ fontWeight: 600 }}>
                              {u.isAvailable ? 'AVAILABLE' : u.availabilityStatus}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${conditionColors[u.condition] || conditionColors.FAIR}`} style={{ fontWeight: 500 }}>
                              {u.condition}
                            </span>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditUnit(u)} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors" title="Edit">
                              <Pencil size={13} className="text-[var(--muted-foreground)]" />
                            </button>
                            <button onClick={() => handleToggleUnit(u.id, u.isAvailable)} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors" title={u.isAvailable ? 'Mark unavailable' : 'Mark available'}>
                              {u.isAvailable ? <ToggleRight size={15} className="text-emerald-500" /> : <ToggleLeft size={15} className="text-gray-400" />}
                            </button>
                            <button onClick={() => setDeleteConfirm({ type: 'unit', id: u.id, name: u.unitNumber })} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Delete">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--muted-foreground)] flex-wrap">
                        <span className="font-mono" style={{ fontWeight: 500 }}>{peso(u.dailyRate)}/day</span>
                        <span>Deposit: {peso(u.depositAmount)}</span>
                        {u.color && <span className="flex items-center gap-0.5"><Palette size={10} />{u.color}</span>}
                        {u.plateNumber && <span className="flex items-center gap-0.5"><Hash size={10} />{u.plateNumber}</span>}
                        {u.year && <span className="flex items-center gap-0.5"><Calendar size={10} />{u.year}</span>}
                        {u.deliveryAvailable && <span className="flex items-center gap-0.5 text-blue-600"><Truck size={10} />Delivery</span>}
                      </div>
                      {(u.totalBookings > 0 || parseFloat(u.totalRevenue) > 0) && (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--muted-foreground)]">
                          <span>{u.totalBookings} bookings</span>
                          <span>{peso(u.totalRevenue)} revenue</span>
                          <span>{u.totalRentalDays} rental days</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderUnitModal()}
        {renderDeleteConfirm()}
      </>
    );
  }

  // ── Main template list view ───────────────────────────────
  return (
    <>
      <div className="space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 bg-[var(--accent)]/50 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-[var(--primary)]" />
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Templates</p>
            </div>
            <p className="text-[22px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 700 }}>{templates.length}</p>
          </div>
          <div className="p-4 bg-[var(--accent)]/50 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <Wrench size={14} className="text-blue-500" />
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Total Items</p>
            </div>
            <p className="text-[22px] text-[var(--foreground)] tabular-nums" style={{ fontWeight: 700 }}>{m.totalItems}</p>
          </div>
          <div className="p-4 bg-[var(--accent)]/50 rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <Check size={14} className="text-emerald-500" />
              <p className="text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Active Items</p>
            </div>
            <p className="text-[22px] text-emerald-600 dark:text-emerald-400 tabular-nums" style={{ fontWeight: 700 }}>{m.activeItems}</p>
          </div>
        </div>

        {/* Templates header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Rental Templates</h3>
          {canEdit && m.verificationStatus === 'APPROVED' && (
            <button onClick={openCreateTemplate}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm" style={{ fontWeight: 500 }}>
              <Plus size={14} /> New Template
            </button>
          )}
        </div>

        {/* Template cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
            <Loader2 size={18} className="animate-spin mr-2" /><span className="text-[13px]">Loading templates…</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[var(--border)] rounded-2xl">
            <Package size={36} className="mx-auto text-[var(--muted-foreground)]/30 mb-3" />
            <p className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No rental templates</p>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
              {canEdit && m.verificationStatus === 'APPROVED'
                ? 'Create your first template to start listing rental items.'
                : 'This merchant has not created any rental listings yet.'}
            </p>
            {canEdit && m.verificationStatus === 'APPROVED' && (
              <button onClick={openCreateTemplate}
                className="mt-4 px-4 py-2.5 text-[13px] bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors" style={{ fontWeight: 500 }}>
                <Plus size={14} className="inline mr-1" /> Create First Template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {[...categoryMap.entries()].map(([catName, tpls]) => (
              <div key={catName} className="border border-[var(--border)] rounded-xl overflow-hidden">
                {/* Category header */}
                <button onClick={() => toggleCat(catName)}
                  className="w-full px-4 py-3 bg-[var(--accent)]/50 flex items-center justify-between hover:bg-[var(--accent)]/80 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    {expandedCats.has(catName) ? <ChevronDown size={14} className="text-[var(--muted-foreground)]" /> : <ChevronRight size={14} className="text-[var(--muted-foreground)]" />}
                    <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{catName}</p>
                  </div>
                  <span className="text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{tpls.length} template{tpls.length !== 1 ? 's' : ''}</span>
                </button>

                {(expandedCats.has(catName) || categoryMap.size === 1) && (
                  <div className="divide-y divide-[var(--border)]">
                    {tpls.map(t => (
                      <div key={t.id} className="group hover:bg-[var(--accent)]/20 transition-colors">
                        <div className="flex items-stretch">
                          {/* Photo preview */}
                          <div className="w-[80px] shrink-0 bg-[var(--accent)] flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => openUnitManager(t)}>
                            {t.templatePhotos && t.templatePhotos[0] ? (
                              <img src={t.templatePhotos[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={20} className="text-[var(--muted-foreground)]/30" />
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 p-3 min-w-0 cursor-pointer" onClick={() => openUnitManager(t)}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] text-[var(--foreground)] truncate" style={{ fontWeight: 600 }}>{t.name}</p>
                                  {!t.isActive && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" style={{ fontWeight: 600 }}>INACTIVE</span>
                                  )}
                                </div>
                                {t.description && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">{t.description}</p>}
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => openEditTemplate(t)} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors" title="Edit template">
                                    <Pencil size={13} className="text-[var(--muted-foreground)]" />
                                  </button>
                                  <button onClick={() => handleToggleTemplate(t.id, t.isActive)} className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors" title={t.isActive ? 'Deactivate' : 'Activate'}>
                                    {t.isActive ? <ToggleRight size={15} className="text-emerald-500" /> : <ToggleLeft size={15} className="text-gray-400" />}
                                  </button>
                                  <button onClick={() => setDeleteConfirm({ type: 'template', id: t.id, name: t.name })} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Delete template">
                                    <Trash2 size={13} className="text-red-400" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--muted-foreground)] flex-wrap">
                              <span className="font-mono text-[var(--foreground)]" style={{ fontWeight: 500 }}>{peso(t.baseDailyRate)}/day</span>
                              {t.baseWeeklyRate && <span className="font-mono">{peso(t.baseWeeklyRate)}/wk</span>}
                              {t.baseMonthlyRate && <span className="font-mono">{peso(t.baseMonthlyRate)}/mo</span>}
                              {t.features && t.features.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)] rounded-full">{t.features.length} features</span>
                              )}
                              {t.templatePhotos && t.templatePhotos.length > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px]"><ImageIcon size={10} />{t.templatePhotos.length}</span>
                              )}
                            </div>
                          </div>
                          {/* Manage button */}
                          <div className="flex items-center px-3 shrink-0">
                            <button onClick={() => openUnitManager(t)}
                              className="px-3 py-1.5 text-[11px] border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[var(--foreground)] flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                              <Wrench size={12} /> Units
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {renderTemplateModal()}
      {renderDeleteConfirm()}
    </>
  );

  // ═══════════════════════════════════════════════════════════
  // Template Modal (fullscreen)
  // ═══════════════════════════════════════════════════════════
  function renderTemplateModal() {
    if (!tplModal) return null;
    const f = tplForm;
    const isEdit = tplModal === 'edit';
    const canSubmit = f.name.trim() && f.categoryId && f.description.trim().length >= 10 && f.baseDailyRate;

    const missing: string[] = [];
    if (!f.name.trim()) missing.push('Name');
    if (!f.categoryId) missing.push('Category');
    if (f.description.trim().length < 10) missing.push(`Description (${f.description.trim().length}/10)`);
    if (!f.baseDailyRate) missing.push('Daily Rate');

    return (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setTplModal(null)} />
        <div className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-[12%] bg-[var(--card)] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <Package size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{isEdit ? 'Edit Template' : 'Create Rental Template'}</h3>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{m.businessName}</p>
              </div>
            </div>
            <button onClick={() => setTplModal(null)} className="p-2 rounded-xl hover:bg-[var(--accent)] transition-colors"><X size={18} className="text-[var(--muted-foreground)]" /></button>
          </div>

          {/* Body — 2 column layout */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Left */}
              <div className="space-y-5">
                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Basic Information</h4>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Template Name <span className="text-red-400">*</span></label>
                    <input type="text" value={f.name} onChange={e => tplSet('name', e.target.value)} placeholder="e.g. Honda Click 125 — Daily Rental" className={inp} />
                  </div>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Category <span className="text-red-400">*</span></label>
                    <select value={f.categoryId} onChange={e => tplSet('categoryId', e.target.value ? Number(e.target.value) : '')} className={inp}>
                      <option value="">Select a category…</option>
                      {categories.filter(c => !c.parentCategoryId).map(parent => {
                        const children = categories.filter(c => c.parentCategoryId === parent.id);
                        if (children.length === 0) return <option key={parent.id} value={parent.id}>{parent.name}</option>;
                        return (
                          <optgroup key={parent.id} label={parent.name}>
                            {children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Description <span className="text-red-400">*</span> <span className="text-[10px]">(min 10 chars)</span></label>
                    <textarea value={f.description} onChange={e => tplSet('description', e.target.value)} placeholder="Describe the rental item…" rows={4} className={`${inp} resize-none`} />
                  </div>
                </div>

                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}><DollarSign size={14} /> Pricing (PHP)</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Daily <span className="text-red-400">*</span></label>
                      <input type="number" value={f.baseDailyRate} onChange={e => tplSet('baseDailyRate', e.target.value)} placeholder="500" min="1" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Weekly</label>
                      <input type="number" value={f.baseWeeklyRate} onChange={e => tplSet('baseWeeklyRate', e.target.value)} placeholder="3000" min="1" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Monthly</label>
                      <input type="number" value={f.baseMonthlyRate} onChange={e => tplSet('baseMonthlyRate', e.target.value)} placeholder="10000" min="1" className={inp} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="space-y-5">
                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Details</h4>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Features <span className="text-[10px] text-[var(--muted-foreground)]">(comma-separated)</span></label>
                    <input type="text" value={f.features} onChange={e => tplSet('features', e.target.value)} placeholder="e.g. Automatic, Helmet included, USB charger" className={inp} />
                    {f.features.trim() && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {f.features.split(',').map(s => s.trim()).filter(Boolean).map((feat, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-full">{feat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Cancellation Policy</label>
                    <textarea value={f.cancellationPolicy} onChange={e => tplSet('cancellationPolicy', e.target.value)} placeholder="e.g. Free cancellation up to 24h before" rows={2} className={`${inp} resize-none`} />
                  </div>
                </div>

                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-3">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <ImageIcon size={14} /> Photos <span className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 400 }}>({f.photos.length}/10)</span>
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {f.photos.map((p, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
                        <img src={p.preview} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i, f.photos, v => tplSet('photos', v))}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <X size={16} className="text-white" />
                        </button>
                        {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-white text-[8px] text-center py-0.5" style={{ fontWeight: 600 }}>Main Photo</span>}
                      </div>
                    ))}
                    {f.photos.length < 10 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--ring)] flex flex-col items-center justify-center cursor-pointer transition-colors">
                        <Upload size={18} className="text-[var(--muted-foreground)]/50" />
                        <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Add</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                          onChange={e => handlePhotoSelect(e, f.photos, v => tplSet('photos', v))} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          {missing.length > 0 && (
            <div className="px-6 py-2.5 text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
              <AlertCircle size={14} /> Required: {missing.join(' · ')}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)] shrink-0">
            <button onClick={() => setTplModal(null)} className="px-5 py-2.5 text-[13px] rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={handleSaveTemplate} disabled={tplSaving || !canSubmit}
              className="px-6 py-2.5 text-[13px] rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm" style={{ fontWeight: 500 }}>
              {(tplSaving || tplUploading) && <Loader2 size={14} className="animate-spin" />}
              {tplUploading ? 'Uploading photos…' : tplSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Unit Modal (fullscreen)
  // ═══════════════════════════════════════════════════════════
  function renderUnitModal() {
    if (!unitModal) return null;
    const f = unitForm;
    const isEdit = unitModal === 'edit';
    const canSubmit = f.unitNumber.trim() && f.dailyRate && f.depositAmount && f.replacementValue;

    const missing: string[] = [];
    if (!f.unitNumber.trim()) missing.push('Unit Number');
    if (!f.dailyRate) missing.push('Daily Rate');
    if (!f.depositAmount) missing.push('Deposit');
    if (!f.replacementValue) missing.push('Replacement Value');

    return (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => setUnitModal(null)} />
        <div className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-[12%] bg-[var(--card)] rounded-2xl shadow-2xl z-[60] overflow-hidden flex flex-col" role="dialog" aria-modal="true">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Wrench size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>{isEdit ? 'Edit Unit' : 'Add Rental Unit'}</h3>
                <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{unitManagerTpl?.name} · {m.businessName}</p>
              </div>
            </div>
            <button onClick={() => setUnitModal(null)} className="p-2 rounded-xl hover:bg-[var(--accent)] transition-colors"><X size={18} className="text-[var(--muted-foreground)]" /></button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Left */}
              <div className="space-y-5">
                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}><Info size={14} /> Unit Identity</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Unit Number <span className="text-red-400">*</span></label>
                      <input type="text" value={f.unitNumber} onChange={e => unitSet('unitNumber', e.target.value)} placeholder="MC-001" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Unit Name</label>
                      <input type="text" value={f.unitName} onChange={e => unitSet('unitName', e.target.value)} placeholder="Red Honda Click" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Plate Number</label>
                      <input type="text" value={f.plateNumber} onChange={e => unitSet('plateNumber', e.target.value)} placeholder="ABC-1234" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Color</label>
                      <input type="text" value={f.color} onChange={e => unitSet('color', e.target.value)} placeholder="Red" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Year</label>
                      <input type="number" value={f.year} onChange={e => unitSet('year', e.target.value)} placeholder="2024" min="1990" max="2030" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Serial Number</label>
                      <input type="text" value={f.serialNumber} onChange={e => unitSet('serialNumber', e.target.value)} placeholder="VIN / Serial" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Condition <span className="text-red-400">*</span></label>
                      <select value={f.condition} onChange={e => unitSet('condition', e.target.value)} className={inp}>
                        <option value="EXCELLENT">🟢 Excellent</option>
                        <option value="GOOD">🔵 Good</option>
                        <option value="FAIR">🟡 Fair</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}><DollarSign size={14} /> Pricing & Deposits (PHP)</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Daily <span className="text-red-400">*</span></label>
                      <input type="number" value={f.dailyRate} onChange={e => unitSet('dailyRate', e.target.value)} placeholder="500" min="1" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Weekly</label>
                      <input type="number" value={f.weeklyRate} onChange={e => unitSet('weeklyRate', e.target.value)} placeholder="3000" min="1" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Monthly</label>
                      <input type="number" value={f.monthlyRate} onChange={e => unitSet('monthlyRate', e.target.value)} placeholder="10000" min="1" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Security Deposit <span className="text-red-400">*</span></label>
                      <input type="number" value={f.depositAmount} onChange={e => unitSet('depositAmount', e.target.value)} placeholder="2000" min="0" className={inp} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ fontWeight: 500 }}>Replacement Value <span className="text-red-400">*</span></label>
                      <input type="number" value={f.replacementValue} onChange={e => unitSet('replacementValue', e.target.value)} placeholder="80000" min="1" className={inp} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="space-y-5">
                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-4">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}><Truck size={14} /> Pickup & Delivery</h4>
                  <div>
                    <label className={labelCls} style={{ fontWeight: 500 }}>Pickup Location</label>
                    <div className="w-full px-3 py-2.5 text-[13px] bg-[var(--accent)]/50 border border-[var(--border)] rounded-xl text-[var(--foreground)]">
                      📍 {m.businessAddress || 'No address set'}
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-1">Auto-set from merchant's business address</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={f.deliveryAvailable} onChange={e => unitSet('deliveryAvailable', e.target.checked)} className="rounded border-[var(--border)] w-4 h-4" />
                      <span className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>Delivery available</span>
                    </label>
                    {f.deliveryAvailable && (
                      <div className="flex-1">
                        <input type="number" value={f.deliveryFee} onChange={e => unitSet('deliveryFee', e.target.value)} placeholder="Delivery fee (PHP)" min="0" className={inp} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-[var(--accent)]/30 rounded-xl border border-[var(--border)] space-y-3">
                  <h4 className="text-[13px] text-[var(--foreground)] flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <ImageIcon size={14} /> Unit Photos <span className="text-[10px] text-[var(--muted-foreground)]" style={{ fontWeight: 400 }}>({f.photos.length}/10)</span>
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {f.photos.map((p, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-[var(--border)]">
                        <img src={p.preview} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(i, f.photos, v => unitSet('photos', v))}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <X size={16} className="text-white" />
                        </button>
                        {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[8px] text-center py-0.5" style={{ fontWeight: 600 }}>Main Photo</span>}
                      </div>
                    ))}
                    {f.photos.length < 10 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--ring)] flex flex-col items-center justify-center cursor-pointer transition-colors">
                        <Upload size={18} className="text-[var(--muted-foreground)]/50" />
                        <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Add</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                          onChange={e => handlePhotoSelect(e, f.photos, v => unitSet('photos', v))} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          {missing.length > 0 && (
            <div className="px-6 py-2.5 text-[12px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
              <AlertCircle size={14} /> Required: {missing.join(' · ')}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)] shrink-0">
            <button onClick={() => setUnitModal(null)} className="px-5 py-2.5 text-[13px] rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]" style={{ fontWeight: 500 }}>Cancel</button>
            <button onClick={handleSaveUnit} disabled={unitSaving || !canSubmit}
              className="px-6 py-2.5 text-[13px] rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm" style={{ fontWeight: 500 }}>
              {(unitSaving || unitUploading) && <Loader2 size={14} className="animate-spin" />}
              {unitUploading ? 'Uploading photos…' : unitSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Unit'}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Delete Confirm Dialog
  // ═══════════════════════════════════════════════════════════
  function renderDeleteConfirm() {
    if (!deleteConfirm) return null;
    return (
      <>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]" onClick={() => setDeleteConfirm(null)} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[var(--card)] rounded-2xl shadow-2xl z-[70] overflow-hidden" role="dialog" aria-modal="true">
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>Delete {deleteConfirm.type}?</h3>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-2">
              Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-3 px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)]">
            <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 text-[13px] rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] transition-colors text-[var(--foreground)]" style={{ fontWeight: 500 }}>
              Cancel
            </button>
            <button onClick={handleConfirmDelete} disabled={deleting}
              className="flex-1 px-4 py-2.5 text-[13px] rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2" style={{ fontWeight: 500 }}>
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </>
    );
  }
}
