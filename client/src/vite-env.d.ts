/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCAN_PIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare function fbq(command: string, eventName: string, parameters?: Record<string, unknown>): void;

interface PostHog {
  capture(name: string, properties?: Record<string, unknown>): void
  opt_out_capturing(): void
  identify(id: string, properties?: Record<string, unknown>): void
  reset(): void
}

interface Window {
  posthog?: PostHog
}
