import {
  DollarSign,
  Navigation,
  Store,
  Car,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import {
  dashboardOverview,
  revenueTrend,
  topMerchants,
  recentActivity,
} from '../lib/mock-data';

export function DashboardPage() {
  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        description="Overview of your platform metrics"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Revenue"
          value={dashboardOverview.totalRevenue}
          delta={dashboardOverview.revenueDelta}
          prefix="PHP "
          icon={<DollarSign size={16} />}
        />
        <StatCard
          label="Active Trips"
          value={dashboardOverview.activeTrips}
          delta={dashboardOverview.tripsDelta}
          icon={<Navigation size={16} />}
        />
        <StatCard
          label="Merchants"
          value={dashboardOverview.totalMerchants}
          delta={dashboardOverview.merchantsDelta}
          icon={<Store size={16} />}
        />
        <StatCard
          label="Drivers"
          value={dashboardOverview.totalDrivers}
          delta={dashboardOverview.driversDelta}
          icon={<Car size={16} />}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Active Users"
          value={dashboardOverview.activeUsers}
          icon={<Users size={16} />}
        />
        <StatCard
          label="Pending Approvals"
          value={dashboardOverview.pendingApprovals}
          icon={<AlertCircle size={16} />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Revenue Trend</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--foreground)" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="var(--foreground)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number) => [`PHP ${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Merchants */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Top Merchants</h3>
          <div className="space-y-3">
            {topMerchants.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-[11px] text-[var(--muted-foreground)] shrink-0"
                  style={{ fontWeight: 600 }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] truncate text-[var(--foreground)]" style={{ fontWeight: 500 }}>{m.name}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {m.trips.toLocaleString()} trips
                  </p>
                </div>
                <span className="text-[13px] tabular-nums text-[var(--foreground)]" style={{ fontWeight: 500 }}>
                  PHP {(m.revenue / 1000).toFixed(0)}K
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Recent Activity</h3>
        <div className="space-y-0">
          {recentActivity.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0"
            >
              <div
                className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[11px] text-[var(--muted-foreground)] shrink-0"
                style={{ fontWeight: 600 }}
                aria-hidden="true"
              >
                {a.user.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--foreground)]">
                  <span style={{ fontWeight: 500 }}>{a.action}</span>
                  <span className="text-[var(--muted-foreground)]"> &middot; {a.target}</span>
                </p>
              </div>
              <span className="text-[12px] text-[var(--muted-foreground)] shrink-0">
                {a.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
