# PostHog Analytics Implementation Plan

## Setup

1. Install `posthog-js` in client:
```bash
cd client && npm install posthog-js
```

2. Add to `client/.env`:
```
VITE_POSTHOG_KEY=phc_zyr2oDwuBUgqjmkf5WsPVKTsXcgDSVhYwRkspaGHYAy6
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

3. Create `client/src/lib/analytics.ts`:
```typescript
import posthog from 'posthog-js'

export function initAnalytics() {
  if (typeof window === 'undefined') return
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    capture_pageview: false,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing()
    },
  })
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  posthog.capture(name, properties)
}
```

4. Wire into `App.tsx`:
   - Import `initAnalytics` and `useLocation`
   - Call `initAnalytics()` on mount
   - Add `useEffect` on location to fire `$pageview` on route changes

5. Add custom events at these locations:

### BookingPage.tsx

| Event | Location | Properties |
|---|---|---|
| `booking_started` | Line ~147 (handleSubmit) | `{ event_id: form.ticketTypeId }` |
| `booking_created` | After line 170 (booking successful) | `{ order_id, event_id }` |
| `receipt_uploaded` | After line 181 (upload success) | `{ order_id }` |
| `email_verify_sent` | After line 265 (resend success) | `{ order_id }` |
| `email_verified` | After line 287 (verify success) | `{ order_id }` |
| `payment_status_checked` | handleCheckStatus | `{ order_id, status }` |

### TicketPage.tsx

| Event | Location | Properties |
|---|---|---|
| `ticket_viewed` | After fetch success (order data loaded) | `{ ticket_id, status: approved/pending }` |

## PostHog Dashboard

After deployment, in PostHog:
1. **Traffic**: Automatic — pageviews, DAU/MAU, location, device, referrer
2. **Funnel**: Create "Booking Funnel" → `booking_created` → `receipt_uploaded` → `email_verified` → `ticket_viewed`
3. **Trends**: Chart each event over time to track conversion rates
4. **Session recordings**: Enable in PostHog settings to watch real user sessions
