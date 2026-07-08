import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CheckIcon } from '../ui/Icons';
import { formatShortDate } from '../../utils/format';
import { useToast } from '../../hooks/useToast';

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
  color?: string;
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

interface InviteResult {
  order_id: string;
  ticket_id: string;
  buyer_name: string;
  buyer_email: string;
  event_name: string;
  ticket_type: string;
}

interface InviteOrder {
  id: string;
  ticket_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  email_verified: boolean;
  created_at: string;
  ticket_types: {
    id: string;
    name: string;
    price: number;
    events: {
      id: string;
      name: string;
      date: string;
      venue: string;
      city: string;
    };
  };
}

interface InvitesTabProps {
  events: EventAdmin[];
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
}

export function InvitesTab({ events, apiFetch }: InvitesTabProps) {
  const { addToast } = useToast();
  const [eventId, setEventId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState('');
  const [invites, setInvites] = useState<InviteOrder[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const selectedEvent = events.find((ev) => ev.id === eventId);
  const activeTicketTypes = selectedEvent?.ticket_types?.filter((tt) => tt.status === 'active') || [];

  const fetchInvites = useCallback(async () => {
    setInvitesLoading(true);
    const data = await apiFetch(`/api/admin/invites${eventId ? `?event_id=${eventId}` : ''}`);
    if (data && (data as Record<string, unknown>).success) {
      setInvites((data as { data: InviteOrder[] }).data || []);
    }
    setInvitesLoading(false);
  }, [apiFetch, eventId]);

  useEffect(() => {
    if (eventId) fetchInvites();
  }, [eventId, fetchInvites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inviteName.trim() || !inviteEmail.trim()) {
      setError('Name and email are required');
      return;
    }

    setLoading(true);
    const data = await apiFetch('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({
        ticket_type_id: ticketTypeId,
        buyer_name: inviteName.trim(),
        buyer_email: inviteEmail.trim(),
      }),
    });
    setLoading(false);

    if (data && (data as Record<string, unknown>).success) {
      setResult((data as { data: InviteResult }).data);
      setInviteName('');
      setInviteEmail('');
      fetchInvites();
      addToast('Invite sent', 'success');
    } else if (data) {
      setError((data as Record<string, unknown>).error as string || 'Failed to create invite');
    } else {
      setError('Network error');
    }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="bg-accent px-5 py-4 text-center">
            <CheckIcon className="text-white mb-1" size={40} />
            <h3 className="text-white font-bold text-lg">Invite Sent</h3>
          </div>
          <div className="p-5 space-y-2">
            <p className="text-content-secondary text-sm">{result.event_name} — <span className="text-accent-light font-semibold">{result.ticket_type}</span></p>
            <p className="text-content font-semibold">{result.buyer_name} ({result.buyer_email})</p>
            <p className="text-content-muted text-xs">Ticket ID: <span className="font-mono text-content-secondary">{result.ticket_id}</span></p>
            <div className="flex gap-2 mt-4">
              <a href={`/ticket/${result.ticket_id}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-lg bg-info text-white text-sm font-semibold text-center hover:bg-info-hover transition-colors">View Ticket</a>
              <Button onClick={() => { setResult(null); }} variant="secondary" className="flex-1">Invite Another</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-content text-lg font-bold mb-4">Invite Guests</h2>

      <div className="max-w-lg mx-auto mb-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Select label="Event" value={eventId} onChange={(e) => { setEventId(e.target.value); setTicketTypeId(''); }}
                  options={events.map((ev) => ({ value: ev.id, label: `${ev.name} — ${formatShortDate(ev.date)}` }))}
                  placeholder="Select event" />
              </div>
              <div className="col-span-2">
                <Select label="Ticket Type" value={ticketTypeId} onChange={(e) => setTicketTypeId(e.target.value)}
                  options={activeTicketTypes.map((tt) => ({ value: tt.id, label: `${tt.name} — ${tt.available_quantity} left` }))}
                  placeholder="Select type" disabled={!eventId} />
              </div>
              <div className="col-span-2">
                <Input label="Guest Name" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
              </div>
              <div className="col-span-2">
                <Input label="Guest Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
            </div>

            {error && <p className="text-danger-light text-sm text-center mt-4">{error}</p>}

            <Button type="submit" disabled={loading || !ticketTypeId} loading={loading} className="w-full mt-4" size="lg">
              Send Invite
            </Button>
          </Card>
        </form>
      </div>

      <h3 className="text-content font-semibold text-base mb-3">Sent Invites</h3>
      {invitesLoading ? (
        <p className="text-content-muted text-sm">Loading...</p>
      ) : invites.length === 0 ? (
        <p className="text-content-placeholder text-sm italic">No invites yet</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map((inv) => (
            <div key={inv.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-content text-sm font-medium">{inv.buyer_name}</span>
                  {inv.email_verified && <Badge variant="success" size="sm">Verified</Badge>}
                </div>
                <p className="text-content-muted text-xs">{inv.buyer_email}</p>
                <p className="text-content-placeholder text-xs mt-0.5">
                  {inv.ticket_types?.events?.name} — {inv.ticket_types?.name} · {formatShortDate(inv.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <a href={`/ticket/${inv.ticket_id}`} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-info text-white text-xs font-semibold hover:bg-info-hover transition-colors">View</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
