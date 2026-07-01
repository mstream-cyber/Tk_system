import posthog from 'posthog-js'

export function initAnalytics() {
  if (typeof window === 'undefined') return
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.opt_out_capturing()
    },
  })
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  posthog.capture(name, properties)
}
