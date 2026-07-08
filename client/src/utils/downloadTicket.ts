import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { formatPrice, formatDate, formatTime } from './format';

export interface DownloadTicketProps {
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
}

export async function downloadTicketPDF(props: DownloadTicketProps) {
  const qrContent = props.scanToken;
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const mg = 15;
  const pageW = 210;

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 297, 'F');

  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, pageW, 55, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(props.eventName, mg, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const timeStr = props.eventTime ? ` · ${props.eventTime}` : ` at ${formatTime(props.eventDate)}`
  doc.text(`${formatDate(props.eventDate)}${timeStr}`, mg, 30);
  doc.text(props.eventVenue, mg, 38);

  const isPayOnGate = props.paymentMethod === 'pay_on_gate';
  const isInvite = props.paymentMethod === 'invite';

  if (isPayOnGate) {
    doc.setFillColor(245, 158, 11);
    doc.rect(0, 47, pageW, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('UNPAID — Pay at Gate', pageW / 2, 55, { align: 'center' });
  }

  const badgeX = pageW - mg - 50;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, 12, 50, 24, 4, 4, 'FD');
  doc.setTextColor(83, 74, 183);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const badgeText = props.ticketType;
  const badgeTw = doc.getTextWidth(badgeText);
  doc.text(badgeText, badgeX + (50 - badgeTw) / 2, 28);

  const details: [string, string][] = [
    ['Buyer Name', props.buyerName],
    ['Ticket ID', props.ticketId],
    ['Quantity', String(props.quantity)],
    ['Total Paid', isPayOnGate ? 'Pay at Gate' : isInvite ? 'Free (Invite)' : formatPrice(props.totalPaid)],
    ['Date', formatDate(props.eventDate)],
    ['Venue', props.eventVenue],
  ];

  for (let i = 0; i < 6; i++) {
    const isRight = i >= 3;
    const cx = isRight ? 110 : mg;
    const cy = 82 + (isRight ? i - 3 : i) * 14;
    const [label, value] = details[i];
    doc.setTextColor(160, 160, 190);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label, cx, cy);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(value, cx, cy + 7);
  }

  const qrData = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  doc.addImage(qrData, 'PNG', mg, 150, 50, 50);
  doc.setTextColor(160, 160, 190);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan at entry gate', mg + 58, 175);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(83, 74, 183);
  const footerText = props.ticketId;
  doc.text(footerText, (pageW - doc.getTextWidth(footerText)) / 2, 277);

  doc.save(`ticket-${props.ticketId}.pdf`);
}
