// Data contract: D:/RoadTrip-Production/site/manifest-schema.md (v1).
// Everything is read relative to VITE_MEDIA_BASE (R2 public URL in prod, local static server in dev).
import type { MediaItem as LegacyItem, SplatConfig, XRSceneConfig } from './legacyViewer'

export const MEDIA_BASE = String(import.meta.env.VITE_MEDIA_BASE || '').replace(/\/+$/, '')

/** Resolve a bucket-relative key (or pass through an absolute URL). */
export function mediaUrl(key: string | null | undefined): string {
  if (!key) return ''
  if (/^(https?:|data:|blob:)/i.test(key)) return key
  const k = key.replace(/^\/+/, '')
  return MEDIA_BASE ? `${MEDIA_BASE}/${k}` : `/${k}`
}

export type MediaType = 'photo' | 'video' | 'pano' | 'pano-video' | 'splat' | 'xr-scene'
export const MEDIA_TYPES: MediaType[] = ['photo', 'video', 'pano', 'pano-video', 'splat', 'xr-scene']

export interface TripInfo {
  start: string
  end: string
  days: number
  miles: number
  tagline?: string
}

export interface Stop {
  id: number
  name: string
  start: string
  end: string
  lat: number
  lon: number
}

export interface EpisodeFormat {
  src: string
  poster?: string
  w?: number
  h?: number
}

export interface Episode {
  ep: number
  title: string
  start: string
  end: string
  stops: number[]
  path?: [number, number][]
  duration?: number
  version?: string
  formats: Partial<Record<'16x9' | '9x16', EpisodeFormat>>
}

export interface PanoInfo {
  preview: string
  tiles: string
  cols: number
  rows: number
  width: number
}

export interface RawMedia {
  id: string
  type: MediaType
  source?: string
  stop?: number | null
  episode?: number | null
  time_utc: string
  local_time?: string
  lat: number
  lon: number
  loc?: 'gps' | 'timeline' | 'stop' | string
  loc_confidence?: 'high' | 'medium' | 'low' | string
  w?: number
  h?: number
  duration?: number
  src: string
  thumb?: string | null
  poster?: string | null
  pano?: PanoInfo | null
  ready?: boolean
  caption?: string
  // Optional extensions for Sonny's immersive types (not in schema v1):
  splat?: SplatConfig
  xr?: XRSceneConfig
}

/** RawMedia + precomputed fields. */
export interface Media extends RawMedia {
  t: number // ms since epoch (UTC)
  day: string // YYYY-MM-DD in the photo's local time
}

export interface Manifest {
  version: number
  generated?: string
  fixture?: boolean
  trip: TripInfo
  route?: string
  stops: Stop[]
  episodes: Episode[]
  media: (RawMedia | string)[]
  /** Optional: split media files, e.g. ["media-01.json", ...] (each an array or {media: [...]}) */
  media_files?: string[]
}

export interface RoutePoint {
  lat: number
  lon: number
  t: number // ms
}

export interface Magnet {
  label: string
  src: string
  lat: number
  lon: number
  kind?: string
  episode?: number
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return (await res.json()) as T
}

export async function loadManifest(): Promise<{ manifest: Manifest; media: Media[] }> {
  const manifest = await getJson<Manifest>(mediaUrl('manifest.json'))
  const raw: RawMedia[] = []
  const extraFiles: string[] = [...(manifest.media_files || [])]
  for (const m of manifest.media || []) {
    if (typeof m === 'string') extraFiles.push(m)
    else raw.push(m)
  }
  if (extraFiles.length) {
    const parts = await Promise.all(
      extraFiles.map((f) =>
        getJson<RawMedia[] | { media: RawMedia[] }>(mediaUrl(f)).catch((e) => {
          console.warn('media file failed', f, e)
          return [] as RawMedia[]
        }),
      ),
    )
    for (const p of parts) raw.push(...(Array.isArray(p) ? p : p.media || []))
  }
  const media: Media[] = []
  for (const m of raw) {
    if (m.ready === false) continue
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon) || (m.lat === 0 && m.lon === 0)) continue
    const t = Date.parse(m.time_utc)
    if (!Number.isFinite(t)) continue
    media.push({ ...m, t, day: (m.local_time || m.time_utc).slice(0, 10) })
  }
  media.sort((a, b) => a.t - b.t)
  return { manifest, media }
}

/** route.json: [[lat, lon, t_unix], ...] */
export async function loadRoute(path: string): Promise<RoutePoint[]> {
  const pts = await getJson<[number, number, number][]>(mediaUrl(path))
  return pts
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([lat, lon, t]) => ({ lat, lon, t: t > 1e12 ? t : t * 1000 }))
}

/** Fallback until route/route.json exists: the Google timeline export bundled in /public. */
export async function loadFallbackRoute(): Promise<RoutePoint[]> {
  const data = await getJson<{ semanticSegments: { timelinePath?: { point: string; time: string }[] }[] }>(
    '/roadtrip2025_mod.json',
  )
  const out: RoutePoint[] = []
  for (const s of data.semanticSegments || []) {
    for (const p of s.timelinePath || []) {
      const [la, lo] = p.point.replace(/°/g, '').split(',').map((v) => parseFloat(v))
      const t = Date.parse(p.time)
      if (Number.isFinite(la) && Number.isFinite(lo) && Number.isFinite(t)) out.push({ lat: la!, lon: lo!, t })
    }
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

/** brand/magnets.json — accepts an array or {magnets: [...]}; each needs src/file + lat/lon (or a stop id). */
export async function loadMagnets(stops: Stop[]): Promise<Magnet[]> {
  let data: unknown
  try {
    data = await getJson<unknown>(mediaUrl('brand/magnets.json'))
  } catch {
    return []
  }
  const list = (Array.isArray(data) ? data : (data as { magnets?: unknown[] })?.magnets) || []
  const byStop = new Map(stops.map((s) => [s.id, s]))
  const out: Magnet[] = []
  for (const r of list as Record<string, unknown>[]) {
    let src = String(r.src || r.file || r.image || '')
    if (!src) continue
    if (!/^(https?:|\/)/.test(src) && !src.startsWith('brand/')) src = `brand/${src}`
    let lat = Number(r.lat)
    let lon = Number(r.lon ?? r.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const s = byStop.get(Number(r.stop))
      if (!s) continue
      lat = s.lat
      lon = s.lon
    }
    out.push({ label: String(r.label || r.name || ''), src, lat, lon, kind: r.kind as string, episode: Number(r.episode) || undefined })
  }
  return out
}

/** Adapter for the kept StorySplat / XR viewers. */
export function toLegacyItem(m: Media): LegacyItem {
  return {
    id: m.id,
    type: m.type,
    url: mediaUrl(m.src),
    thumbnail: mediaUrl(m.thumb),
    caption: m.caption,
    timestamp: m.local_time || m.time_utc,
    location: { lat: m.lat, lng: m.lon, isInferred: m.loc !== 'gps' },
    splatConfig: m.splat,
    xrConfig: m.xr,
  }
}
