import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { formatPrice, formatShortDate } from '../../utils/format';

interface OrderType {
  id: string;
  ticket_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_city: string | null;
  quantity: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  receipt_url: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  scanned_at: string | null;
  ticket_types: {
    name: string;
    price: number;
    events: {
      name: string;
      date: string;
      venue: string;
      city: string;
    };
  } | null;
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'danger' | 'warning' | 'default'; label: string }> = {
  pending: { variant: 'default', label: 'Pending' },
  receipt_uploaded: { variant: 'warning', label: 'Awaiting review' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
};

interface OrdersTabProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
  onStatsRefresh?: () => void;
}

export function OrdersTab({ apiFetch, onStatsRefresh }: OrdersTabProps) {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [rejectInputs, setRejectInputs] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const limit = 50;
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    variant?: 'danger' | 'primary';
  }>({ open: false, title: '', message: '', action: async () => {} });

  const debouncedSearch = useDebounce(filterSearch, 300);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterType) params.set('type', filterType);
    if (filterMethod) params.set('method', filterMethod);
    params.set('page', String(page));
    params.set('limit', String(limit));

    const data = await apiFetch(`/api/admin/orders?${params}`);
    if (data && (data as Record<string, unknown>).success) {
      const d = data as { data: { orders: OrderType[]; total: number } };
      setOrders(d.data.orders);
      setTotalOrders(d.data.total);
    }
    setLoading(false);
  }, [apiFetch, filterStatus, debouncedSearch, filterType, filterMethod, page]);

  useEffect(() => {
    setPage(1);
  }, [filterSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleApprove = useCallback(async (order: OrderType) => {
    const data = await apiFetch(`/api/admin/orders/${order.id}/approve`, { method: 'POST' });
    if (data && (data as Record<string, unknown>).success) {
      addToast('Ticket approved and emailed', 'success');
      fetchOrders();
      onStatsRefresh?.();
    } else {
      addToast('Failed to approve ticket', 'error');
    }
  }, [apiFetch, fetchOrders, addToast, onStatsRefresh]);

  const handleReject = useCallback(async (orderId: string) => {
    const reason = rejectInputs[orderId];
    if (!reason?.trim()) return;

    const data = await apiFetch(`/api/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (data && (data as Record<string, unknown>).success) {
      setRejectInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      setRejectingId(null);
      addToast('Order rejected', 'info');
      fetchOrders();
      onStatsRefresh?.();
    } else {
      addToast('Failed to reject order', 'error');
    }
  }, [apiFetch, rejectInputs, fetchOrders, addToast, onStatsRefresh]);

  const handleResend = useCallback(async (orderId: string) => {
    const data = await apiFetch(`/api/admin/resend/${orderId}`, { method: 'POST' });
    if (data && (data as Record<string, unknown>).success) {
      addToast('Ticket email resent', 'success');
    } else {
      addToast('Failed to resend email', 'error');
    }
  }, [apiFetch, addToast]);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, []);

  const handleViewReceipt = useCallback(async (orderId: string) => {
    const data = await apiFetch(`/api/admin/orders/${orderId}/receipt`);
    if (data && (data as Record<string, unknown>).success) {
      const d = data as { data: { url: string } };
      window.open(d.data.url, '_blank', 'noopener');
    }
  }, [apiFetch]);

  const ticketTypes = [...new Set(orders.map((o) => o.ticket_types?.name).filter(Boolean))] as string[];

  const showConfirm = (title: string, message: string, action: () => Promise<void>, variant?: 'danger' | 'primary') => {
    setConfirmState({ open: true, title, message, action, variant });
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-content-muted mb-1">Search</label>
          <Input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Name / Email / Ticket ID"
          />
        </div>

        <Select
          label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'receipt_uploaded', label: 'Awaiting review' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
          placeholder="All"
        />

        <Select
          label="Ticket Type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={ticketTypes.map((t) => ({ value: t, label: t }))}
          placeholder="All"
        />

        <Select
          label="Method"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'easypaisa', label: 'EasyPaisa' },
            { value: 'pay_on_gate', label: 'Pay at Gate' },
            { value: 'invite', label: 'Invite' },
          ]}
          placeholder="All"
        />

        <Button onClick={handleExport} variant="primary" size="md">
          Export CSV
        </Button>
      </div>

      {totalOrders > limit && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-content-muted">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, totalOrders)} of {totalOrders}
          </span>
          <div className="flex gap-2">
            <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} variant="secondary" size="sm">Prev</Button>
            {Array.from({ length: Math.ceil(totalOrders / limit) }, (_, i) => i + 1)
              .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === Math.ceil(totalOrders / limit))
              .map((p, i, arr) => (
                <span key={p} className="flex items-center gap-1">
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="text-content-placeholder text-xs">...</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      p === page ? 'bg-accent text-white' : 'bg-card-hover text-content-secondary hover:bg-card-hover'
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <Button onClick={() => setPage(p => Math.min(Math.ceil(totalOrders / limit), p + 1))}
              disabled={page >= Math.ceil(totalOrders / limit)} variant="secondary" size="sm">Next</Button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-content-muted text-xs uppercase">
              <th className="text-left px-4 py-3 font-medium">Ticket ID</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-center px-4 py-3 font-medium">Qty</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Method</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Scanned</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={12} className="text-center py-8"><Spinner size="sm" /></td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-content-muted">No orders found</td></tr>
            )}
            {orders.map((order) => {
              const badge = STATUS_BADGE[order.payment_status] || { variant: 'default' as const, label: order.payment_status };
              return (
              <tr key={order.id} className="border-b border-border hover:bg-card-hover">
                <td className="px-4 py-3 text-content font-mono text-xs">{order.ticket_id}</td>
                <td className="px-4 py-3 text-content">{order.buyer_name}</td>
                <td className="px-4 py-3 text-content-secondary text-xs">{order.buyer_email}</td>
                <td className="px-4 py-3 text-content-secondary text-xs">{order.buyer_phone}</td>
                <td className="px-4 py-3 text-content-secondary">{order.ticket_types?.name || '—'}</td>
                <td className="px-4 py-3 text-center text-content">{order.quantity}</td>
                <td className="px-4 py-3 text-right text-content text-xs">{formatPrice(order.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="capitalize text-content-secondary">{order.payment_method === 'cash' ? 'Cash' : order.payment_method.replace('_', ' ')}</span>
                    {order.payment_method === 'cash' && <Badge variant="info" size="sm">Gate</Badge>}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {order.scanned_at
                    ? <span className="text-success-light font-medium">{formatShortDate(order.scanned_at)}</span>
                    : <span className="text-content-placeholder">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-content-muted text-xs whitespace-nowrap">{formatShortDate(order.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {order.payment_status === 'receipt_uploaded' && (
                    <div className="flex items-center gap-1 justify-end">
                      <Button onClick={() => handleViewReceipt(order.id)} variant="secondary" size="sm">View receipt</Button>
                      <Button onClick={() => showConfirm(
                        'Approve ticket',
                        `Approve and send ticket to ${order.buyer_email}?`,
                        () => handleApprove(order)
                      )} variant="success" size="sm">Approve</Button>
                      <Button onClick={() => setRejectingId(rejectingId === order.id ? null : order.id)} variant="danger" size="sm">Reject</Button>
                    </div>
                  )}
                  {order.payment_status === 'approved' && (
                    <div className="flex items-center gap-1 justify-end">
                      <a href={`/ticket/${order.ticket_id}`} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 rounded text-xs bg-info text-white hover:bg-info-hover transition-colors">View ticket</a>
                      <Button onClick={() => showConfirm(
                        'Resend ticket email',
                        `Resend ticket email to ${order.buyer_email}?`,
                        () => handleResend(order.id)
                      )} variant="primary" size="sm">Resend</Button>
                    </div>
                  )}
                  {order.payment_status === 'rejected' && (
                    <span className="text-xs text-content-placeholder italic cursor-help" title={order.rejected_at || 'N/A'}>Rejected</span>
                  )}
                  {order.payment_status === 'pending' && (
                    <span className="text-xs text-content-placeholder">—</span>
                  )}

                  {rejectingId === order.id && (
                    <div className="mt-2 flex gap-1">
                      <Input type="text" value={rejectInputs[order.id] || ''}
                        onChange={(e) => setRejectInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="Reason for rejection" className="!py-1 !px-2 text-xs" />
                      <Button onClick={() => handleReject(order.id)} disabled={!rejectInputs[order.id]?.trim()} variant="danger" size="sm">Confirm</Button>
                    </div>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant || 'primary'}
        confirmLabel={confirmState.title === 'Approve ticket' ? 'Approve' : confirmState.title === 'Resend ticket email' ? 'Resend' : 'Confirm'}
        onConfirm={async () => {
          await confirmState.action();
          setConfirmState({ open: false, title: '', message: '', action: async () => {} });
        }}
        onCancel={() => setConfirmState({ open: false, title: '', message: '', action: async () => {} })}
      />
    </div>
  );
}
