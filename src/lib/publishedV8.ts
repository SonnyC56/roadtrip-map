import { verifiedCollection, verifiedMaster, type CollectionId, type Master, type MasterFormat } from './uninterrupted.ts'

const formats: MasterFormat[] = ['16x9', '9x16', 'vr']
const groups: CollectionId[] = ['01-08-With-Intro', '09-15', '16-25', '26-35']
type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)

export interface PublishedV8 {
  masters: Partial<Record<MasterFormat, Master>>
  collections: Partial<Record<CollectionId, Partial<Record<MasterFormat, Master>>>>
}

function indexKey(value: unknown, prefix: string): value is string {
  return typeof value === 'string' && value.startsWith(prefix) && /^[A-Za-z0-9_./-]+\.json$/.test(value)
    && !value.includes('..') && !value.includes('//')
}

/** Follow only indexes selected by the published manifest; keep existing playback on any failed read. */
export async function loadPublishedV8(getJson: (key: string) => Promise<unknown>): Promise<PublishedV8> {
  const result: PublishedV8 = { masters: {}, collections: {} }
  const manifest = await getJson('manifest.json')
  if (!record(manifest) || manifest.edition !== 'v08') return result
  const continuous = record(manifest.continuous_films) ? manifest.continuous_films : {}
  const collections = Array.isArray(manifest.collections) ? manifest.collections.filter(record) : []
  const jobs: Promise<void>[] = []

  for (const format of formats) {
    const prefix = format === 'vr' ? 'masters/vr-v08/' : format === '9x16' ? 'masters/portrait-v08/' : 'masters/v08/'
    const key = continuous[format]
    if (indexKey(key, prefix)) jobs.push((async () => {
      try {
        const movie = verifiedMaster(await getJson(key), format)
        if (movie?.version === 'v08') result.masters[format] = movie
      } catch { /* Keep this format's previously verified movie. */ }
    })())
    for (const group of groups) {
      const entries = collections.filter(row => row.group === group && row.format === format)
      if (entries.length !== 1) continue
      const collectionKey = entries[0]!.index
      if (!indexKey(collectionKey, `supercuts/v08/${group}/${format}/`)) continue
      jobs.push((async () => {
        try {
          const movie = verifiedCollection(await getJson(collectionKey), format, group)
          if (movie) (result.collections[group] ??= {})[format] = movie
        } catch { /* An unavailable collection never disables the saved fallback. */ }
      })())
    }
  }
  await Promise.all(jobs)
  return result
}
