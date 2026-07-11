/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCAN_PIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare function fbq(command: string, eventName: string, parameters?: Record<string, unknown>): void;
