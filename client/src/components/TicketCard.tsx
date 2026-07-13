import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { formatPrice, formatDate } from '../utils/format';

export interface TicketCardProps {
  ticketId: string;
  scanToken: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  eventVenue: string;
  ticketType: string;
  quantity: number;
  totalPaid: number;
  paymentMethod?: string;
  paid?: boolean;
}

export default function TicketCard(props: TicketCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const isPayOnGate = props.paymentMethod === 'pay_on_gate';
  const isInvite = props.paymentMethod === 'invite';

  useEffect(() => {
    QRCode.toDataURL(props.scanToken, {
      width: 300,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [props.scanToken]);

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg max-w-[400px] mx-auto">
      <div className="bg-accent px-5 pt-4 pb-5 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold leading-tight">{props.eventName}</h3>
            <p className="text-xs opacity-80 mt-1">
              {formatDate(props.eventDate)}{props.eventTime ? ` · ${props.eventTime}` : ''}
            </p>
            <p className="text-xs opacity-80">{props.eventVenue}</p>
          </div>
          <span className="shrink-0 ml-3 text-xs font-bold bg-white text-accent px-3 py-1 rounded-full">
            {props.ticketType}
          </span>
        </div>
      </div>

      {isPayOnGate && (
        <div className="bg-warning px-5 py-2.5">
          <p className="text-white text-xs font-bold text-center uppercase tracking-wider">
            Unpaid — Pay at Gate
          </p>
        </div>
      )}

      <div className="bg-[#1a1a2e]">
        <div className="flex justify-between px-3 py-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40" />
          ))}
        </div>
      </div>

      <div className="bg-[#1a1a2e] px-5 pb-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">Name</p>
            <p className="text-white font-medium">{props.buyerName}</p>
          </div>
          <div>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">Ticket ID</p>
            <p className="text-white font-mono font-bold">{props.ticketId}</p>
          </div>
          <div>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">Qty</p>
            <p className="text-white font-medium">{props.quantity}</p>
          </div>
          <div>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">Paid</p>
            <p className="text-white font-medium">{isPayOnGate ? '—' : isInvite ? 'Free (Invite)' : formatPrice(props.totalPaid)}</p>
          </div>
        </div>

        <div className="my-4 border-t border-dashed border-white/20" />

        <div className="flex items-center gap-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="w-[100px] h-[100px] rounded-lg bg-white p-1.5"
            />
          ) : (
            <div className="w-[100px] h-[100px] rounded-lg bg-white/10 animate-pulse" />
          )}
          <div>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">Scan at</p>
            <p className="text-content-muted text-xs font-semibold uppercase tracking-wide">entry gate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
