import { Search, Plus, MapPin, Settings2, CheckSquare, Square, Loader2, Filter } from 'lucide-react';
import { useRef, useCallback, useState, useLayoutEffect } from 'react';
import type { POI } from '../../../lib/poi-api';

/* ── Props ──────────────────────────────────────── */

interface POISidebarProps {
  pois: POI[];
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  search: string;
  onSearchChange: (v: string) => void;
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
  /** Bulk selection state */
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  /** Slot for injecting admin ops or create form below header */
  children?: React.ReactNode;
}

/* ── Constants ──────────────────────────────────── */

const ROW_HEIGHT = 76; // approximate height of a POI row in px
const OVERSCAN = 5;    // extra rows above/below viewport

/* ── Component ──────────────────────────────────── */

export function POISidebar({
  pois, totalCount, hasMore, loadingMore, onLoadMore,
  search, onSearchChange,
  categoryFilter, onCategoryChange, categories,
  statusFilter, onStatusChange,
  selected, onSelect, canEdit, canCreate,
  onCreateClick, onAdminToggle,
  selectedIds, onToggleSelect, bulkMode, onToggleBulkMode,
  children,
}: POISidebarProps) {
  const chips = [{ id: 'all', label: 'All' }, ...categories];

  /* ── Virtual scroll state ─────────────────────── */
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

    // Infinite scroll trigger — load more when near bottom
    if (hasMore && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  /* ── Compute visible window ───────────────────── */
  const totalHeight = pois.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(pois.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN);
  const visiblePois = pois.slice(startIdx, endIdx);
  const offsetY = startIdx * ROW_HEIGHT;

  return (
    <div className="w-[360px] border-r border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] text-[var(--foreground)]" style={{ fontWeight: 600 }}>POI Manager</h2>
          <div className="flex gap-1">
            {canEdit && (
              <button
                onClick={onToggleBulkMode}
                className={`p-1.5 rounded-lg transition-colors ${
                  bulkMode
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'hover:bg-[var(--accent)] text-[var(--muted-foreground)]'
                }`}
                aria-label="Toggle bulk selection"
                title="Bulk select"
              >
                <CheckSquare size={14} />
              </button>
            )}
            {canCreate && (
              <button
                onClick={onCreateClick}
                className="p-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-colors"
                aria-label="Create POI"
              >
                <Plus size={14} />
              </button>
            )}
            <button
              onClick={onAdminToggle}
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
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search POIs..."
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-[var(--input-background)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 text-[var(--foreground)]"
            aria-label="Search POIs"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {chips.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
              }`}
              style={{ fontWeight: 500 }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 mt-2">
          <Filter size={11} className="text-[var(--muted-foreground)] shrink-0" />
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
            { id: 'verified', label: 'Verified' },
            { id: 'unverified', label: 'Unverified' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => onStatusChange(s.id)}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                statusFilter === s.id
                  ? 'bg-[var(--foreground)] text-[var(--background)]'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
              }`}
              style={{ fontWeight: 500 }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Injected children (admin ops, create form) */}
      {children}

      {/* POI List — virtualized */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        <p className="px-4 py-2 text-[11px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>
          {pois.length} of {totalCount} POIs
        </p>
        {pois.length === 0 && !loadingMore && (
          <div className="px-4 py-8 text-center">
            <MapPin size={20} className="mx-auto text-[var(--muted-foreground)] mb-2" aria-hidden="true" />
            <p className="text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>No POIs found</p>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1">Try a different search or category filter.</p>
          </div>
        )}
        {/* Virtual scroll container */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visiblePois.map(poi => (
              <button
                key={poi.id}
                onClick={() => bulkMode ? onToggleSelect(poi.id) : onSelect(poi)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border)] transition-colors ${
                  selectedIds.has(poi.id)
                    ? 'bg-blue-50/70 dark:bg-blue-950/40'
                    : selected?.id === poi.id
                      ? 'bg-blue-50/50 dark:bg-blue-950/30 border-l-2 border-l-[var(--primary)]'
                      : 'hover:bg-[var(--accent)]/50'
                }`}
                style={{ height: ROW_HEIGHT, boxSizing: 'border-box' }}
              >
                <div className="flex items-start gap-3">
                  {/* Bulk checkbox */}
                  {bulkMode && (
                    <div className="mt-0.5 shrink-0">
                      {selectedIds.has(poi.id) ? (
                        <CheckSquare size={16} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={16} className="text-[var(--muted-foreground)]" />
                      )}
                    </div>
                  )}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    poi.isVerified
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  }`}>
                    <MapPin size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] truncate text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                      {poi.name}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {poi.fullAddress || poi.barangay || 'No address'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--muted-foreground)]">
                        {poi.type}
                      </span>
                      {poi.isVerified && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Verified</span>
                      )}
                      {!poi.isActive && (
                        <span className="text-[10px] text-red-500 dark:text-red-400">Inactive</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-[var(--muted-foreground)] mr-2" />
            <span className="text-[12px] text-[var(--muted-foreground)]">Loading more…</span>
          </div>
        )}
        {/* End of list indicator */}
        {!hasMore && pois.length > 0 && pois.length >= totalCount && (
          <p className="text-center text-[11px] text-[var(--muted-foreground)] py-3">
            All {totalCount} POIs loaded
          </p>
        )}
      </div>
    </div>
  );
}
