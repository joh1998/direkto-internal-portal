import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Eye, XCircle } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { FilterBar } from '../components/shared/FilterBar';
import { StatusBadge } from '../components/shared/StatusBadge';
import { DetailDrawer } from '../components/shared/DetailDrawer';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../components/shared/DataTable';
import { bookings, type Booking } from '../lib/mock-data';

export function BookingsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = !search || b.id.toLowerCase().includes(search.toLowerCase()) || b.user.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchType = typeFilter === 'all' || b.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, statusFilter, typeFilter]);

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    pending: bookings.filter(b => b.status === 'pending').length,
  };

  const columns: Column<Booking>[] = [
    {
      key: 'id',
      label: 'Booking',
      sortable: true,
      sortValue: (b) => b.id,
      render: (b) => <span className="text-[13px] font-mono text-[var(--foreground)]" style={{ fontWeight: 500 }}>{b.id}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (b) => (
        <span className={`text-[12px] px-2 py-0.5 rounded-full ${b.type === 'ride' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'}`} style={{ fontWeight: 500 }}>{b.type}</span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      sortable: true,
      sortValue: (b) => b.user,
      render: (b) => <span className="text-[13px] text-[var(--foreground)]">{b.user}</span>,
    },
    {
      key: 'route',
      label: 'Route',
      render: (b) => <p className="text-[12px] text-[var(--muted-foreground)] truncate max-w-[180px]">{b.origin} → {b.destination}</p>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      sortValue: (b) => b.status,
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'fare',
      label: 'Fare',
      align: 'right',
      sortable: true,
      sortValue: (b) => b.fare,
      render: (b) => <span className="text-[13px] tabular-nums text-[var(--foreground)]">{b.fare > 0 ? `PHP ${b.fare}` : '-'}</span>,
    },
    {
      key: 'scheduled',
      label: 'Scheduled',
      align: 'right',
      render: (b) => (
        <span className="text-[12px] text-[var(--muted-foreground)]">
          {new Date(b.scheduledAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Bookings" description={`${stats.total} bookings \u00B7 ${stats.confirmed} confirmed \u00B7 ${stats.pending} pending`} />

      <FilterBar
        searchPlaceholder="Search bookings..."
        searchValue={search}
        onSearchChange={setSearch}
        showDateRange
        filters={[
          {
            key: 'status', label: 'Status',
            options: [{ label: 'Confirmed', value: 'confirmed' }, { label: 'Pending', value: 'pending' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }],
            value: statusFilter, onChange: setStatusFilter,
          },
          {
            key: 'type', label: 'Type',
            options: [{ label: 'Ride', value: 'ride' }, { label: 'Delivery', value: 'delivery' }],
            value: typeFilter, onChange: setTypeFilter,
          },
        ]}
      />

      <div className="mt-4">
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(b) => b.id}
          onRowClick={(b) => setSelected(b)}
          pageSize={8}
          emptyTitle="No bookings found"
          emptyMessage="Try adjusting your search or filter criteria."
          rowActions={(b) => (
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => setSelected(b)} className="p-1.5 rounded-md hover:bg-[var(--accent)]" aria-label={`View ${b.id}`}>
                <Eye size={14} className="text-[var(--muted-foreground)]" />
              </button>
              {(b.status === 'confirmed' || b.status === 'pending') && (
                <button onClick={() => setCancelBooking(b)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950" aria-label={`Cancel ${b.id}`}>
                  <XCircle size={14} className="text-red-500" />
                </button>
              )}
            </div>
          )}
        />
      </div>

      <DetailDrawer open={!!selected} onClose={() => setSelected(null)} title={`Booking ${selected?.id || ''}`} subtitle={selected?.type}>
        {selected && (
          <div className="space-y-6">
            <StatusBadge status={selected.status} size="md" />
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'User', value: selected.user },
                { label: 'Type', value: selected.type },
                { label: 'Origin', value: selected.origin },
                { label: 'Destination', value: selected.destination },
                { label: 'Fare', value: selected.fare > 0 ? `PHP ${selected.fare}` : '-' },
                { label: 'Scheduled', value: new Date(selected.scheduledAt).toLocaleString() },
              ].map(i => (
                <div key={i.label}>
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-0.5" style={{ fontWeight: 500 }}>{i.label}</p>
                  <p className="text-[13px] text-[var(--foreground)]">{i.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={!!cancelBooking}
        onClose={() => setCancelBooking(null)}
        onConfirm={() => { toast.success(`Booking ${cancelBooking?.id} cancelled`); setCancelBooking(null); }}
        title="Cancel Booking"
        objectId={cancelBooking?.id}
        message={`Cancel booking ${cancelBooking?.id} for ${cancelBooking?.user}? This cannot be undone.`}
        confirmLabel="Cancel Booking"
        variant="danger"
      />
    </div>
  );
}