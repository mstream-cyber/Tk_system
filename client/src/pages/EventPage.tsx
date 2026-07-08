import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchEvents } from '../api';
import { formatPrice, formatDate } from '../utils/format';
import type { EventType } from '../types';
import msLogo from '../assets/mslogo.png';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents().then((res) => {
      if (res.success && res.data) {
        const found = (res.data as EventType[]).find((e) => e.id === id);
        setEvent(found || null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-content-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-content-muted mb-4">Event not found</p>
          <Link to="/" className="text-accent-light hover:text-accent text-sm">Back to events</Link>
        </div>
      </div>
    );
  }

  const activeTicketTypes = event.ticket_types
    .filter((tt) => tt.status === 'active' && tt.available_quantity > 0)
    .sort((a, b) => a.sort_order - b.sort_order);
  const allSoldOut = event.ticket_types.filter((tt) => tt.status === 'active').length > 0
    && activeTicketTypes.length === 0;

  return (
    <div className="min-h-screen bg-surface pb-8">
      <div className="max-w-[480px] mx-auto px-4">
        <div className="relative flex items-center justify-center mb-4 min-h-[40px] pt-6">
          <button onClick={() => navigate(-1)} className="absolute left-0 text-content-muted hover:text-content transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <img src={msLogo} alt="Logo" className="absolute left-8 h-10 w-auto" />
          <h1 className="text-xl font-bold text-content">Event Details</h1>
        </div>

        {event.banner_url && (
          <div className="rounded-xl overflow-hidden mb-4">
            <img src={event.banner_url} alt={event.name} className="w-full h-48 object-cover" />
          </div>
        )}

        <Card className="mb-4">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-2xl font-bold text-content flex-1">{event.name}</h2>
            <Badge variant={event.status === 'published' ? 'success' : event.status === 'cancelled' ? 'danger' : 'warning'} size="sm">
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-content-secondary">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDate(event.date)}{event.time && ` · ${event.time}`}</span>
            </div>

            <div className="flex items-start gap-2 text-content-secondary">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{event.venue}, {event.city}</span>
            </div>
          </div>
        </Card>

        {event.description && (
          <Card className="mb-4">
            <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wider mb-2">About this event</h3>
            <p className="text-content text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
          </Card>
        )}

        <div className="mb-5">
          <h3 className="text-sm font-semibold text-content-muted uppercase tracking-wider mb-3">Available tickets</h3>
          {activeTicketTypes.length === 0 ? (
            <Card className="text-center">
              <p className="text-content-muted text-sm">
                {allSoldOut ? 'All tickets are sold out' : 'No tickets available for this event'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeTicketTypes.map((tt) => (
                <button
                  key={tt.id}
                  onClick={() => navigate(`/?eventId=${event.id}`)}
                  className="bg-card rounded-xl border border-border p-4 text-left hover:border-accent transition-all hover:shadow-lg relative overflow-hidden"
                >
                  {tt.color && (
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: tt.color }} />
                  )}
                  <div className="flex items-center gap-2">
                    {tt.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tt.color }} />}
                    <div className="font-semibold text-content text-sm">{tt.name}</div>
                  </div>
                  <div className="text-accent-light font-bold text-lg mt-1">{formatPrice(tt.price)}</div>
                  <div className="text-content-muted text-xs mt-1">
                    {tt.available_quantity > 10
                      ? `${tt.available_quantity} available`
                      : `Only ${tt.available_quantity} left`
                    }
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTicketTypes.length > 0 && (
          <Button
            onClick={() => navigate(`/?eventId=${event.id}`)}
            className="w-full"
            size="lg"
          >
            Book Now
          </Button>
        )}
      </div>
    </div>
  );
}
