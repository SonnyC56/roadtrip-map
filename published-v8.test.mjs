import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPublishedV8 } from './src/lib/publishedV8.ts'

function movie(format, group = null) {
  const episodes = group === '16-25' ? Array.from({ length: 10 }, (_, i) => i + 16) : Array.from({ length: 36 }, (_, i) => i)
  const prefix = group ? `supercuts/v08/${group}/${format}/` : format === 'vr' ? 'masters/vr-v08/' : format === '9x16' ? 'masters/portrait-v08/' : 'masters/v08/'
  return { version: 'v08', status: 'ready', format, src: prefix + 'corrected-title.mp4', sha256: 'a'.repeat(64), bytes: 6000000,
    duration: episodes.length * 3, frames: episodes.length * 90,
    chapters: episodes.map((ep, i) => ({ ep, title: `E${ep}`, start: i*3, end: (i+1)*3, start_frame: i*90, end_frame: (i+1)*90 })) }
}
const refs = { '16x9': 'masters/v08/index-titlecard.json', '9x16': 'masters/portrait-v08/index-titlecard.json', vr: 'masters/vr-v08/index-titlecard.json' }
const manifest = { edition: 'v08', continuous_films: refs, collections: [{ group: '16-25', format: '16x9', index: 'supercuts/v08/16-25/16x9/index-titlecard.json' }] }
function reader(man = manifest, overrides = {}) {
  return async key => {
    if (key === 'manifest.json') return man
    if (key in overrides) {
      const value = overrides[key]
      if (value instanceof Error) throw value
      return value
    }
    for (const [format, ref] of Object.entries(refs)) if (ref === key) return movie(format)
    if (key === manifest.collections[0].index) return movie('16x9', '16-25')
    throw new Error('Unexpected request: ' + key)
  }
}
test('published corrections replace pinned master links in all three formats and chapter collections', async () => {
  const result = await loadPublishedV8(reader())
  assert.deepEqual(Object.keys(result.masters).sort(), ['16x9', '9x16', 'vr'])
  assert.equal(result.masters.vr.src, 'masters/vr-v08/corrected-title.mp4')
  assert.equal(result.collections['16-25']['16x9'].src, 'supercuts/v08/16-25/16x9/corrected-title.mp4')
})
test('failed or unfinished indexes do not replace a working format and do not block other formats', async () => {
  const result = await loadPublishedV8(reader(manifest, { [refs.vr]: new Error('offline'), [refs['9x16']]: { ...movie('9x16'), status: 'rendering' } }))
  assert.deepEqual(Object.keys(result.masters), ['16x9'])
  assert.ok(result.collections['16-25']['16x9'])
})
test('cross-format, malformed chapter clocks and older editions are rejected', async () => {
  const broken = movie('16x9'); broken.chapters[5].start_frame++
  const result = await loadPublishedV8(reader(manifest, { [refs['16x9']]: broken, [refs['9x16']]: movie('vr'), [refs.vr]: { ...movie('vr'), version: 'v07' } }))
  assert.deepEqual(result.masters, {})
})
test('arbitrary URLs, traversal and ambiguous collection pointers are never fetched', async () => {
  const bad = { edition: 'v08', continuous_films: { '16x9': 'https://elsewhere.test/index.json', '9x16': 'masters/portrait-v08/../index.json' }, collections: [manifest.collections[0], manifest.collections[0]] }
  const calls = []; const result = await loadPublishedV8(async key => { calls.push(key); assert.equal(key, 'manifest.json'); return bad })
  assert.deepEqual(calls, ['manifest.json']); assert.deepEqual(result, { masters: {}, collections: {} })
})
test('missing or old publication leaves every fallback intact', async () => {
  for (const value of [null, {}, { edition: 'v07' }]) assert.deepEqual(await loadPublishedV8(async () => value), { masters: {}, collections: {} })
})
