export function initAnalytics() {
  if (typeof window === 'undefined') return
  if (import.meta.env.DEV) {
    window.posthog?.opt_out_capturing()
  }
}

export function captureEvent(name: string, properties?: Record<string, unknown>) {
  window.posthog?.capture(name, properties)
}
