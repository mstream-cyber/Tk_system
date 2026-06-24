import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from '../components/EventForm';
import TicketTypeForm from '../components/TicketTypeForm';

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

interface Stats {
  total_orders: number;
  pending_count: number;
  receipt_uploaded_count: number;
  approved_count: number;
  rejected_count: number;
  total_revenue_approved: number;
  gate_sales_count: number;
  online_sales_count: number;
  gate_revenue: number;
  online_revenue: number;
}

interface TicketTypeAdmin {
  id: string;
  event_id: string;
  name: string;
  price: number;
  total_quantity: number;
  available_quantity: number;
  description: string | null;
  status: 'active' | 'paused' | 'sold_out';
  sort_order: number;
  created_at: string;
}

interface EventAdmin {
  id: string;
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  description: string | null;
  banner_url: string | null;
  poster_url: string | null;
  status: 'draft' | 'published' | 'cancelled';
  max_tickets_per_order: number;
  created_at: string;
  ticket_types: TicketTypeAdmin[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  receipt_uploaded: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  receipt_uploaded: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatPrice(paise: number) {
  return `PKR ${(paise / 100).toLocaleString('en-PK')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<OrderType[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [rejectInputs, setRejectInputs] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'events' | 'gate_sale'>('orders');
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanPin, setScanPin] = useState('');
  const [scanPinError, setScanPinError] = useState('');
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const limit = 50;
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [events, setEvents] = useState<EventAdmin[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventAdmin | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTicketTypeForm, setShowTicketTypeForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventAdmin | null>(null);
  const [editingTicketType, setEditingTicketType] = useState<TicketTypeAdmin | null>(null);

  const [gateSaleEventId, setGateSaleEventId] = useState('');
  const [gateSaleTicketTypeId, setGateSaleTicketTypeId] = useState('');
  const [gateSaleQuantity, setGateSaleQuantity] = useState(1);
  const [gateSaleBuyerName, setGateSaleBuyerName] = useState('');
  const [gateSaleBuyerEmail, setGateSaleBuyerEmail] = useState('');
  const [gateSaleBuyerPhone, setGateSaleBuyerPhone] = useState('');
  const [gateSaleLoading, setGateSaleLoading] = useState(false);
  const [gateSaleResult, setGateSaleResult] = useState<{ ticket_id: string; order_id: string; buyer_name: string; ticket_type: string; event_name: string; total_amount: number } | null>(null);
  const [gateSaleError, setGateSaleError] = useState('');

  const checkAuth = useCallback(() => {
    return true;
  }, []);

  const apiFetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  }, [navigate]);

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
    if (data?.success && data.data) {
      setOrders(data.data.orders);
      setTotalOrders(data.data.total);
    }
    setLoading(false);
  }, [apiFetch, filterStatus, debouncedSearch, filterType, page]);

  const fetchStats = useCallback(async () => {
    const data = await apiFetch('/api/admin/stats');
    if (data?.success && data.data) setStats(data.data);
  }, [apiFetch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filterSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [filterSearch]);

  useEffect(() => {
    if (!checkAuth()) return;
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterSearch]);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, debouncedSearch, filterType, filterMethod, page]);

  const handleApprove = useCallback(async (order: OrderType) => {
    if (!window.confirm(`Approve and send ticket to ${order.buyer_email}?`)) return;
    const data = await apiFetch(`/api/admin/orders/${order.id}/approve`, { method: 'POST' });
    if (data?.success) {
      fetchOrders();
      const statsData = await apiFetch('/api/admin/stats');
      if (statsData?.success && statsData.data) setStats(statsData.data);
    }
  }, [apiFetch, fetchOrders]);

  const handleReject = useCallback(async (orderId: string) => {
    const reason = rejectInputs[orderId];
    if (!reason?.trim()) return;

    const data = await apiFetch(`/api/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (data?.success) {
      setRejectInputs((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
      setRejectingId(null);
      fetchOrders();
      const statsData = await apiFetch('/api/admin/stats');
      if (statsData?.success && statsData.data) setStats(statsData.data);
    }
  }, [apiFetch, rejectInputs, fetchOrders]);

  const handleResend = useCallback(async (orderId: string) => {
    const data = await apiFetch(`/api/admin/resend/${orderId}`, { method: 'POST' });
    if (data?.success) {
      alert('Ticket email resent');
    }
  }, [apiFetch]);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/export');
      if (res.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
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
  }, [navigate]);

  const handleViewReceipt = useCallback(async (orderId: string) => {
    const data = await apiFetch(`/api/admin/orders/${orderId}/receipt`);
    if (data?.success && data.data?.url) {
      window.open(data.data.url, '_blank', 'noopener');
    }
  }, [apiFetch]);

  const handleLogout = useCallback(() => {
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const handleScanAccess = useCallback(async () => {
    const entered = scanPin.trim();
    if (!entered) return;
    const data = await apiFetch('/api/admin/verify-scan-pin', {
      method: 'POST',
      body: JSON.stringify({ pin: entered }),
    });
    if (data?.success && data.data?.token) {
      setShowScanModal(false);
      setScanPin('');
      setScanPinError('');
      window.open(`/scan?token=${data.data.token}`, '_blank', 'noopener');
    } else {
      setScanPinError('Invalid PIN');
    }
  }, [scanPin, apiFetch]);

  const fetchAdminEvents = useCallback(async () => {
    setEventsLoading(true);
    const data = await apiFetch('/api/admin/events');
    if (data?.success && data.data) setEvents(data.data);
    setEventsLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    if (activeTab === 'events' || activeTab === 'gate_sale') fetchAdminEvents();
  }, [activeTab]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    const data = await apiFetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
    if (data?.success) {
      fetchAdminEvents();
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
    } else {
      alert(data?.error || 'Failed to delete event');
    }
  }, [apiFetch, fetchAdminEvents, selectedEvent]);

  const handleToggleStatus = useCallback(async (eventId: string, currentStatus: string) => {
    const next = currentStatus === 'published' ? 'draft' : 'published';
    const data = await apiFetch(`/api/admin/events/${eventId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    if (data?.success) fetchAdminEvents();
  }, [apiFetch, fetchAdminEvents]);

  const handleDeleteTicketType = useCallback(async (eventId: string, typeId: string) => {
    if (!window.confirm('Delete this ticket type?')) return;
    const data = await apiFetch(`/api/admin/events/${eventId}/ticket-types/${typeId}`, { method: 'DELETE' });
    if (data?.success) fetchAdminEvents();
    else alert(data?.error || 'Failed to delete ticket type');
  }, [apiFetch, fetchAdminEvents]);

  // ── Available ticket types for filter ──
  const ticketTypes = [...new Set(orders.map((o) => o.ticket_types?.name).filter(Boolean))] as string[];

  const StatCard = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex-1 min-w-[100px]">
      <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Global Tickets — Admin</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setShowScanModal(true); setScanPin(''); setScanPinError(''); }}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Scan tickets
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-xl p-1 border border-gray-700 w-fit">
          {(['orders', 'events', 'gate_sale'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'orders' ? 'Orders' : tab === 'events' ? 'Events' : 'Gate Sale'}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <>
            {/* Stats */}
            {stats && (
              <div className="flex flex-wrap gap-3 mb-6">
                <StatCard label="Total bookings" value={stats.total_orders} color="text-white" />
                <StatCard label="Awaiting review" value={stats.receipt_uploaded_count} color="text-amber-400" />
                <StatCard label="Approved" value={stats.approved_count} color="text-green-400" />
                <StatCard label="Rejected" value={stats.rejected_count} color="text-red-400" />
                <StatCard label="Revenue" value={formatPrice(stats.total_revenue_approved)} color="text-purple-400" />
                <StatCard label="Gate sales" value={stats.gate_sales_count ?? 0} color="text-cyan-400" />
                <StatCard label="Online sales" value={stats.online_sales_count ?? 0} color="text-blue-400" />
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Name / Email / Ticket ID"
                  className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="receipt_uploaded">Awaiting review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Ticket Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                >
                  <option value="">All</option>
                  {ticketTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Method</label>
                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                >
                  <option value="">All</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="easypaisa">EasyPaisa</option>
                </select>
              </div>

              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                Export CSV
              </button>
            </div>

            {/* Pagination */}
            {totalOrders > limit && (
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400">
                  Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, totalOrders)} of {totalOrders}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.ceil(totalOrders / limit) }, (_, i) => i + 1)
                    .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === Math.ceil(totalOrders / limit))
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center gap-1">
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-600 text-xs">...</span>}
                        <button
                          onClick={() => setPage(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            p === page ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(totalOrders / limit), p + 1))}
                    disabled={page >= Math.ceil(totalOrders / limit)}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 text-white text-xs font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Orders table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
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
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-gray-400">
                        No orders found
                      </td>
                    </tr>
                  )}
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="px-4 py-3 text-white font-mono text-xs">{order.ticket_id}</td>
                      <td className="px-4 py-3 text-white">{order.buyer_name}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.buyer_email}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{order.buyer_phone}</td>
                      <td className="px-4 py-3 text-gray-300">{order.ticket_types?.name || '—'}</td>
                      <td className="px-4 py-3 text-center text-white">{order.quantity}</td>
                      <td className="px-4 py-3 text-right text-white text-xs">{formatPrice(order.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="capitalize text-gray-300">{order.payment_method === 'cash' ? 'Cash' : order.payment_method.replace('_', ' ')}</span>
                          {order.payment_method === 'cash' && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-900 text-cyan-300 text-[10px] font-semibold">Gate</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[order.payment_status] || order.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {order.scanned_at ? (
                          <span className="text-green-400 font-medium">
                            {formatDate(order.scanned_at)}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {order.payment_status === 'receipt_uploaded' && (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleViewReceipt(order.id)}
                              className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                            >
                              View receipt
                            </button>
                            <button
                              onClick={() => handleApprove(order)}
                              className="px-2 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingId(rejectingId === order.id ? null : order.id)}
                              className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {order.payment_status === 'approved' && (
                          <div className="flex items-center gap-1 justify-end">
                            <a
                              href={`/ticket/${order.ticket_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              View ticket
                            </a>
                            <button
                              onClick={() => handleResend(order.id)}
                              className="px-2 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                            >
                              Resend
                            </button>
                          </div>
                        )}
                        {order.payment_status === 'rejected' && (
                          <span className="text-xs text-gray-500 italic cursor-help" title={order.rejected_at || 'N/A'}>
                            Rejected
                          </span>
                        )}
                        {order.payment_status === 'pending' && (
                          <span className="text-xs text-gray-500">—</span>
                        )}

                        {/* Inline reject reason input */}
                        {rejectingId === order.id && (
                          <div className="mt-2 flex gap-1">
                            <input
                              type="text"
                              value={rejectInputs[order.id] || ''}
                              onChange={(e) => setRejectInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                              placeholder="Reason for rejection"
                              className="flex-1 px-2 py-1 rounded text-xs border border-gray-600 bg-gray-700 text-white outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={!rejectInputs[order.id]?.trim()}
                              className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'gate_sale' && (
          <>
            <div className="max-w-lg mx-auto">
              <h2 className="text-white text-lg font-bold mb-4">Gate Sale</h2>
              {gateSaleResult ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-green-600 px-5 py-4 text-center">
                    <svg className="w-10 h-10 text-white mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="text-white font-bold text-lg">Ticket Sold</h3>
                  </div>
                  <div className="p-5 space-y-2">
                    <p className="text-gray-300 text-sm">{gateSaleResult.event_name} — <span className="text-purple-400 font-semibold">{gateSaleResult.ticket_type}</span></p>
                    <p className="text-white font-semibold">{gateSaleResult.buyer_name}</p>
                    <p className="text-gray-400 text-xs">Ticket ID: <span className="font-mono text-gray-300">{gateSaleResult.ticket_id}</span></p>
                    <p className="text-gray-400 text-xs">Amount: <span className="text-green-400">{formatPrice(gateSaleResult.total_amount)}</span></p>
                    <div className="flex gap-2 mt-4">
                      <a
                        href={`/ticket/${gateSaleResult.ticket_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold text-center hover:bg-blue-700 transition-colors"
                      >
                        View Ticket
                      </a>
                      <button
                        onClick={() => { setGateSaleResult(null); setGateSaleEventId(''); setGateSaleTicketTypeId(''); }}
                        className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-300 text-sm font-semibold hover:bg-gray-600 transition-colors"
                      >
                        Sell Another
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setGateSaleError('');
                    setGateSaleLoading(true);
                    const data = await apiFetch('/api/admin/gate-sales', {
                      method: 'POST',
                      body: JSON.stringify({
                        ticket_type_id: gateSaleTicketTypeId,
                        quantity: gateSaleQuantity,
                        buyer_name: gateSaleBuyerName.trim(),
                        buyer_email: gateSaleBuyerEmail.trim(),
                        buyer_phone: gateSaleBuyerPhone.trim(),
                      }),
                    });
                    setGateSaleLoading(false);
                    if (data?.success && data.data) {
                      setGateSaleResult(data.data);
                      setGateSaleBuyerName('');
                      setGateSaleBuyerEmail('');
                      setGateSaleBuyerPhone('');
                      setGateSaleQuantity(1);
                      fetchOrders();
                      const statsData = await apiFetch('/api/admin/stats');
                      if (statsData?.success && statsData.data) setStats(statsData.data);
                    } else if (data) {
                      setGateSaleError(data.error || 'Sale failed');
                    } else {
                      setGateSaleError('Network error');
                    }
                  }}
                  className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Event</label>
                      <select
                        value={gateSaleEventId}
                        onChange={(e) => { setGateSaleEventId(e.target.value); setGateSaleTicketTypeId(''); }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                        required
                      >
                        <option value="">Select event</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.name} — {formatDate(ev.date)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Ticket Type</label>
                      <select
                        value={gateSaleTicketTypeId}
                        onChange={(e) => setGateSaleTicketTypeId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                        required
                        disabled={!gateSaleEventId}
                      >
                        <option value="">Select type</option>
                        {events
                          .find((ev) => ev.id === gateSaleEventId)
                          ?.ticket_types?.filter((tt) => tt.status === 'active')
                          .map((tt) => (
                            <option key={tt.id} value={tt.id}>
                              {tt.name} — {formatPrice(tt.price)} ({tt.available_quantity} left)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Qty</label>
                      <input
                        type="number"
                        value={gateSaleQuantity}
                        onChange={(e) => setGateSaleQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        min={1}
                        max={10}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-400 mb-1">Buyer Name</label>
                      <input
                        type="text"
                        value={gateSaleBuyerName}
                        onChange={(e) => setGateSaleBuyerName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={gateSaleBuyerEmail}
                        onChange={(e) => setGateSaleBuyerEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={gateSaleBuyerPhone}
                        onChange={(e) => setGateSaleBuyerPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white outline-none text-sm focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>

                  {gateSaleError && (
                    <p className="text-red-400 text-sm text-center">{gateSaleError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={gateSaleLoading || !gateSaleTicketTypeId}
                    className="w-full py-3 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {gateSaleLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : 'Sell at Gate'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {activeTab === 'events' && (
          <div>
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold">Events</h2>
              <button
                onClick={() => { setEditingEvent(null); setShowEventForm(true); }}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                + New event
              </button>
            </div>

            {eventsLoading && (
              <p className="text-gray-400 text-sm">Loading events...</p>
            )}

            {/* Event cards */}
            <div className="flex flex-col gap-4">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  {/* Event header */}
                  <div className="flex items-start gap-4 p-4 border-b border-gray-700">
                    {event.banner_url && (
                      <img
                        src={event.banner_url}
                        alt={event.name}
                        className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-base truncate">{event.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          event.status === 'published'
                            ? 'bg-green-900 text-green-400'
                            : event.status === 'cancelled'
                            ? 'bg-red-900 text-red-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        {formatDate(event.date)}
                        {event.time && ` · ${event.time}`}
                        {' · '}{event.venue}, {event.city}
                      </p>
                      {event.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-1">{event.description}</p>
                      )}
                    </div>
                    {/* Event actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleStatus(event.id, event.status)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          event.status === 'published'
                            ? 'bg-yellow-700 text-yellow-200 hover:bg-yellow-600'
                            : 'bg-green-700 text-green-200 hover:bg-green-600'
                        }`}
                      >
                        {event.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => { setEditingEvent(event); setShowEventForm(true); }}
                        className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="px-2 py-1 rounded text-xs bg-red-800 text-red-200 hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Ticket types section */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
                        Ticket types
                      </span>
                      <button
                        onClick={() => { setSelectedEvent(event); setEditingTicketType(null); setShowTicketTypeForm(true); }}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                      >
                        + Add ticket type
                      </button>
                    </div>

                    {event.ticket_types.length === 0 && (
                      <p className="text-gray-600 text-xs italic">No ticket types yet</p>
                    )}

                    <div className="flex flex-col gap-2">
                      {event.ticket_types
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((tt) => (
                        <div key={tt.id} className="flex items-center justify-between bg-gray-750 rounded-lg px-3 py-2 border border-gray-700">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">{tt.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                tt.status === 'active'
                                  ? 'bg-green-900 text-green-400'
                                  : tt.status === 'sold_out'
                                  ? 'bg-red-900 text-red-400'
                                  : 'bg-yellow-900 text-yellow-400'
                              }`}>
                                {tt.status}
                              </span>
                            </div>
                            <div className="text-gray-400 text-xs mt-0.5">
                              {formatPrice(tt.price)} · {tt.available_quantity} / {tt.total_quantity} left
                              {tt.description && ` · ${tt.description}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => { setSelectedEvent(event); setEditingTicketType(tt); setShowTicketTypeForm(true); }}
                              className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTicketType(event.id, tt.id)}
                              className="px-2 py-1 rounded text-xs bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <EventForm
          event={editingEvent}
          onClose={() => setShowEventForm(false)}
          onSaved={() => { setShowEventForm(false); fetchAdminEvents(); }}
          apiFetch={apiFetch}
        />
      )}

      {/* Ticket type form modal */}
      {showTicketTypeForm && selectedEvent && (
        <TicketTypeForm
          eventId={selectedEvent.id}
          ticketType={editingTicketType}
          onClose={() => setShowTicketTypeForm(false)}
          onSaved={() => { setShowTicketTypeForm(false); fetchAdminEvents(); }}
          apiFetch={apiFetch}
        />
      )}

      {/* Scan PIN modal */}
      {showScanModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowScanModal(false);
              setScanPin('');
              setScanPinError('');
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 7V5a2 2 0 012-2h2" />
                  <path d="M17 3h2a2 2 0 012 2v2" />
                  <path d="M21 17v2a2 2 0 01-2 2h-2" />
                  <path d="M7 21H5a2 2 0 01-2-2v-2" />
                  <rect x="7" y="7" width="3" height="3" />
                  <rect x="14" y="7" width="3" height="3" />
                  <rect x="7" y="14" width="3" height="3" />
                  <path d="M14 14h.01M17 14h.01M14 17h.01M17 17h.01" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Scanner access</h2>
              <p className="text-sm text-gray-500 mt-1">Enter the staff PIN to open the scanner</p>
            </div>
            <input
              type="password"
              value={scanPin}
              onChange={(e) => { setScanPin(e.target.value); setScanPinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleScanAccess(); }}
              placeholder="Enter PIN"
              maxLength={10}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-300 outline-none text-center text-lg tracking-widest font-bold focus:border-green-500"
            />
            {scanPinError && (
              <p className="text-red-500 text-sm text-center mt-2">{scanPinError}</p>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowScanModal(false); setScanPin(''); setScanPinError(''); }}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScanAccess}
                disabled={!scanPin.trim()}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Open scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
