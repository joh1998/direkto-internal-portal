import { DollarSign, TrendingUp, CreditCard, PiggyBank } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { PageHeader } from '../components/shared/PageHeader';
import { StatCard } from '../components/shared/StatCard';
import { financeSummary, commissionByTier, revenueTrend } from '../lib/mock-data';

const COLORS = ['var(--foreground)', 'var(--muted-foreground)', 'var(--border)'];

export function FinancePage() {
  return (
    <div className="p-6 max-w-[1400px]">
      <PageHeader
        title="Finance & Reports"
        description="Revenue, commissions, and payouts overview"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={financeSummary.totalRevenue} prefix="PHP " icon={<DollarSign size={16} />} />
        <StatCard label="Total Commission" value={financeSummary.totalCommission} prefix="PHP " icon={<TrendingUp size={16} />} />
        <StatCard label="Pending Payouts" value={financeSummary.pendingPayouts} prefix="PHP " icon={<CreditCard size={16} />} />
        <StatCard label="Completed Payouts" value={financeSummary.completedPayouts} prefix="PHP " icon={<PiggyBank size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Revenue Trend</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value: number) => [`PHP ${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13, backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Bar dataKey="revenue" fill="var(--foreground)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commission by Tier */}
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Commission by Tier</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={commissionByTier}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="revenue"
                  nameKey="tier"
                >
                  {commissionByTier.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`PHP ${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 13, backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-3">
            {commissionByTier.map((tier, i) => (
              <div key={tier.tier} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} aria-hidden="true" />
                  <span className="text-[var(--foreground)]">{tier.tier}</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
                  <span>{tier.count} merchants</span>
                  <span>{tier.avgRate}% avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commission Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Commission Summary</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="py-2 text-left text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Tier</th>
              <th className="py-2 text-right text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Merchants</th>
              <th className="py-2 text-right text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Avg Rate</th>
              <th className="py-2 text-right text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {commissionByTier.map(t => (
              <tr key={t.tier} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 text-[13px] text-[var(--foreground)]" style={{ fontWeight: 500 }}>{t.tier}</td>
                <td className="py-3 text-[13px] text-right tabular-nums text-[var(--foreground)]">{t.count}</td>
                <td className="py-3 text-[13px] text-right tabular-nums text-[var(--foreground)]">{t.avgRate}%</td>
                <td className="py-3 text-[13px] text-right tabular-nums text-[var(--foreground)]">PHP {t.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout Summary */}
      <div className="mt-4 bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-[14px] mb-4 text-[var(--foreground)]" style={{ fontWeight: 600 }}>Payout Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--accent)]/50 rounded-lg p-4">
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Pending Payouts</p>
            <p className="text-[20px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>PHP {financeSummary.pendingPayouts.toLocaleString()}</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Awaiting processing</p>
          </div>
          <div className="bg-[var(--accent)]/50 rounded-lg p-4">
            <p className="text-[12px] text-[var(--muted-foreground)]" style={{ fontWeight: 500 }}>Completed Payouts</p>
            <p className="text-[20px] mt-1 text-[var(--foreground)]" style={{ fontWeight: 600 }}>PHP {financeSummary.completedPayouts.toLocaleString()}</p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">Successfully disbursed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
