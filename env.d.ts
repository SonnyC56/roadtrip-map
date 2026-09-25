/// <reference types="vite/client" />
/// <reference types="leaflet.markercluster" />

interface ImportMetaEnv {
  /** Public base URL of the media bucket (Cloudflare R2), no trailing slash. */
  readonly VITE_MEDIA_BASE?: string
  /** Basemap preset: esri-dark (default) | stadia-dark | carto-dark | a tile URL template. */
  readonly VITE_BASEMAP?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
