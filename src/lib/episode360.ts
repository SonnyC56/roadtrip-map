import { episodeVersionLabel, type Episode, type Media, type Stop } from './manifest'

/** The same ordered, playable 360 chapters for either on-screen entry point. */
export function episode360Media(episodes: Episode[], stops: Stop[]): Media[] {
  const byStop = new Map(stops.map(stop => [stop.id, stop]))
  return [...episodes].sort((a, b) => a.ep - b.ep).flatMap(e => {
    const f = e.formats.vr
    if (!f?.src || f.ready === false) return []
    const stop = e.stops.map(id => byStop.get(id)).find(Boolean)
    const intro = e.kind === 'intro' || (!e.kind && e.ep === 0)
    const label = intro ? 'INTRO' : `E${String(e.ep).padStart(2, '0')}`
    const title = label === e.title.toUpperCase() ? e.title : `${label} · ${e.title}`
    return [{
      id: `e${e.ep}-vr`, type: 'pano-video', episode: e.ep, stop: stop?.id ?? null,
      time_utc: null, lat: stop?.lat ?? 0, lon: stop?.lon ?? 0,
      src: f.src, poster: f.poster ?? null, thumb: f.poster ?? null,
      caption: episodeVersionLabel(e, 'vr') ? `${title} · V8` : title, duration: f.duration ?? e.duration,
      t: Date.parse(`${e.start}T12:00:00Z`), day: e.start,
    } satisfies Media]
  })
}

export function chapterIndex(items: Media[], episode?: number): number {
  return episode == null ? (items.length ? 0 : -1) : items.findIndex(m => m.episode === episode)
}
