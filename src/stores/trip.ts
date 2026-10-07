import { defineStore } from 'pinia'
import { trackEvent, trackFailure } from '../lib/analytics'
import { computed, reactive, ref, shallowRef } from 'vue'
import {
  loadFallbackRoute,
  loadMagnets,
  medalsFrom,
  epKind,
  type Medal,
  loadManifest,
  loadRoute,
  MEDIA_BASE,
  type Episode,
  type Magnet,
  type Media,
  type MediaType,
  type RoutePoint,
  type Stop,
  type TripInfo,
} from '../lib/manifest'
import { brandIndex, loadBrand } from '../lib/brand'
import { chapterIndex, episode360Media } from '../lib/episode360'

export type LayerKey = MediaType | 'episodes' | 'magnets' | 'medals'

const DAY = 86_400_000
const DEFAULT_TRIP: TripInfo = {
  start: '2025-08-12',
  end: '2025-10-09',
  days: 59,
  miles: 11606,
  tagline: '59 days. One unfolding journey.',
}

function haversineMiles(a: RoutePoint, b: RoutePoint): number {
  const d2r = Math.PI / 180
  const dLa = (b.lat - a.lat) * d2r
  const dLo = (b.lon - a.lon) * d2r
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * d2r) * Math.cos(b.lat * d2r) * Math.sin(dLo / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(x))
}

/** First index i with arr[i].t > t (i.e. count of items with t <= t). */
export function upperBound<T extends { t: number }>(arr: readonly T[], t: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid]!.t <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Rough wall-clock offset (hours) for continental US in DST, from longitude. */
export function approxUtcOffset(lon: number): number {
  return Math.max(-7, Math.min(-4, Math.round(lon / 15) + 1))
}

export const useTripStore = defineStore('trip', () => {
  // ---------- data ----------
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const error = ref('')
  const manifestMissing = ref(false)
  const isFixture = ref(false)
  const pending360 = ref({ photos: 0, videos: 0 })
  const routeSource = ref<'bucket' | 'fallback' | 'none'>('none')
  const trip = ref<TripInfo>({ ...DEFAULT_TRIP })
  const stops = shallowRef<Stop[]>([])
  const episodes = shallowRef<Episode[]>([])
  const episodePaths = shallowRef<Map<number, [number, number][]>>(new Map())
  const media = shallowRef<Media[]>([])
  const route = shallowRef<RoutePoint[]>([])
  const routeMiles = shallowRef<Float64Array>(new Float64Array())
  const magnets = shallowRef<Magnet[]>([])
  const medals = shallowRef<Medal[]>([])

  // ---------- filters / layers ----------
  const layers = reactive<Record<LayerKey, boolean>>({
    episodes: true,
    photo: true,
    video: true,
    pano: true,
    'pano-video': true,
    splat: true,
    'xr-scene': true,
    magnets: true,
    medals: true,
  })
  const dateFrom = ref<string | null>(null) // YYYY-MM-DD inclusive
  const dateTo = ref<string | null>(null)
  const stopFilter = ref<number | null>(null)

  // ---------- timeline ----------
  const tStart = computed(() => {
    const r = route.value
    const fromTrip = Date.parse(`${trip.value.start}T00:00:00-04:00`)
    return r.length ? Math.min(r[0]!.t, fromTrip) : fromTrip
  })
  const tEnd = computed(() => {
    const r = route.value
    const fromTrip = Date.parse(`${trip.value.end}T23:59:59-04:00`)
    const m = media.value
    const lastMedia = m.length ? m[m.length - 1]!.t : 0
    return Math.max(r.length ? r[r.length - 1]!.t : 0, fromTrip, lastMedia)
  })
  const t = ref(Number.MAX_SAFE_INTEGER) // "end" until init sets it
  const playing = ref(false)
  const speed = ref(1)
  const atEnd = computed(() => t.value >= tEnd.value)

  // ---------- selection ----------
  const openEpisode = ref<number | null>(null)
  const lightbox = shallowRef<{ list: Media[]; index: number; film?: boolean } | null>(null)
  const focus = shallowRef<{ bounds: [number, number][]; seq: number } | null>(null)
  const hoverEpisode = ref<number | null>(null)
  let focusSeq = 0

  // ---------- derived ----------
  const stopById = computed(() => new Map(stops.value.map((s) => [s.id, s])))
  const episodeByNum = computed(() => new Map(episodes.value.map((e) => [e.ep, e])))

  const typeCounts = computed(() => {
    const c: Record<string, number> = {}
    for (const m of media.value) c[m.type] = (c[m.type] || 0) + 1
    return c
  })
  const stopCounts = computed(() => {
    const c = new Map<number, number>()
    for (const m of media.value) if (m.stop != null) c.set(m.stop, (c.get(m.stop) || 0) + 1)
    return c
  })

  /** All non-time filters applied; sorted by time. */
  const filteredMedia = computed<Media[]>(() => {
    const from = dateFrom.value
    const to = dateTo.value
    const stop = stopFilter.value
    return media.value.filter(
      (m) =>
        layers[m.type] !== false &&
        (stop == null || m.stop === stop) &&
        (!from || m.day >= from) &&
        (!to || m.day <= to),
    )
  })
  /** How many of filteredMedia are at or before the timeline head. */
  const visibleCount = computed(() => (atEnd.value ? filteredMedia.value.length : upperBound(filteredMedia.value, t.value)))

  function routeIndexAt(time: number): number {
    return Math.max(0, upperBound(route.value, time) - 1)
  }

  /** Interpolated position at time. */
  function positionAt(time: number): [number, number] | null {
    const r = route.value
    if (!r.length) return null
    const i = routeIndexAt(time)
    const a = r[i]!
    const b = r[i + 1]
    if (!b || time <= a.t) return [a.lat, a.lon]
    const k = Math.min(1, (time - a.t) / Math.max(1, b.t - a.t))
    return [a.lat + (b.lat - a.lat) * k, a.lon + (b.lon - a.lon) * k]
  }

  const headPosition = computed(() => positionAt(Math.min(t.value, tEnd.value)))

  const currentMiles = computed(() => {
    const rm = routeMiles.value
    if (!rm.length) return 0
    if (atEnd.value) return trip.value.miles
    return Math.round(rm[routeIndexAt(t.value)] || 0)
  })

  /** Local calendar date (YYYY-MM-DD) at the timeline head, using an offset from the car's longitude. */
  const currentLocalDate = computed(() => {
    const time = Math.min(t.value, tEnd.value)
    const pos = headPosition.value
    const off = approxUtcOffset(pos ? pos[1] : -90)
    return new Date(time + off * 3_600_000).toISOString().slice(0, 10)
  })

  const currentDay = computed(() => {
    const d = Math.round((Date.parse(currentLocalDate.value) - Date.parse(trip.value.start)) / DAY) + 1
    return Math.max(1, Math.min(trip.value.days, d))
  })

  const currentEpisode = computed<Episode | null>(() => {
    const d = currentLocalDate.value
    const legs = episodes.value.filter((e) => episodePaths.value.has(e.ep))
    let hit: Episode | null = null
    for (const e of legs) if (e.start <= d) hit = e
    return hit
  })

  // ---------- actions ----------
  function computeEpisodePaths() {
    const map = new Map<number, [number, number][]>()
    const r = route.value
    for (const e of episodes.value) {
      if (epKind(e) === 'intro') continue // the intro has no leg
      if (Array.isArray(e.path)) {
        if (e.path.length >= 2) map.set(e.ep, e.path)
        continue // explicit [] = no leg (e.g. the epilogue)
      }
      if (!r.length || !e.start) continue
      // fallback: slice the route by the episode's dates
      const a = Date.parse(`${e.start}T00:00:00-07:00`)
      const b = Date.parse(`${e.end || e.start}T23:59:59-04:00`)
      const pts = r.filter((p) => p.t >= a && p.t <= b).map((p) => [p.lat, p.lon] as [number, number])
      if (pts.length >= 2) map.set(e.ep, pts)
    }
    episodePaths.value = map
  }

  function computeRouteMiles() {
    const r = route.value
    const cum = new Float64Array(r.length)
    for (let i = 1; i < r.length; i++) cum[i] = cum[i - 1]! + haversineMiles(r[i - 1]!, r[i]!)
    const total = cum[cum.length - 1] || 0
    const scale = total > 0 && trip.value.miles ? trip.value.miles / total : 1
    for (let i = 0; i < cum.length; i++) cum[i]! *= scale
    routeMiles.value = cum
  }

  /** Point at fraction f (0..1) of the route's length. */
  function atFraction(f: number): [number, number] | null {
    const r = route.value
    const cum = routeMiles.value
    if (!r.length) return null
    const target = Math.max(0, Math.min(1, f)) * (cum[cum.length - 1] || 0)
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid]! < target) lo = mid + 1
      else hi = mid
    }
    return [r[lo]!.lat, r[lo]!.lon]
  }

  /** Where an episode ends: its stop, else the end of its leg. */
  function episodeEnd(ep: number): [number, number] | null {
    const e = episodeByNum.value.get(ep)
    const s = e?.stops?.length ? stopById.value.get(e.stops[e.stops.length - 1]!) : undefined
    if (s) return [s.lat, s.lon]
    const p = episodePaths.value.get(ep)
    return p ? p[p.length - 1]! : null
  }

  async function init() {
    status.value = 'loading'
    let routeKey = 'route/route.json'
    let brandKey = 'brand/brand.json'
    try {
      const { manifest, media: items, pending360: pending } = await loadManifest()
      pending360.value = pending
      trip.value = { ...DEFAULT_TRIP, ...(manifest.trip || {}) }
      stops.value = (manifest.stops || []).filter((s) => !(s.lat === 0 && s.lon === 0))
      episodes.value = [...(manifest.episodes || [])].sort((a, b) => a.ep - b.ep)
      media.value = Object.freeze(items) as Media[]
      isFixture.value = !!manifest.fixture
      if (manifest.route) routeKey = manifest.route
      if (manifest.brand) brandKey = manifest.brand
    } catch (e) {
      console.warn('[trip] manifest unavailable:', e)
      manifestMissing.value = true
      trackFailure('data', 'manifest')
    }

    try {
      route.value = await loadRoute(routeKey)
      routeSource.value = 'bucket'
    } catch {
      try {
        route.value = await loadFallbackRoute()
        routeSource.value = 'fallback'
        trackFailure('data', 'route_fallback')
      } catch (e) {
        console.error('[trip] no route available', e)
        routeSource.value = 'none'
        trackFailure('data', 'route')
      }
    }
    computeRouteMiles()
    computeEpisodePaths()
    t.value = tEnd.value
    status.value = route.value.length || media.value.length ? 'ready' : 'error'
    if (status.value === 'error') {
      error.value = MEDIA_BASE
        ? `Couldn't load the trip from ${MEDIA_BASE}.`
        : 'VITE_MEDIA_BASE is not set and no local data was found.'
    }
    loadBrand(brandKey).then(async () => {
      medals.value = medalsFrom(brandIndex.value?.medals)
      magnets.value = await loadMagnets(brandIndex.value?.magnets || 'brand/magnets.json', stops.value, atFraction, episodeEnd)
    })
  }

  function setLayer(key: LayerKey, on: boolean) {
    if (layers[key] !== on) trackEvent('map_layer', { layer: key, enabled: on })
    layers[key] = on
  }

  function focusOn(bounds: [number, number][]) {
    if (bounds.length) focus.value = { bounds, seq: ++focusSeq }
  }

  function focusEpisode(ep: number) {
    const p = episodePaths.value.get(ep)
    if (p) focusOn(p)
    else {
      const r = route.value
      const last = r[r.length - 1]
      if (last) focusOn([[last.lat, last.lon]])
    }
  }

  function showEpisode(ep: number | null) {
    if (ep != null && ep !== openEpisode.value && episodeByNum.value.has(ep)) trackEvent('episode_select', { episode: ep })
    openEpisode.value = ep
    const e = ep != null ? episodeByNum.value.get(ep) : undefined
    if (e && epKind(e) !== 'intro') focusEpisode(e.ep)
  }

  /** Numbered episodes only (excludes the intro), e.g. 36. */
  const episodeCount = computed(() => episodes.value.filter((e) => epKind(e) !== 'intro').length)
  const intro = computed(() => episodes.value.find((e) => epKind(e) === 'intro') || null)

  function stepEpisode(delta: number) {
    if (openEpisode.value == null) return
    const list = episodes.value
    const i = list.findIndex((e) => e.ep === openEpisode.value)
    const next = list[i + delta]
    if (next) showEpisode(next.ep)
  }

  function openMedia(m: Media, list?: Media[]) {
    const l = list || filteredMedia.value.slice(0, visibleCount.value)
    let i = l.indexOf(m)
    let arr = l
    if (i < 0) {
      arr = [...l, m].sort((a, b) => a.t - b.t)
      i = arr.indexOf(m)
    }
    lightbox.value = { list: arr, index: i }
  }

  function openMediaById(id: string): boolean {
    const chapter = /^e(\d+)-vr$/.exec(id)
    if (chapter) return openEpisode360(Number(chapter[1]))
    const m = media.value.find((x) => x.id === id)
    if (m) openMedia(m, filteredMedia.value.includes(m) ? filteredMedia.value : media.value)
    return !!m
  }

  function stepMedia(delta: number) {
    const lb = lightbox.value
    if (!lb) return
    const i = lb.index + delta
    if (i < 0 || i >= lb.list.length) return
    lightbox.value = { ...lb, index: i }
  }

  function openEpisode360(ep?: number): boolean {
    const selected = ep === 36 ? episodes.value.filter(e => e.ep === 36) : episodes.value.filter(e => epKind(e) !== 'epilogue')
    const list = episode360Media(selected, stops.value)
    const index = chapterIndex(list, ep)
    if (index < 0) return false
    trackEvent('episode_select', { episode: list[index]!.episode ?? 0, format: '360' })
    lightbox.value = { list, index, film: true }
    return true
  }

  function closeMedia() {
    lightbox.value = null
  }

  function setStop(id: number | null) {
    trackEvent('map_stop', { stop: id ?? 'all' })
    stopFilter.value = id
    if (id == null) return
    const s = stopById.value.get(id)
    const pts: [number, number][] = media.value.filter((m) => m.stop === id).map((m) => [m.lat, m.lon])
    if (s) pts.push([s.lat, s.lon])
    focusOn(pts)
  }

  function resetFilters() {
    trackEvent('map_filter_reset')
    dateFrom.value = null
    dateTo.value = null
    stopFilter.value = null
    for (const k of Object.keys(layers) as LayerKey[]) layers[k] = true
    t.value = tEnd.value
  }

  function setTime(v: number) {
    t.value = Math.max(tStart.value, Math.min(tEnd.value, v))
  }

  return {
    // data
    status,
    error,
    manifestMissing,
    isFixture,
    pending360,
    routeSource,
    trip,
    stops,
    episodes,
    episodePaths,
    media,
    route,
    routeMiles,
    magnets,
    medals,
    episodeEnd,
    episodeCount,
    intro,
    // filters
    layers,
    dateFrom,
    dateTo,
    stopFilter,
    // timeline
    tStart,
    tEnd,
    t,
    playing,
    speed,
    atEnd,
    // selection
    openEpisode,
    lightbox,
    focus,
    hoverEpisode,
    // derived
    stopById,
    episodeByNum,
    typeCounts,
    stopCounts,
    filteredMedia,
    visibleCount,
    headPosition,
    currentMiles,
    currentLocalDate,
    currentDay,
    currentEpisode,
    // actions
    init,
    setLayer,
    focusOn,
    focusEpisode,
    showEpisode,
    stepEpisode,
    openMedia,
    openMediaById,
    openEpisode360,
    stepMedia,
    closeMedia,
    setStop,
    resetFilters,
    setTime,
    routeIndexAt,
    positionAt,
  }
})
