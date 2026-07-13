import type { ApiResponse, BookingPayload, BookingData, EventType, OrderStatus, PaymentConfig, TicketOrder } from './types';

const BASE = '/api';

export async function fetchEvents(): Promise<ApiResponse<EventType[]>> {
  const res = await fetch(`${BASE}/events`);
  return res.json();
}

export async function fetchConfig(): Promise<ApiResponse<PaymentConfig>> {
  const res = await fetch(`${BASE}/config`);
  return res.json();
}

export async function createBooking(
  payload: BookingPayload
): Promise<ApiResponse<BookingData>> {
  const res = await fetch(`${BASE}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function uploadReceipt(
  orderId: string,
  file: File
): Promise<ApiResponse<{ message: string }>> {
  const formData = new FormData();
  formData.append('order_id', orderId);
  formData.append('receipt_image', file);
  const res = await fetch(`${BASE}/payment/upload-receipt`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export function uploadReceiptWithProgress(
  orderId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<ApiResponse<{ message: string }>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/payment/upload-receipt`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch (err) {
        console.error('Failed to parse upload response:', err);
        resolve({ success: false, error: 'Upload failed' });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: 'Network error. Please try again.' });
    };

    const formData = new FormData();
    formData.append('order_id', orderId);
    formData.append('receipt_image', file);
    xhr.send(formData);
  });
}

export async function getOrderStatus(
  orderId: string,
  email?: string
): Promise<ApiResponse<OrderStatus>> {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  const res = await fetch(`${BASE}/payment/order/${orderId}/status${params}`);
  return res.json();
}

export async function verifyEmail(
  orderId: string,
  code: string
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${BASE}/verify/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function resendVerificationCode(
  orderId: string
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${BASE}/verify/${orderId}/resend`, {
    method: 'POST',
  });
  return res.json();
}

export async function sendPreVerifyCode(
  email: string
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${BASE}/pre-verify/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function confirmPreVerifyCode(
  email: string,
  code: string
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${BASE}/pre-verify/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return res.json();
}

export async function joinWaitlist(
  eventId: string,
  email: string
): Promise<ApiResponse<{ message: string }>> {
  const res = await fetch(`${BASE}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, email }),
  });
  return res.json();
}

export async function fetchTicket(
  ticketId: string
): Promise<ApiResponse<TicketOrder>> {
  const res = await fetch(`${BASE}/ticket/${ticketId}`);
  return res.json();
}
