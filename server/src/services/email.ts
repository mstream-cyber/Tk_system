import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

export interface OrderTicketType {
  name?: string;
  price?: number;
  events?: OrderEvent;
}

export interface OrderEvent {
  name?: string;
  date?: string;
  venue?: string;
  city?: string;
  organizer_phone?: string;
  location_link?: string;
  terms_conditions?: string;
}

export interface Order {
  id: string;
  ticket_id: string;
  scan_token?: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  total_amount: number;
  ticket_types?: OrderTicketType;
  payment_method?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user, pass },
    });
  }
  return transporter;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function generateQRCode(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });
}

function formatDate(isoString?: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}

function formatPkr(amount: number): string {
  return `PKR ${(amount / 100).toLocaleString('en-PK')}`;
}

export async function generateTicketPDF(order: Order, qrBase64: string): Promise<Buffer> {
  const event = order.ticket_types?.events;
  const eventName = event?.name || 'Event';
  const ticketType = order.ticket_types?.name || 'Ticket';
  const dateStr = event?.date ? formatDate(event.date) : '—';
  const timeStr = event?.date ? formatTime(event.date) : '';
  const venue = event?.venue || '—';
  const city = event?.city || '';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const mg = 15;

  doc.setFont('helvetica');

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, pageH, 'F');

  doc.setFillColor(83, 74, 183);
  doc.rect(0, 0, pageW, 55, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName, mg, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  if (timeStr) doc.text(`${dateStr} at ${timeStr}`, mg, 30);
  else doc.text(dateStr, mg, 30);
  doc.text(`${venue}${city ? `, ${city}` : ''}`, mg, 38);

  const badgeW = 50;
  const badgeX = pageW - mg - badgeW;
  const badgeY = 12;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1);
  doc.roundedRect(badgeX, badgeY, badgeW, 24, 4, 4, 'FD');
  doc.setTextColor(83, 74, 183);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const badgeTextWidth = doc.getTextWidth(ticketType);
  doc.text(ticketType, badgeX + (badgeW - badgeTextWidth) / 2, badgeY + 16);

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  let x = mg;
  while (x < pageW - mg) { const segEnd = Math.min(x + 4, pageW - mg); doc.line(x, 68, segEnd, 68); x += 8; }

  const gridY = 82;
  const rowH = 14;
  const col1X = mg;
  const col2X = pageW / 2 + 5;

  const details: [string, string][] = [
    ['Buyer Name', order.buyer_name], ['Ticket ID', order.ticket_id],
    ['Quantity', String(order.quantity)], ['Total Paid', formatPkr(order.total_amount)],
    ['Date', `${dateStr}${timeStr ? ` ${timeStr}` : ''}`],
    ['Venue', `${venue}${city ? `, ${city}` : ''}`],
  ];

  for (let i = 0; i < 6; i++) {
    const isRight = i >= 3;
    const localIdx = isRight ? i - 3 : i;
    const cx = isRight ? col2X : col1X;
    const cy = gridY + localIdx * rowH;
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

  doc.setDrawColor(83, 74, 183);
  doc.setLineWidth(0.5);
  x = mg;
  while (x < pageW - mg) { const segEnd = Math.min(x + 4, pageW - mg); doc.line(x, 140, segEnd, 140); x += 8; }

  const qrSize = 50;
  const qrData = qrBase64.replace(/^data:image\/png;base64,/, '');
  doc.addImage(qrData, 'PNG', mg, 150, qrSize, qrSize);

  doc.setTextColor(160, 160, 190);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan at', mg + qrSize + 8, 150 + qrSize / 2 - 4);
  doc.text('entry gate', mg + qrSize + 8, 150 + qrSize / 2 + 4);

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(83, 74, 183);
  const footerText = order.ticket_id;
  const footerW = doc.getTextWidth(footerText);
  doc.text(footerText, (pageW - footerW) / 2, pageH - 20);

  return Buffer.from(doc.output('arraybuffer'));
}

function logoUrl(): string {
  return `${process.env.SUPABASE_URL || ''}/storage/v1/object/public/logos/portal-logo.png`;
}

function buildApprovalHtml(order: Order, qrBase64: string): string {
  const event = order.ticket_types?.events;
  const eventName = escapeHtml(event?.name || 'Event');
  const dateStr = escapeHtml(event?.date ? formatDate(event.date) : '—');
  const timeStr = escapeHtml(event?.date ? formatTime(event.date) : '');
  const venue = escapeHtml(event?.venue || '—');
  const city = escapeHtml(event?.city || '');
  const ticketType = escapeHtml(order.ticket_types?.name || 'Ticket');
  const organizerPhone = order.ticket_types?.events?.organizer_phone;
  const locationLink = order.ticket_types?.events?.location_link;
  const termsConditions = order.ticket_types?.events?.terms_conditions;
  const ticketUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/ticket/${escapeHtml(order.ticket_id)}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#534AB7;padding:24px;text-align:center;">
  <img src="${logoUrl()}" alt="Mawj stream" style="height:36px;width:auto;margin-bottom:12px;" />
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Your Ticket is Confirmed!</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${eventName}</p>
</td></tr>
<tr><td style="padding:24px;">
  <p style="margin:0 0 16px;font-size:15px;color:#333;">Hi <strong>${escapeHtml(order.buyer_name)}</strong>,</p>
  <p style="margin:0 0 20px;font-size:14px;color:#555;">Your payment has been verified and your ticket is ready. Details below:</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fc;border-radius:8px;padding:16px;">
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;width:110px;">Event</td><td style="padding:6px 12px;font-size:14px;color:#222;font-weight:bold;">${eventName}</td></tr>
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Date</td><td style="padding:6px 12px;font-size:14px;color:#222;">${dateStr}${timeStr ? ` at ${timeStr}` : ''}</td></tr>
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Venue</td><td style="padding:6px 12px;font-size:14px;color:#222;">${venue}${city ? `, ${city}` : ''}</td></tr>
    ${locationLink ? `<tr><td style="padding:6px 12px;font-size:13px;color:#888;">Location</td><td style="padding:6px 12px;font-size:14px;color:#222;"><a href="${escapeHtml(locationLink)}" style="color:#534AB7;text-decoration:underline;">Open in Google Maps</a></td></tr>` : ''}
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Ticket Type</td><td style="padding:6px 12px;font-size:14px;color:#222;">${ticketType}</td></tr>
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Ticket ID</td><td style="padding:6px 12px;font-size:14px;color:#222;font-family:monospace;">${order.ticket_id}</td></tr>
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Qty</td><td style="padding:6px 12px;font-size:14px;color:#222;">${order.quantity}</td></tr>
    <tr><td style="padding:6px 12px;font-size:13px;color:#888;">Total Paid</td><td style="padding:6px 12px;font-size:14px;color:#222;font-weight:bold;">${formatPkr(order.total_amount)}</td></tr>
    ${organizerPhone ? `<tr><td style="padding:6px 12px;font-size:13px;color:#888;">Questions?</td><td style="padding:6px 12px;font-size:14px;color:#222;">${escapeHtml(organizerPhone)}</td></tr>` : ''}
  </table>
  ${termsConditions ? `
  <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:20px 0;">
    <p style="margin:0 0 6px;font-size:12px;color:#92400e;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Terms &amp; Conditions</p>
    <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">${escapeHtml(termsConditions)}</p>
  </div>` : ''}
  <div style="text-align:center;margin:24px 0 12px;">
    <a href="${ticketUrl}" style="display:inline-block;background:#534AB7;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">View &amp; Download Your Ticket</a>
  </div>
  <p style="text-align:center;margin:0;font-size:13px;color:#888;">Your PDF ticket is also attached to this email.</p>
</td></tr>
<tr><td style="background:#1a1a2e;padding:16px 24px;text-align:center;">
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">Mawj stream Ticket Portal</p>
</td></tr>
</table>
</body>
</html>`.trim();
}

function buildRejectionHtml(order: Order, reason: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#dc2626;padding:24px;text-align:center;">
  <img src="${logoUrl()}" alt="Mawj stream" style="height:36px;width:auto;margin-bottom:12px;" />
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Payment Not Verified</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Booking: ${escapeHtml(order.ticket_id)}</p>
</td></tr>
<tr><td style="padding:24px;">
  <p style="margin:0 0 16px;font-size:15px;color:#333;">Hi <strong>${escapeHtml(order.buyer_name)}</strong>,</p>
  <p style="margin:0 0 12px;font-size:14px;color:#555;">Unfortunately we could not verify your payment receipt for the following reason:</p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:14px;color:#991b1b;font-style:italic;">${escapeHtml(reason)}</p>
  </div>
  <p style="margin:0 0 20px;font-size:14px;color:#555;">Please contact us for assistance.</p>
  <div style="text-align:center;margin:24px 0 12px;">
    <a href="https://wa.me/${(process.env.CONTACT_WHATSAPP || '+923000000000').replace(/[^0-9]/g, '')}" style="display:inline-block;background:#25D366;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Contact via WhatsApp</a>
  </div>
</td></tr>
<tr><td style="background:#1a1a2e;padding:16px 24px;text-align:center;">
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">Mawj stream Ticket Portal</p>
</td></tr>
</table>
</body>
</html>`.trim();
}

export async function sendTicketEmail(order: Order) {
  const transport = getTransporter();
  const event = order.ticket_types?.events;
  const eventName = event?.name || 'Event';
  const qrBase64 = await generateQRCode(order.scan_token!);
  const pdfBuffer = await generateTicketPDF(order, qrBase64);
  const subject = `Your ticket is confirmed — ${eventName}`;
  const htmlBody = buildApprovalHtml(order, qrBase64);

  if (transport) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
      try {
        await transport.sendMail({
          from: process.env.SMTP_FROM || 'noreply@globaltickets.com',
          to: order.buyer_email,
          subject,
          html: htmlBody,
          attachments: [{
            filename: `ticket-${order.ticket_id}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }],
        });
        console.log(`Ticket email sent to ${order.buyer_email} for order ${order.id}`);
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(`Email attempt ${attempt + 1}/3 failed for order ${order.id}:`, (err as Error).message);
      }
    }
    console.error(`Failed to send ticket email for order ${order.id} after 3 attempts:`, lastError);
  } else {
    console.log(`[EMAIL STUB] To: ${order.buyer_email}`);
    console.log(`[EMAIL STUB] Subject: ${subject}`);
    console.log(`[EMAIL STUB] PDF attachment: ticket-${order.ticket_id}.pdf (${pdfBuffer.length} bytes)`);
  }
}

export async function sendVerificationEmail(params: {
  buyer_name: string;
  buyer_email: string;
  ticket_id: string;
  verification_code: string;
}) {
  const transport = getTransporter();
  const subject = 'Your booking verification code';
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#534AB7;padding:24px;text-align:center;">
  <img src="${logoUrl()}" alt="Mawj stream" style="height:36px;width:auto;margin-bottom:12px;" />
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Verify Your Booking</h1>
</td></tr>
<tr><td style="padding:24px;">
  <p style="margin:0 0 16px;font-size:15px;color:#333;">Hi <strong>${escapeHtml(params.buyer_name)}</strong>,</p>
  <p style="margin:0 0 20px;font-size:14px;color:#555;">Your verification code is:</p>
  <div style="text-align:center;margin:24px 0;padding:16px;background:#f8f8fc;border-radius:8px;">
    <span style="font-size:36px;font-weight:bold;color:#534AB7;letter-spacing:8px;font-family:monospace;">${escapeHtml(params.verification_code)}</span>
  </div>
  <p style="margin:0 0 12px;font-size:13px;color:#888;">This code expires in <strong>5 minutes</strong>.</p>
  <p style="margin:0;font-size:13px;color:#888;">If you didn't make this booking, please ignore this email.</p>
</td></tr>
<tr><td style="background:#1a1a2e;padding:16px 24px;text-align:center;">
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">Mawj stream Ticket Portal</p>
</td></tr>
</table>
</body>
</html>`.trim();
  const textBody = `Hi ${params.buyer_name},\n\nYour verification code is: ${params.verification_code}\n\nThis code expires in 5 minutes.\n\nIf you didn't make this booking, ignore this email.`;

  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'noreply@globaltickets.com',
        to: params.buyer_email,
        subject,
        html: htmlBody,
        text: textBody,
      });
      console.log(`Verification email sent to ${params.buyer_email} for order ${params.ticket_id}`);
    } catch (err) {
      console.error(`Failed to send verification email for order ${params.ticket_id}:`, err);
    }
  } else {
    console.log(`[EMAIL STUB] To: ${params.buyer_email}`);
    console.log(`[EMAIL STUB] Subject: ${subject}`);
    console.log(`[EMAIL STUB] Code: ${params.verification_code}`);
  }
}

export async function sendRejectionEmail(order: Order, reason: string) {
  const transport = getTransporter();
  const subject = `Action needed — payment not verified ${order.ticket_id}`;
  const htmlBody = buildRejectionHtml(order, reason);
  const textBody = `Unfortunately we could not verify your payment receipt.\nReason: ${reason.replace(/[\n\r]/g, ' ')}\nPlease contact us at ${process.env.CONTACT_WHATSAPP || '+92 300 0000000'}.`;

  if (transport) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || 'noreply@globaltickets.com',
        to: order.buyer_email,
        subject,
        html: htmlBody,
        text: textBody,
      });
      console.log(`Rejection email sent to ${order.buyer_email} for order ${order.id}`);
    } catch (err) {
      console.error(`Failed to send rejection email for order ${order.id}:`, err);
    }
  } else {
    console.log(`[EMAIL STUB] To: ${order.buyer_email}`);
    console.log(`[EMAIL STUB] Subject: ${subject}`);
    console.log(`[EMAIL STUB] Body: ${textBody}`);
  }
}
