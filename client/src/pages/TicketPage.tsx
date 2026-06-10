import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchTicket } from '../api';
import TicketCard from '../components/TicketCard';
import { downloadTicketPDF } from '../utils/downloadTicket';
import type { TicketOrder } from '../types';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ticket not found</h2>
          <p className="text-sm text-gray-500 mb-6">No ticket found with this reference number.</p>
          <Link to="/" className="inline-block px-6 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const event = order.ticket_types?.events;
  const eventName = event?.name || '';
  const eventDate = event?.date || '';
  const eventVenue = event ? `${event.venue}, ${event.city}` : '';

  const isApproved = order.payment_status === 'approved';

  if (isApproved) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-[480px] mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Global Tickets</h1>
          </div>
          <TicketCard
            ticketId={order.ticket_id}
            scanToken={order.scan_token}
            buyerName={order.buyer_name}
            eventName={eventName}
            eventDate={eventDate}
            eventVenue={eventVenue}
            ticketType={order.ticket_types?.name || 'Ticket'}
            quantity={order.quantity}
            totalPaid={order.total_amount}
          />
          <button
            onClick={() => downloadTicketPDF({
              ticketId: order.ticket_id,
              scanToken: order.scan_token,
              buyerName: order.buyer_name,
              eventName,
              eventDate,
              eventVenue,
              ticketType: order.ticket_types?.name || 'Ticket',
              quantity: order.quantity,
              totalPaid: order.total_amount,
            })}
            className="mt-4 w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors"
          >
            Download PDF
          </button>
          <Link
            to="/"
            className="block mt-3 w-full py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm text-center hover:bg-gray-50 transition-colors"
          >
            Book Another Ticket
          </Link>
        </div>
      </div>
    );
  }

  // Pending / receipt_uploaded state
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-[480px] mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Waiting for confirmation
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          Your booking <strong>{order.ticket_id}</strong> is still under review.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          You will receive an email at <strong>{order.buyer_email}</strong> once your payment is verified.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
