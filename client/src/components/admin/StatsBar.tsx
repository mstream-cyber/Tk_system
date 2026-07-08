import { formatPrice } from '../../utils/format';

interface Stats {
  total_orders: number;
  pending_count: number;
  receipt_uploaded_count: number;
  approved_count: number;
  rejected_count: number;
  total_revenue_approved: number;
  gate_sales_count: number;
  online_sales_count: number;
  pay_on_gate_count: number;
  unpaid_count: number;
  invite_count: number;
  gate_revenue: number;
  online_revenue: number;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border flex-1 min-w-[100px]">
      <p className="text-content-muted text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

interface StatsBarProps {
  stats: Stats;
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <StatCard label="Total bookings" value={stats.total_orders} color="text-content" />
      <StatCard label="Awaiting review" value={stats.receipt_uploaded_count} color="text-warning-light" />
      <StatCard label="Approved" value={stats.approved_count} color="text-success-light" />
      <StatCard label="Rejected" value={stats.rejected_count} color="text-danger-light" />
      <StatCard label="Revenue" value={formatPrice(stats.total_revenue_approved)} color="text-accent-light" />
      <StatCard label="Gate sales" value={stats.gate_sales_count ?? 0} color="text-info-light" />
      <StatCard label="Online sales" value={stats.online_sales_count ?? 0} color="text-info" />
      <StatCard label="Invites" value={stats.invite_count ?? 0} color="text-accent-light" />
    </div>
  );
}
