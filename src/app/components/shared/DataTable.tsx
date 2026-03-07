import { useState, useMemo, type ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'center' | 'right';
  width?: string;
  hidden?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyMessage?: string;
  rowActions?: (row: T) => ReactNode;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  pageSize = 10,
  emptyTitle = 'No results found',
  emptyMessage = 'Try adjusting your filters or search terms.',
  rowActions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);

  const visibleColumns = columns.filter(c => !c.hidden);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    const ids = paginated.map(keyExtractor);
    const allSelected = ids.every(id => selectedIds?.has(id));
    if (allSelected) {
      const next = new Set(selectedIds);
      ids.forEach(id => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      ids.forEach(id => next.add(id));
      onSelectionChange(next);
    }
  }

  function toggleSelect(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  const allPageSelected = paginated.length > 0 && paginated.every(r => selectedIds?.has(keyExtractor(r)));

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--border)] bg-[var(--accent)]/50">
              {selectable && (
                <th className="px-4 py-3 text-left w-[40px]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="rounded"
                    aria-label="Select all on page"
                  />
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[12px] text-[var(--muted-foreground)] ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--foreground)]' : ''}`}
                  style={{ fontWeight: 500, width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex" aria-hidden="true">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-30" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-3 text-center text-[12px] text-[var(--muted-foreground)] w-[80px]" style={{ fontWeight: 500 }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map(row => {
              const id = keyExtractor(row);
              return (
                <tr
                  key={id}
                  className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)]/30 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(id) || false}
                        onChange={() => toggleSelect(id)}
                        className="rounded"
                        aria-label={`Select row ${id}`}
                      />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              );
            })}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <p className="text-[14px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{emptyTitle}</p>
                  <p className="text-[13px] text-[var(--muted-foreground)] mt-1">{emptyMessage}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} className="text-[var(--muted-foreground)]" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-7 h-7 rounded-md text-[12px] transition-colors ${
                  page === i
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                }`}
                style={{ fontWeight: 500 }}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={14} className="text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}