import data from './ready-v8.json'
import type { Episode, EpisodeFormatKey } from './manifest'
import { verifiedCollection, verifiedMaster, type CollectionId, type Master, type MasterFormat } from './uninterrupted'

// Release snapshot backed by remote identity, HTTP range, CORS, and caption checks.
// Keep completed V8 playback independent of the worker's final all-format publication.
const formats: EpisodeFormatKey[] = ['16x9', '9x16', 'vr']

export function applyReadyV8Intro(episodes: Episode[]): void {
  const intro = episodes.find(e => e.ep === 0)
  const previous = data.intro.previous as Episode
  const current = data.intro.current as Episode
  if (!intro || intro.version !== previous.version || !formats.every(key => {
    const actual = intro.formats[key], old = previous.formats[key]
    return actual && old && actual.ready !== false && actual.version === old.version
      && actual.src === old.src && actual.sha256 === old.sha256
  })) return
  intro.formats = { ...intro.formats, ...structuredClone(current.formats) }
  intro.version = current.version
  intro.duration = current.duration
  intro.captions = current.captions
  intro.ready = current.ready
}

export const readyMasters: Partial<Record<MasterFormat, Master>> = {}
for (const format of ['16x9', '9x16'] as const) {
  const master = verifiedMaster(data.masters[format], format)
  if (master) readyMasters[format] = master
}

export const readyCollections = data.collections.map(collection => ({
  id: collection.id,
  title: collection.title,
  formats: Object.fromEntries(formats.map(format => {
    const movie = verifiedCollection(collection.formats[format], format, collection.id as CollectionId)
    return [format, movie ? { ...movie, title: collection.title } : null]
  })) as Record<MasterFormat, Master | null>,
}))

/** The native worker may publish older intermediates first. Only its final, corrected VR film qualifies. */
export function verifiedPending360(value: unknown): Master | null {
  const master = verifiedMaster(value, 'vr')
  const expected = data.pending360
  return master && master.src === expected.src && master.sha256 === expected.sha256
    && master.bytes === expected.bytes && master.frames === expected.frames
    && Math.abs(master.duration - expected.duration) < .00001 ? master : null
}
