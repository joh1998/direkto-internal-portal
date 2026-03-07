import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, Pencil, Trash2, Check, X,
  MapPin, Navigation, Car, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { canEdit, canDelete, canCreate } from '../lib/permissions';
import { poiApi, type LookupType } from '../lib/poi-api';

/* ── Table config ───────────────────────────────── */

interface TableConfig {
  slug: string;          // API path segment
  label: string;         // Display name
  singular: string;      // Singular label
  description: string;   // Helper text
  icon: React.ReactNode;
}

const TABLES: TableConfig[] = [
  {
    slug: 'poi-types',
    label: 'POI Types',
    singular: 'POI Type',
    description: 'Categories for Points of Interest (e.g. Restaurant, Landmark, Hotel)',
    icon: <MapPin size={18} />,
  },
  {
    slug: 'dropoff-zone-types',
    label: 'Dropoff Zone Types',
    singular: 'Dropoff Zone Type',
    description: 'Anchor dropoff zone classifications (e.g. Main Gate, Lobby, Side Entrance)',
    icon: <Navigation size={18} />,
  },
  {
    slug: 'road-access-types',
    label: 'Road Access Types',
    singular: 'Road Access Type',
    description: 'Vehicle/road access levels for anchor points (e.g. All Vehicles, Motorbike Only)',
    icon: <Car size={18} />,
  },
];

/* ── Form state ─────────────────────────────────── */

interface FormState {
  id: string;
  label: string;
  iconUrl: string;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: FormState = { id: '', label: '', iconUrl: '', isActive: true, sortOrder: 0 };

/* ── Component ──────────────────────────────────── */

export function LookupTypesPage() {
  const { user } = useAuth();

  /* active table */
  const [activeTable, setActiveTable] = useState<TableConfig>(TABLES[0]);

  /* data */
  const [items, setItems] = useState<LookupType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  /* create / edit */
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* confirm dialog */
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'toggle';
    target: LookupType;
  } | null>(null);

  /* perms */
  const userRole = user?.role as any;
  const canDoCreate = user ? canCreate(userRole, 'poi_map') : false;
  const canDoEdit = user ? canEdit(userRole, 'poi_map') : false;
  const canDoDelete = user ? canDelete(userRole, 'poi_map') : false;

  /* ── Fetch ────────────────────────────────────── */

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await poiApi.listLookupTypes(activeTable.slug);
      setItems(Array.isArray(res) ? res : []);
    } catch {
      toast.error(`Failed to load ${activeTable.label}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTable.slug]);

  useEffect(() => {
    fetchItems();
    // reset UI on table change
    setMode('list');
    setSearch('');
    setEditingId(null);
  }, [fetchItems]);

  /* ── Filtered items ───────────────────────────── */

  const filtered = items.filter(item =>
    item.id.toLowerCase().includes(search.toLowerCase()) ||
    item.label.toLowerCase().includes(search.toLowerCase()),
  );

  /* ── Create ───────────────────────────────────── */

  const handleCreate = async () => {
    if (!form.id.trim() || !form.label.trim()) {
      toast.error('ID and Label are required');
      return;
    }
    try {
      setSaving(true);
      await poiApi.createLookupType(activeTable.slug, {
        id: form.id.trim(),
        label: form.label.trim(),
        iconUrl: form.iconUrl.trim() || undefined,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      });
      toast.success(`${activeTable.singular} created`);
      setMode('list');
      setForm({ ...EMPTY_FORM });
      fetchItems();
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  /* ── Update ───────────────────────────────────── */

  const handleUpdate = async () => {
    if (!editingId || !form.label.trim()) {
      toast.error('Label is required');
      return;
    }
    try {
      setSaving(true);
      await poiApi.updateLookupType(activeTable.slug, editingId, {
        label: form.label.trim(),
        iconUrl: form.iconUrl.trim() || undefined,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      });
      toast.success(`${activeTable.singular} updated`);
      setMode('list');
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      fetchItems();
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  /* ── Toggle active ────────────────────────────── */

  const handleToggleActive = async (item: LookupType) => {
    try {
      await poiApi.updateLookupType(activeTable.slug, item.id, {
        isActive: !item.isActive,
      });
      toast.success(`${item.label} ${item.isActive ? 'deactivated' : 'activated'}`);
      fetchItems();
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || 'Toggle failed');
    }
  };

  /* ── Delete ───────────────────────────────────── */

  const handleDelete = async (item: LookupType) => {
    try {
      await poiApi.deleteLookupType(activeTable.slug, item.id);
      toast.success(`${item.label} deleted`);
      fetchItems();
    } catch (err: any) {
      toast.error(err?.body?.message || err?.message || 'Delete failed — type may be in use by POIs');
    }
  };

  /* ── Start edit ───────────────────────────────── */

  const startEdit = (item: LookupType) => {
    setForm({
      id: item.id,
      label: item.label,
      iconUrl: item.iconUrl || '',
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    });
    setEditingId(item.id);
    setMode('edit');
  };

  /* ── Confirm logic ────────────────────────────── */

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') {
      handleDelete(confirmAction.target);
    } else if (confirmAction.type === 'toggle') {
      handleToggleActive(confirmAction.target);
    }
    setConfirmAction(null);
  };

  /* ── Auto-generate ID from label (create mode) ─ */

  const handleLabelChange = (val: string) => {
    setForm(prev => ({
      ...prev,
      label: val,
      ...(mode === 'create' ? { id: val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') } : {}),
    }));
  };

  /* ── Render ───────────────────────────────────── */

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] tracking-tight text-[var(--foreground)]" style={{ fontWeight: 600 }}>
              Lookup Types
            </h1>
            <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
              Manage POI categories, dropoff zone types, and road access types
            </p>
          </div>
        </div>

        {/* Table tabs */}
        <div className="flex gap-1 mt-4">
          {TABLES.map(t => (
            <button
              key={t.slug}
              onClick={() => setActiveTable(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-colors ${
                activeTable.slug === t.slug
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
              style={{ fontWeight: 500 }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {/* Active table description */}
        <p className="text-[13px] text-[var(--muted-foreground)] mb-4">
          {activeTable.description}
        </p>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder={`Search ${activeTable.label.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          {canDoCreate && mode === 'list' && (
            <button
              onClick={() => {
                setForm({ ...EMPTY_FORM });
                setMode('create');
                setEditingId(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-[13px] hover:opacity-90 transition-opacity"
              style={{ fontWeight: 500 }}
            >
              <Plus size={14} />
              Add {activeTable.singular}
            </button>
          )}
        </div>

        {/* Create / Edit form */}
        {(mode === 'create' || mode === 'edit') && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <h3 className="text-[14px] mb-3" style={{ fontWeight: 600 }}>
              {mode === 'create' ? `New ${activeTable.singular}` : `Edit: ${editingId}`}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Label */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Label *</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => handleLabelChange(e.target.value)}
                  placeholder="e.g. Motorbike Only"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              {/* ID (create only) */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>
                  ID (slug) {mode === 'edit' ? '(read-only)' : '*'}
                </label>
                <input
                  type="text"
                  value={form.id}
                  onChange={e => mode === 'create' && setForm(prev => ({ ...prev, id: e.target.value }))}
                  disabled={mode === 'edit'}
                  placeholder="e.g. motorbike_only"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50 font-mono"
                />
              </div>
              {/* Icon URL */}
              <div>
                <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Icon URL (optional)</label>
                <input
                  type="text"
                  value={form.iconUrl}
                  onChange={e => setForm(prev => ({ ...prev, iconUrl: e.target.value }))}
                  placeholder="https://cdn.example.com/icon.svg"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              {/* Sort Order */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[12px] text-[var(--muted-foreground)] mb-1" style={{ fontWeight: 500 }}>Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    min={0}
                    max={999}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </div>
                <label className="flex items-center gap-2 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-[var(--border)]"
                  />
                  <span className="text-[13px] text-[var(--foreground)]">Active</span>
                </label>
              </div>
            </div>
            {/* Form actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={mode === 'create' ? handleCreate : handleUpdate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                <Check size={14} />
                {saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  setMode('list');
                  setEditingId(null);
                  setForm({ ...EMPTY_FORM });
                }}
                className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-[13px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
                style={{ fontWeight: 500 }}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <p className="text-[14px]">
              {search ? `No ${activeTable.label.toLowerCase()} matching "${search}"` : `No ${activeTable.label.toLowerCase()} yet`}
            </p>
            {!search && canDoCreate && (
              <button
                onClick={() => { setForm({ ...EMPTY_FORM }); setMode('create'); }}
                className="mt-3 text-[13px] text-[var(--primary)] hover:underline"
              >
                + Create your first {activeTable.singular.toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--accent)]">
                  <th className="text-left px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>ID</th>
                  <th className="text-left px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Label</th>
                  <th className="text-left px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Icon</th>
                  <th className="text-center px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Order</th>
                  <th className="text-center px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Status</th>
                  <th className="text-right px-4 py-3 text-[var(--muted-foreground)]" style={{ fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`border-t border-[var(--border)] hover:bg-[var(--accent)]/50 transition-colors ${
                      !item.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--muted-foreground)]">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {item.label}
                    </td>
                    <td className="px-4 py-3">
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <span className="text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--muted-foreground)]">
                      {item.sortOrder}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge
                        status={item.isActive ? 'active' : 'inactive'}
                        label={item.isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canDoEdit && (
                          <>
                            <button
                              onClick={() => setConfirmAction({ type: 'toggle', target: item })}
                              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
                              title={item.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {item.isActive ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} />}
                            </button>
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          </>
                        )}
                        {canDoDelete && (
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', target: item })}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--muted-foreground)] hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Count */}
        {!loading && items.length > 0 && (
          <p className="text-[12px] text-[var(--muted-foreground)] mt-3 text-right">
            {filtered.length} of {items.length} {activeTable.label.toLowerCase()}
            {items.filter(i => i.isActive).length < items.length && (
              <span> · {items.filter(i => i.isActive).length} active</span>
            )}
          </p>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          title={
            confirmAction.type === 'delete'
              ? `Delete "${confirmAction.target.label}"?`
              : `${confirmAction.target.isActive ? 'Deactivate' : 'Activate'} "${confirmAction.target.label}"?`
          }
          message={
            confirmAction.type === 'delete'
              ? `This will permanently remove this ${activeTable.singular.toLowerCase()}. This action cannot be undone. If it's in use by any POIs, the delete will fail.`
              : `This will ${confirmAction.target.isActive ? 'hide' : 'show'} this ${activeTable.singular.toLowerCase()} in dropdown selections across the app.`
          }
          confirmLabel={
            confirmAction.type === 'delete'
              ? 'Delete'
              : confirmAction.target.isActive ? 'Deactivate' : 'Activate'
          }
          variant={confirmAction.type === 'delete' ? 'danger' : 'default'}
          onConfirm={handleConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
