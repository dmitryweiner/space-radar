/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev override for the caching proxy's base URL (see src/api/proxy.ts). */
  readonly VITE_PROXY_BASE?: string;
}
