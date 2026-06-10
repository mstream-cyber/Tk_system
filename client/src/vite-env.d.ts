/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCAN_PIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
