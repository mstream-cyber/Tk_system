import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { CheckIcon } from '../ui/Icons';
import { formatPrice, formatShortDate } from '../../utils/format';

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

interface SaleResult {
  ticket_id: string;
  order_id: string;
  buyer_name: string;
  ticket_type: string;
  event_name: string;
  total_amount: number;
}



interface GateSaleTabProps {
  events: EventAdmin[];
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
  onSaleSuccess?: () => void;
}

export function GateSaleTab({ events, apiFetch, onSaleSuccess }: GateSaleTabProps) {
  const [eventId, setEventId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [error, setError] = useState('');

  const selectedEvent = events.find((ev) => ev.id === eventId);
  const activeTicketTypes = selectedEvent?.ticket_types?.filter((tt) => tt.status === 'active') || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const data = await apiFetch('/api/admin/gate-sales', {
      method: 'POST',
      body: JSON.stringify({
        ticket_type_id: ticketTypeId,
        quantity,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        buyer_phone: buyerPhone.trim(),
      }),
    });

    setLoading(false);

    if (data && (data as Record<string, unknown>).success) {
      setResult((data as { data: SaleResult }).data);
      setBuyerName('');
      setBuyerEmail('');
      setBuyerPhone('');
      setQuantity(1);
      onSaleSuccess?.();
    } else if (data) {
      setError((data as Record<string, unknown>).error as string || 'Sale failed');
    } else {
      setError('Network error');
    }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-success px-5 py-4 text-center">
            <CheckIcon className="text-white mb-1" size={40} />
            <h3 className="text-white font-bold text-lg">Ticket Sold</h3>
          </div>
          <div className="p-5 space-y-2">
            <p className="text-content-secondary text-sm">{result.event_name} — <span className="text-accent-light font-semibold">{result.ticket_type}</span></p>
            <p className="text-content font-semibold">{result.buyer_name}</p>
            <p className="text-content-muted text-xs">Ticket ID: <span className="font-mono text-content-secondary">{result.ticket_id}</span></p>
            <p className="text-content-muted text-xs">Amount: <span className="text-success-light">{formatPrice(result.total_amount)}</span></p>
            <div className="flex gap-2 mt-4">
              <a href={`/ticket/${result.ticket_id}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-lg bg-info text-white text-sm font-semibold text-center hover:bg-info-hover transition-colors">View Ticket</a>
              <Button onClick={() => { setResult(null); setEventId(''); setTicketTypeId(''); }} variant="secondary" className="flex-1">Sell Another</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-content text-lg font-bold mb-4">Gate Sale</h2>
      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select label="Event" value={eventId} onChange={(e) => { setEventId(e.target.value); setTicketTypeId(''); }}
                options={events.map((ev) => ({ value: ev.id, label: `${ev.name} — ${formatShortDate(ev.date)}` }))}
                placeholder="Select event" />
            </div>
            <div>
              <Select label="Ticket Type" value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)}
                options={activeTicketTypes.map((tt) => ({ value: tt.id, label: `${tt.name} — ${formatPrice(tt.price)} (${tt.available_quantity} left)` }))}
                placeholder="Select type" disabled={!eventId} />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-muted mb-1">Qty</label>
              <input type="number" value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                min={1} max={10}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-content outline-none text-sm focus:border-accent" />
            </div>
            <div className="col-span-2">
              <Input label="Buyer Name" type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
            </div>
            <div>
              <Input label="Email" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required />
            </div>
            <div>
              <Input label="Phone" type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} required />
            </div>
          </div>

          {error && <p className="text-danger-light text-sm text-center mt-4">{error}</p>}

          <Button type="submit" disabled={loading || !ticketTypeId} variant="success" loading={loading} className="w-full mt-4" size="lg">
            Sell at Gate
          </Button>
        </Card>
      </form>
    </div>
  );
}
