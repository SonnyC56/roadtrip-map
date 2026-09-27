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

export type EpisodeFormatKey = '16x9' | '9x16' | 'vr'

export interface EpisodeFormat {
  src: string
  poster?: string
  w?: number
  h?: number
  ready?: boolean
  version?: string
  duration?: number
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
  /** '16x9' / '9x16': the flat film. 'vr': the VR edition (mono equirect 360 MP4, 3840x1920), when published. */
  formats: Partial<Record<EpisodeFormatKey, EpisodeFormat>>
  ready?: boolean
  kind?: 'intro' | 'episode' | 'epilogue'
}

/** kind from the manifest, else by number: 0 = intro, 36 = epilogue. */
export function epKind(e: Pick<Episode, 'ep' | 'kind'>): 'intro' | 'episode' | 'epilogue' {
  if (e.kind === 'intro' || e.kind === 'epilogue' || e.kind === 'episode') return e.kind
  return e.ep === 0 ? 'intro' : e.ep === 36 ? 'epilogue' : 'episode'
}

/** "INTRO" or "E07" */
export function epLabel(e: Pick<Episode, 'ep' | 'kind'>): string {
  return epKind(e) === 'intro' ? 'INTRO' : `E${String(e.ep).padStart(2, '0')}`
}

/** A format is playable unless the manifest explicitly says it isn't ready yet. */
export function playableFormat(e: Episode | null | undefined, k: EpisodeFormatKey): EpisodeFormat | null {
  const f = e?.formats?.[k]
  return f && f.src && f.ready !== false ? f : null
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
  time_utc: string | null
  local_time?: string | null
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
  /** brand index key, e.g. "brand/brand.json" */
  brand?: string
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

export interface Medal {
  id: string
  name: string
  n: number // park number in Sonny's count (1..17)
  ep: number
  src: string
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return (await res.json()) as T
}

export async function loadManifest(): Promise<{ manifest: Manifest; media: Media[]; pending360: { photos: number; videos: number } }> {
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
  // Raw files are uploaded separately from episode releases. Never advertise missing 360 objects.
  const pending360 = { photos: 0, videos: 0 }
  try {
    const a = await getJson<{ version: number; photos: string[]; videos: string[]; tiledPhotos: string[] }>(mediaUrl('media-availability.json'))
    if (a.version === 1 && [a.photos, a.videos, a.tiledPhotos].every(v => Array.isArray(v) && v.every(x => typeof x === 'string'))) {
      const photos = new Set(a.photos), videos = new Set(a.videos), tiled = new Set(a.tiledPhotos)
      for (const m of raw) {
        if (m.type === 'pano' && !photos.has(m.id)) { m.ready = false; pending360.photos++ }
        else if (m.type === 'pano-video' && !videos.has(m.id)) { m.ready = false; pending360.videos++ }
        else if (m.type === 'pano' && m.pano && !tiled.has(m.id)) {
          // A complete preview is already a valid sphere; add high-resolution tiles when uploaded.
          m.src = m.pano.preview
          m.pano = null
        }
      }
    }
  } catch { /* older/local asset servers may not have an availability index yet */ }
  // dev-only fixture for the VR edition (dropped from production builds)
  if (import.meta.env.DEV && /[?&]vrfixture\b/.test(location.search)) {
    ;(await import('./vrFixture')).applyVRFixture(manifest, raw)
  }
  const stopStart = new Map((manifest.stops || []).map((s) => [s.id, s.start]))
  const epStart = new Map((manifest.episodes || []).map((e) => [e.ep, e.start]))
  const media: Media[] = []
  for (const m of raw) {
    if (m.ready === false) continue
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon) || (m.lat === 0 && m.lon === 0)) continue
    let t = Date.parse(m.time_utc || m.local_time || '')
    let day = (m.local_time || m.time_utc || '').slice(0, 10)
    if (!Number.isFinite(t)) {
      // undated (e.g. placed at a stop): put it at midday on the stop's / episode's first day
      const d = (m.stop != null && stopStart.get(m.stop)) || (m.episode != null && epStart.get(m.episode)) || ''
      t = Date.parse(`${d}T12:00:00-06:00`)
      day = d
    }
    if (!Number.isFinite(t)) continue
    media.push({ ...m, t, day })
  }
  media.sort((a, b) => a.t - b.t)
  return { manifest, media, pending360 }
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

/**
 * brand/magnets.json — an array or {magnets: [...]}. Each entry needs src (or file) and a position:
 * lat/lon, a stop id, `through` (0..1 fraction along the route) or an episode (placed at its leg's end).
 */
export async function loadMagnets(
  key: string,
  stops: Stop[],
  atFraction: (f: number) => [number, number] | null,
  episodeEnd: (ep: number) => [number, number] | null,
): Promise<Magnet[]> {
  let data: unknown
  try {
    data = await getJson<unknown>(mediaUrl(key))
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
    let pos: [number, number] | null = null
    const lat = Number(r.lat)
    const lon = Number(r.lon ?? r.lng)
    if (r.lat != null && Number.isFinite(lat) && Number.isFinite(lon)) pos = [lat, lon]
    else if (r.stop != null && byStop.get(Number(r.stop))) {
      const s = byStop.get(Number(r.stop))!
      pos = [s.lat, s.lon]
    } else if (r.through != null && Number.isFinite(Number(r.through))) pos = atFraction(Number(r.through))
    else if (r.episode != null) pos = episodeEnd(Number(r.episode))
    if (!pos) continue
    out.push({
      label: String(r.label || r.name || r.key || ''),
      src,
      lat: pos[0],
      lon: pos[1],
      kind: r.kind as string,
      episode: Number(r.episode) || undefined,
    })
  }
  return out
}

// Sonny's 17 national parks, in order (Banff excluded: "Banff is Canada, it doesn't count").
const PARKS: [string, string, number][] = [
  ['grand_teton', 'Grand Teton', 3],
  ['yellowstone', 'Yellowstone', 4],
  ['glacier', 'Glacier', 5],
  ['olympic', 'Olympic', 10],
  ['mount_rainier', 'Mount Rainier', 11],
  ['crater_lake', 'Crater Lake', 14],
  ['redwood', 'Redwood', 15],
  ['pinnacles', 'Pinnacles', 20],
  ['channel_islands', 'Channel Islands', 23],
  ['joshua_tree', 'Joshua Tree', 26],
  ['death_valley', 'Death Valley', 27],
  ['grand_canyon', 'Grand Canyon', 28],
  ['zion', 'Zion', 29],
  ['bryce_canyon', 'Bryce Canyon', 30],
  ['arches', 'Arches', 32],
  ['gateway_arch', 'Gateway Arch', 33],
  ['new_river_gorge', 'New River Gorge', 34],
]

/** Park medals from brand.json `medals` ({ park_id: "brand/medals/x.webp" }). */
export function medalsFrom(map: Record<string, string> | undefined): Medal[] {
  if (!map) return []
  return PARKS.filter(([id]) => map[id]).map(([id, name, ep], i) => ({ id, name, n: i + 1, ep, src: map[id]! }))
}

/** Adapter for the kept StorySplat / XR viewers. */
export function toLegacyItem(m: Media): LegacyItem {
  return {
    id: m.id,
    type: m.type,
    url: mediaUrl(m.src),
    thumbnail: mediaUrl(m.thumb),
    caption: m.caption,
    timestamp: m.local_time || m.time_utc || new Date(m.t).toISOString(),
    location: { lat: m.lat, lng: m.lon, isInferred: m.loc !== 'gps' },
    splatConfig: m.splat,
    xrConfig: m.xr,
  }
}
