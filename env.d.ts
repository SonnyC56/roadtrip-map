/// <reference types="vite/client" />
/// <reference types="leaflet.markercluster" />

interface ImportMetaEnv {
  /** Public base URL of the media bucket (Cloudflare R2), no trailing slash. */
  readonly VITE_MEDIA_BASE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
