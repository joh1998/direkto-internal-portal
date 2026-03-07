import { Search, X, Calendar } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode } from 'react';

interface FilterOption {
  label: string;
  value: string;
}

interface ChipFilter {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  filters?: ChipFilter[];
  actions?: ReactNode;
  showDateRange?: boolean;
  onDateRangeChange?: (from: string, to: string) => void;
}

export function FilterBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filters = [],
  actions,
  showDateRange = false,
  onDateRangeChange,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  function handleSearchChange(v: string) {
    setLocalSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(v), 250);
  }

  const activeFilterCount = filters.filter(f => f.value !== 'all' && f.value !== '').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-[400px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)]/40 transition-all text-[var(--foreground)]"
            role="searchbox"
            aria-label={searchPlaceholder}
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); onSearchChange(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X size={12} className="text-[var(--muted-foreground)]" />
            </button>
          )}
        </div>

        {/* Date range */}
        {showDateRange && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[var(--muted-foreground)]" aria-hidden="true" />
            <input
              type="date"
              className="px-2.5 py-1.5 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
              onChange={e => onDateRangeChange?.(e.target.value, '')}
              aria-label="From date"
            />
            <span className="text-[12px] text-[var(--muted-foreground)]">to</span>
            <input
              type="date"
              className="px-2.5 py-1.5 text-[13px] bg-[var(--card)] border border-[var(--border)] rounded-lg outline-none text-[var(--foreground)]"
              onChange={e => onDateRangeChange?.('', e.target.value)}
              aria-label="To date"
            />
          </div>
        )}

        {/* Right actions */}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {/* Status chip filters */}
      {filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map(f => (
            <div key={f.key} className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--muted-foreground)] mr-0.5" style={{ fontWeight: 500 }}>
                {f.label}:
              </span>
              <button
                onClick={() => f.onChange('all')}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                  f.value === 'all'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
                }`}
                style={{ fontWeight: 500 }}
              >
                All
              </button>
              {f.options.map(o => (
                <button
                  key={o.value}
                  onClick={() => f.onChange(f.value === o.value ? 'all' : o.value)}
                  className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                    f.value === o.value
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]/80'
                  }`}
                  style={{ fontWeight: 500 }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
          {activeFilterCount > 0 && (
            <button
              onClick={() => filters.forEach(f => f.onChange('all'))}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 ml-1"
              style={{ fontWeight: 500 }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}