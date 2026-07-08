import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { formatPrice, formatShortDate } from '../../utils/format';
import EventForm from '../EventForm';
import TicketTypeForm from '../TicketTypeForm';

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
  color?: string;
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
  organizer_phone: string | null;
  location_link: string | null;
  terms_conditions: string | null;
  created_at: string;
  ticket_types: TicketTypeAdmin[];
}

interface EventsTabProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<unknown>;
}

export function EventsTab({ apiFetch }: EventsTabProps) {
  const { addToast } = useToast();
  const [events, setEvents] = useState<EventAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventAdmin | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTicketTypeForm, setShowTicketTypeForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventAdmin | null>(null);
  const [editingTicketType, setEditingTicketType] = useState<TicketTypeAdmin | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    variant: 'danger' | 'primary';
  }>({ open: false, title: '', message: '', action: async () => {}, variant: 'primary' });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch('/api/admin/events');
    if (data && (data as Record<string, unknown>).success) {
      setEvents((data as { data: EventAdmin[] }).data);
    }
    setLoading(false);
  }, [apiFetch]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const data = await apiFetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
    if (data && (data as Record<string, unknown>).success) {
      fetchEvents();
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
      addToast('Event deleted', 'success');
    } else {
      addToast((data as Record<string, unknown>)?.error as string || 'Failed to delete event', 'error');
    }
  }, [apiFetch, fetchEvents, selectedEvent, addToast]);

  const handleToggleStatus = useCallback(async (eventId: string, currentStatus: string) => {
    const next = currentStatus === 'published' ? 'draft' : 'published';
    const data = await apiFetch(`/api/admin/events/${eventId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    if (data && (data as Record<string, unknown>).success) {
      fetchEvents();
      addToast(`Event ${next === 'published' ? 'published' : 'unpublished'}`, 'success');
    }
  }, [apiFetch, fetchEvents, addToast]);

  const handleDeleteTicketType = useCallback(async (eventId: string, typeId: string) => {
    const data = await apiFetch(`/api/admin/events/${eventId}/ticket-types/${typeId}`, { method: 'DELETE' });
    if (data && (data as Record<string, unknown>).success) {
      fetchEvents();
      addToast('Ticket type deleted', 'success');
    } else {
      addToast((data as Record<string, unknown>)?.error as string || 'Failed to delete ticket type', 'error');
    }
  }, [apiFetch, fetchEvents, addToast]);

  const showConfirm = (title: string, message: string, action: () => Promise<void>, variant: 'danger' | 'primary' = 'danger') => {
    setConfirmState({ open: true, title, message, action, variant });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-content text-lg font-bold">Events</h2>
        <Button onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>+ New event</Button>
      </div>

      {loading && <p className="text-content-muted text-sm"><Spinner size="sm" /></p>}

      <div className="flex flex-col gap-4">
        {events.map((event) => (
          <div key={event.id} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-start gap-4 p-4 border-b border-border">
              {event.banner_url && (
                <img src={event.banner_url} alt={event.name} className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-content font-semibold text-base truncate">{event.name}</h3>
                  <Badge variant={event.status === 'published' ? 'success' : event.status === 'cancelled' ? 'danger' : 'default'}>
                    {event.status}
                  </Badge>
                </div>
                <p className="text-content-muted text-xs mt-1">
                  {formatShortDate(event.date)}{event.time && ` · ${event.time}`} · {event.venue}, {event.city}
                </p>
                {event.description && (
                  <p className="text-content-placeholder text-xs mt-1 line-clamp-1">{event.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button onClick={() => handleToggleStatus(event.id, event.status)}
                  variant={event.status === 'published' ? 'warning' : 'success'} size="sm">
                  {event.status === 'published' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button onClick={() => { setEditingEvent(event); setShowEventForm(true); }} variant="secondary" size="sm">Edit</Button>
                <Button onClick={() => showConfirm(
                  'Delete event',
                  'Delete this event? This cannot be undone.',
                  () => handleDeleteEvent(event.id)
                )} variant="danger" size="sm">Delete</Button>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-content-muted text-xs font-semibold uppercase tracking-wide">Ticket types</span>
                <Button onClick={() => { setSelectedEvent(event); setEditingTicketType(null); setShowTicketTypeForm(true); }}
                  variant="ghost" size="sm">+ Add ticket type</Button>
              </div>

              {event.ticket_types.length === 0 && (
                <p className="text-content-placeholder text-xs italic">No ticket types yet</p>
              )}

              <div className="flex flex-col gap-2">
                {event.ticket_types.sort((a, b) => a.sort_order - b.sort_order).map((tt) => (
                    <div key={tt.id} className="flex items-center justify-between bg-card-hover rounded-lg px-3 py-2 border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {tt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tt.color }} />}
                        <span className="text-content text-sm font-medium">{tt.name}</span>
                        <Badge variant={tt.status === 'active' ? 'success' : tt.status === 'sold_out' ? 'danger' : 'warning'} size="sm">
                          {tt.status}
                        </Badge>
                      </div>
                      <div className="text-content-muted text-xs mt-0.5">
                        {formatPrice(tt.price)} · {tt.available_quantity} / {tt.total_quantity} left{tt.description && ` · ${tt.description}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button onClick={() => { setSelectedEvent(event); setEditingTicketType(tt); setShowTicketTypeForm(true); }}
                        variant="secondary" size="sm">Edit</Button>
                      <Button onClick={() => showConfirm(
                        'Delete ticket type',
                        'Delete this ticket type?',
                        () => handleDeleteTicketType(event.id, tt.id)
                      )} variant="danger" size="sm">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showEventForm && (
        <EventForm event={editingEvent} onClose={() => setShowEventForm(false)}
          onSaved={() => { setShowEventForm(false); fetchEvents(); }} apiFetch={apiFetch} />
      )}

      {showTicketTypeForm && selectedEvent && (
        <TicketTypeForm eventId={selectedEvent.id} ticketType={editingTicketType}
          onClose={() => setShowTicketTypeForm(false)}
          onSaved={() => { setShowTicketTypeForm(false); fetchEvents(); }} apiFetch={apiFetch} />
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel="Delete"
        onConfirm={async () => {
          await confirmState.action();
          setConfirmState({ open: false, title: '', message: '', action: async () => {}, variant: 'primary' });
        }}
        onCancel={() => setConfirmState({ open: false, title: '', message: '', action: async () => {}, variant: 'primary' })}
      />
    </div>
  );
}
