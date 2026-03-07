import { Search, Plus, MapPin, Settings2, CheckSquare, Square, Loader2, ChevronDown, X } from 'lucide-react';
import { useRef, useCallback, useState, useLayoutEffect } from 'react';
import type { POI, POIKind } from '../../../lib/poi-api';

/* ── Kind color palette ─────────────────────────── */

const KIND_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  attraction:   { bg: 'bg-sky-50 dark:bg-sky-950',       text: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-500' },
  essential:    { bg: 'bg-red-50 dark:bg-red-950',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  transport:    { bg: 'bg-indigo-50 dark:bg-indigo-950', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
  merchant:     { bg: 'bg-amber-50 dark:bg-amber-950',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500' },
  public_place: { bg: 'bg-green-50 dark:bg-green-950',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500' },
  landmark:     { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
};

function getKindColor(kind: string) {
  return KIND_COLORS[kind] || { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' };
}

const STATUS_ICON: Record<string, string> = {
  open: '●',
  closed: '○',
  temporarily_closed: '◐',
  seasonal: '◑',
};

/* ── Props ──────────────────────────────────────── */

interface POISidebarProps {
  pois: POI[];
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  kindFilter: string;
  onKindChange: (v: string) => void;
  kinds: POIKind[];
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  categories: { id: string; label: string }[];
  statusFilter: string;
  onStatusChange: (v: string) => void;
  selected: POI | null;
  onSelect: (poi: POI) => void;
  canEdit: boolean;
  canCreate: boolean;
  onCreateClick: () => void;
  onAdminToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  children?: React.ReactNode;
}

/* ── Constants ──────────────────────────────────── */

const ROW_HEIGHT = 64;
const OVERSCAN = 5;

/* ── Component ──────────────────────────────────── */

export function POISidebar({
  pois, totalCount, hasMore, loadingMore, onLoadMore,
  search, onSearchChange,
  kindFilter, onKindChange, kinds,
  categoryFilter, onCategoryChange, categories,
  statusFilter, onStatusChange,
  selected, onSelect, canEdit, canCreate,
  onCreateClick, onAdminToggle,
  selectedIds, onToggleSelect, bulkMode, onToggleBulkMode,
  children,
}: POISidebarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (kindFilter ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  /* ── Virtual scroll ───────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewportH(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportH(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    if (hasMore && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const totalHeight = pois.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(pois.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN);
  const visiblePois = pois.slice(startIdx, endIdx);
  const offsetY = startIdx * ROW_HEIGHT;

  const kindLabel = kinds.find(k => k.id === kindFilter)?.label;
  const catLabel = categories.find(c => c.id === categoryFilter)?.label;

  const selectCls = 'w-full px-2.5 py-1.5 text-[12px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)]/30';

  return (
    <div className="w-[360px] border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>POI Manager</h2>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
              {totalCount}
            </span>
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <button
                onClick={onToggleBulkMode}
                className={`p-1.5 rounded-lg transition-colors ${
                  bulkMode
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'hover:bg-[var(--accent)] text-[var(--muted-foreground)]'
                }`}
                title="Bulk select"
              >
                <CheckSquare size={14} />
              </button>
            )}
            <button
              onClick={onAdminToggle}
              className="p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
              title="Admin operations"
            >
              <Settings2 size={14} />
            </button>
            {canCreate && (
              <button
                onClick={onCreateClick}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors text-[12px]"
                style={{ fontWeight: 500 }}
              >
                <Plus size={12} /> Add POI
              </button>
            )}
          </div>
        </div>

        {/* Search + Filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by name or address…"
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative px-2.5 py-2 rounded-lg border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
            title="Filters"
          >
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-[9px] flex items-center justify-center" style={{ fontWeight: 600 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active filter pills */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {kindLabel && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${getKindColor(kindFilter).bg} ${getKindColor(kindFilter).text}`} style={{ fontWeight: 500 }}>
                {kindLabel}
                <button onClick={() => onKindChange('')} className="hover:opacity-70"><X size={9} /></button>
              </span>
            )}
            {categoryFilter !== 'all' && catLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]" style={{ fontWeight: 500 }}>
                {catLabel}
                <button onClick={() => onCategoryChange('all')} className="hover:opacity-70"><X size={9} /></button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)]" style={{ fontWeight: 500 }}>
                {statusFilter}
                <button onClick={() => onStatusChange('all')} className="hover:opacity-70"><X size={9} /></button>
              </span>
            )}
          </div>
        )}

        {/* Collapsible filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2.5">
            <div>
              <label className="text-[10px] text-[var(--muted-foreground)] mb-1 block" style={{ fontWeight: 600 }}>Kind</label>
              <select value={kindFilter} onChange={e => onKindChange(e.target.value)} className={selectCls}>
                <option value="">All Kinds</option>
                {kinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--muted-foreground)] mb-1 block" style={{ fontWeight: 600 }}>Type</label>
              <select value={categoryFilter} onChange={e => onCategoryChange(e.target.value)} className={selectCls}>
                <option value="all">All Types</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--muted-foreground)] mb-1 block" style={{ fontWeight: 600 }}>Status</label>
              <select value={statusFilter} onChange={e => onStatusChange(e.target.value)} className={selectCls}>
                {[
                  { id: 'all', label: 'All Statuses' },
                  { id: 'active', label: 'Active' },
                  { id: 'inactive', label: 'Inactive' },
                  { id: 'verified', label: 'Verified' },
                  { id: 'unverified', label: 'Unverified' },
                ].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { onKindChange(''); onCategoryChange('all'); onStatusChange('all'); }}
                className="text-[11px] text-[var(--primary)] hover:underline"
                style={{ fontWeight: 500 }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Injected children (admin ops, create form) */}
      {children}

      {/* ── POI List (virtualized) ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <p className="px-4 py-2 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider" style={{ fontWeight: 600 }}>
          Showing {pois.length} of {totalCount}
        </p>

        {pois.length === 0 && !loadingMore && (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--accent)] flex items-center justify-center">
              <MapPin size={18} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No POIs found</p>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1">Try adjusting your search or filters.</p>
          </div>
        )}

        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visiblePois.map(poi => {
              const kc = getKindColor(poi.kind || '');
              const isSelected = selected?.id === poi.id;
              const isBulkSelected = selectedIds.has(poi.id);

              return (
                <button
                  key={poi.id}
                  onClick={() => bulkMode ? onToggleSelect(poi.id) : onSelect(poi)}
                  className={`w-full text-left px-4 py-2 border-b border-[var(--border)] transition-all ${
                    isBulkSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/40'
                      : isSelected
                        ? 'bg-[var(--accent)] border-l-2 border-l-[var(--primary)]'
                        : 'hover:bg-[var(--accent)]/40'
                  }`}
                  style={{ height: ROW_HEIGHT, boxSizing: 'border-box' }}
                >
                  <div className="flex items-center gap-2.5">
                    {bulkMode && (
                      <div className="shrink-0">
                        {isBulkSelected
                          ? <CheckSquare size={15} className="text-blue-600 dark:text-blue-400" />
                          : <Square size={15} className="text-[var(--muted-foreground)]" />
                        }
                      </div>
                    )}
                    {/* Kind dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${kc.dot}`} title={poi.kind?.replace('_', ' ')} />
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] truncate text-[var(--foreground)] flex-1" style={{ fontWeight: 500 }}>
                          {poi.displayName || poi.name}
                        </p>
                        {poi.status && poi.status !== 'unknown' && (
                          <span className={`text-[10px] shrink-0 ${
                            poi.status === 'open' ? 'text-emerald-500' : poi.status === 'closed' ? 'text-red-500' : 'text-amber-500'
                          }`} title={poi.status.replace('_', ' ')}>
                            {STATUS_ICON[poi.status] || '●'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 rounded ${kc.bg} ${kc.text}`} style={{ fontWeight: 500 }}>
                          {poi.type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate flex-1">
                          {poi.barangay || poi.city || ''}
                        </span>
                        {poi.isVerified && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>}
                        {!poi.isActive && <span className="text-[9px] text-red-500 shrink-0">off</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)] mr-2" />
            <span className="text-[11px] text-[var(--muted-foreground)]">Loading more…</span>
          </div>
        )}
        {!hasMore && pois.length > 0 && pois.length >= totalCount && (
          <p className="text-center text-[10px] text-[var(--muted-foreground)] py-3">All {totalCount} POIs loaded</p>
        )}
      </div>
    </div>
  );
}
