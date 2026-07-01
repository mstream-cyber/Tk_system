import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTicket } from '../api';
import TicketCard from '../components/TicketCard';
import { downloadTicketPDF } from '../utils/downloadTicket';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import type { TicketOrder } from '../types';
import msLogo from '../assets/mslogo.png';
import { captureEvent } from '../lib/analytics';

export default function TicketPage() {
  const { ticket_id } = useParams<{ ticket_id: string }>();
  const [order, setOrder] = useState<TicketOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!ticket_id) return;
    setLoading(true);
    fetchTicket(ticket_id).then((res) => {
      if (res.success && res.data) {
        setOrder(res.data);
        captureEvent('ticket_viewed', {
          ticket_id: res.data.ticket_id,
          payment_status: res.data.payment_status,
          email_verified: res.data.email_verified,
        })
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [ticket_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-content-muted mb-2">404</h1>
          <h2 className="text-xl font-bold text-content mb-2">Ticket not found</h2>
          <p className="text-sm text-content-muted mb-6">No ticket found with this reference number.</p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (order.email_verified === false) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center max-w-[400px]">
          <div className="w-20 h-20 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-accent-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-content mb-2">Check your email</h2>
          <p className="text-sm text-content-muted mb-6">
            A verification code was sent to your email. Please check your inbox and enter the code to view your ticket.
          </p>
          <Link to="/">
            <Button className="w-full">Go to Booking</Button>
          </Link>
        </div>
      </div>
    );
  }

  const event = order.ticket_types?.events;
  const eventName = event?.name || '';
  const eventDate = event?.date || '';
  const eventTime = event?.time || '';
  const eventVenue = event ? `${event.venue}, ${event.city}` : '';

  const isApproved = order.payment_status === 'approved';

  const LogoHeader = () => (
    <div className="relative flex items-center justify-center mb-6 min-h-[40px]">
      <img src={msLogo} alt="Logo" className="absolute left-0 h-10 w-auto" />
      <h1 className="text-2xl font-bold text-content">Ticket Portal</h1>
    </div>
  );

  if (isApproved) {
    return (
      <div className="min-h-screen bg-surface py-8 px-4">
        <div className="max-w-[480px] mx-auto">
          <LogoHeader />
          <TicketCard
            ticketId={order.ticket_id}
            scanToken={order.scan_token!}
            buyerName={order.buyer_name!}
            eventName={eventName}
            eventDate={eventDate}
            eventTime={eventTime}
            eventVenue={eventVenue}
            ticketType={order.ticket_types?.name || 'Ticket'}
            quantity={order.quantity}
            totalPaid={order.total_amount}
          />
          <Button
            onClick={() => downloadTicketPDF({
              ticketId: order.ticket_id,
              scanToken: order.scan_token!,
              buyerName: order.buyer_name!,
              eventName,
              eventDate,
              eventTime,
              eventVenue,
              ticketType: order.ticket_types?.name || 'Ticket',
              quantity: order.quantity,
              totalPaid: order.total_amount,
            })}
            className="mt-4 w-full"
            size="lg"
          >
            Download PDF
          </Button>
          <Link to="/" className="block mt-3">
            <Button variant="secondary" className="w-full">
              Book Another Ticket
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-8 px-4">
      <div className="max-w-[480px] mx-auto text-center">
        <LogoHeader />
        <div className="w-20 h-20 rounded-full bg-warning flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-content mb-2">
          Waiting for confirmation
        </h2>
        <p className="text-sm text-content-muted mb-2">
          Your booking <strong className="text-content-secondary">{order.ticket_id}</strong> is still under review.
        </p>
        <p className="text-sm text-content-placeholder mb-6">
          You will receive an email at <strong className="text-content-secondary">{order.buyer_email}</strong> once your payment is verified.
        </p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
