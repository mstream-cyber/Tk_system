import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useApi } from '../hooks/useApi';
import { StatsBar } from '../components/admin/StatsBar';
import { OrdersTab } from '../components/admin/OrdersTab';
import { EventsTab } from '../components/admin/EventsTab';
import { GateSaleTab } from '../components/admin/GateSaleTab';
import { ScanPinModal } from '../components/admin/ScanPinModal';
import { QrScanIcon } from '../components/ui/Icons';

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
  status: string;
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
  status: string;
  max_tickets_per_order: number;
  organizer_phone: string | null;
  location_link: string | null;
  terms_conditions: string | null;
  created_at: string;
  ticket_types: TicketTypeAdmin[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'events' | 'gate_sale'>('orders');
  const [showScanModal, setShowScanModal] = useState(false);
  const [events, setEvents] = useState<EventAdmin[]>([]);

  const fetchStats = useCallback(async () => {
    const data = await apiFetch('/api/admin/stats');
    if (data && (data as Record<string, unknown>).success) {
      setStats((data as { data: Stats }).data);
    }
  }, [apiFetch]);

  const fetchEvents = useCallback(async () => {
    const data = await apiFetch('/api/admin/events');
    if (data && (data as Record<string, unknown>).success) {
      setEvents((data as { data: EventAdmin[] }).data);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'events' || activeTab === 'gate_sale') fetchEvents();
  }, [activeTab, fetchEvents]);

  const handleLogout = useCallback(() => {
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const handleScanSuccess = useCallback((token: string) => {
    setShowScanModal(false);
    try {
      localStorage.setItem('scanner_token', token);
    } catch { /* storage unavailable */ }
    window.open('/scan', '_blank', 'noopener');
  }, []);

  const handleSaleSuccess = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-content">Global Tickets — Admin</h1>
          <div className="flex items-center gap-4">
            <Button onClick={() => setShowScanModal(true)} variant="success" size="sm">
              <QrScanIcon size={16} />
              Scan tickets
            </Button>
            <button onClick={handleLogout} className="text-sm text-content-muted hover:text-content transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 bg-card rounded-xl p-1 border border-border w-fit">
          {(['orders', 'events', 'gate_sale'] as const).map((tab) => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab ? 'bg-accent text-white' : 'text-content-muted hover:text-content'
              }`}>
              {tab === 'orders' ? 'Orders' : tab === 'events' ? 'Events' : 'Gate Sale'}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <>
            {stats && <StatsBar stats={stats} />}
            <OrdersTab apiFetch={apiFetch} onStatsRefresh={fetchStats} />
          </>
        )}

        {activeTab === 'gate_sale' && (
          <GateSaleTab events={events} apiFetch={apiFetch} onSaleSuccess={handleSaleSuccess} />
        )}

        {activeTab === 'events' && (
          <EventsTab apiFetch={apiFetch} />
        )}
      </div>

      {showScanModal && (
        <ScanPinModal
          onClose={() => setShowScanModal(false)}
          onSuccess={handleScanSuccess}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}
