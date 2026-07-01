# Admin Order Notification Email Plan

## What

Send an email to the admin whenever a new ticket order is placed (both from the public booking page and gate sales).

## Changes

### 1. Add `NOTIFY_EMAIL` to `.env`

The admin's email address where notifications will be sent. Keep it optional — if not set, no notification is sent.

### 2. Add `sendNewOrderNotification` to `server/src/services/email.ts`

New exported function that sends an HTML email to `NOTIFY_EMAIL` with:
- Subject: `New Booking — {event_name}`
- Body: Event, Ticket Type, Buyer name/email/phone/city, Quantity, Total, Ticket ID, Payment Method, Admin dashboard link

Signature:
```typescript
export async function sendNewOrderNotification(params: {
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  buyer_city: string | null
  ticket_type_name: string
  event_name: string
  quantity: number
  total_amount: number
  ticket_id: string
  order_id: string
  payment_method: string
}): Promise<void>
```

### 3. Update `server/src/routes/booking.ts`

**a)** Change the `ticket_types` query (line 42) from:
```typescript
.select('*')
```
to:
```typescript
.select('*, events!inner(name)')
```

This fetches the event name alongside the ticket type data.

**b)** After the order is successfully created (after line 86), fire the notification:

```typescript
const notifyEmail = process.env.NOTIFY_EMAIL
if (notifyEmail) {
  sendNewOrderNotification({
    buyer_name,
    buyer_email,
    buyer_phone,
    buyer_city,
    ticket_type_name: ticketType.name,
    event_name: ticketType.events?.name || 'Event',
    quantity,
    total_amount,
    ticket_id,
    order_id: order.id,
    payment_method,
  }).catch((err) => console.error('Failed to send order notification:', err))
}
```

### 4. Update `server/src/routes/admin.ts` (gate sale)

After the gate sale order is created and emailOrder is constructed (after line 243), fire the same notification. The gate sale query already uses `*, events!inner(*)` so `ticketType.events?.name` is available.

### 5. Optional env validation

`NOTIFY_EMAIL` is optional — no startup check needed. If absent, the `if (notifyEmail)` guard skips the notification.
