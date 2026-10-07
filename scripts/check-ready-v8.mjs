import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const data = JSON.parse(readFileSync(resolve(root, 'src/lib/ready-v8.json'), 'utf8'))
function moduleUrl(file, replacements = []) {
  let js = ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  for (const [from, to] of replacements) js = js.replace(from, to)
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
}
const movieUrl = moduleUrl('src/lib/uninterrupted.ts', [
  ["from 'vue'", `from '${pathToFileURL(require.resolve('vue/dist/vue.runtime.esm-bundler.js')).href}'`],
])
const { verifiedMaster, verifiedCollection } = await import(movieUrl)
const readyUrl = moduleUrl('src/lib/readyV8.ts', [
  ["import data from './ready-v8.json';", `const data = ${JSON.stringify(data)};`],
  ["from './uninterrupted'", `from '${movieUrl}'`],
])
const { applyReadyV8Intro, readyMasters, readyCollections, verifiedPending360 } = await import(readyUrl)
const { applyPublishedEpisodeCorrections } = await import(moduleUrl('src/lib/publishedEpisodeCorrections.ts'))
const formats = ['16x9', '9x16', 'vr']

assert.deepEqual(Object.keys(readyMasters).sort(), ['16x9', '9x16'])
assert.equal(readyMasters['16x9'].sha256, 'ff11370781177e8f53f2a4fca9314290e16d47fddefe30541e75f0fb5fecf175')
assert.equal(readyMasters['9x16'].sha256, '7b3c5f7dbd2dbfdc5e7c3563af8596ef54f513022d0ebc315a191900dc80e8ba')
for (const format of ['16x9', '9x16']) {
  assert.equal(readyMasters[format].frames, 323981)
  assert.deepEqual(readyMasters[format].chapters.map(c => c.ep), Array.from({ length: 36 }, (_, i) => i))
  assert.ok(verifiedMaster(readyMasters[format], format))
}

assert.equal(readyCollections.length, 4)
for (let i = 0; i < readyCollections.length; i++) {
  const c = readyCollections[i], expected = data.collections[i]
  for (const format of formats) {
    const movie = c.formats[format]
    assert.ok(movie, `${c.id}/${format} must be available`)
    assert.equal(movie.title, c.title)
    assert.equal(movie.collection, c.id)
    assert.deepEqual(movie.chapters.map(ch => ch.ep), expected.episodes)
    assert.ok(verifiedCollection(movie, format, c.id))
    assert.equal(verifiedMaster(movie, format), null, 'A collection cannot masquerade as the whole film')
    for (const modify of [
      m => { m.chapters[0].ep = 36 },
      m => { m.chapters[1].start_frame++ },
      m => { m.chapters[0].start = NaN },
      m => { delete m.chapters[0].start },
      m => { m.chapters.pop() },
      m => { m.frames++ },
      m => { m.duration++ },
      m => { m.format = format === 'vr' ? '16x9' : 'vr' },
      m => { m.status = 'uploading' },
      m => { m.bytes = 0 },
      m => { m.src = m.src.replace('/v08/', '/v08/../') },
    ]) {
      const invalid = structuredClone(movie); modify(invalid)
      assert.equal(verifiedCollection(invalid, format, c.id), null)
    }
  }
}

const futureVR = { ...structuredClone(data.masters['16x9']), format: 'vr', ...data.pending360 }
assert.ok(verifiedPending360(futureVR), 'Exact current 360 movie becomes available after verified worker publication')
for (const value of [null, {}, { ...futureVR, status: 'uploading' },
  { ...futureVR, src: 'masters/vr-v06/old.mp4', version: 'v06' },
  { ...futureVR, sha256: '0'.repeat(64) }, { ...futureVR, frames: 1 },
  { ...futureVR, src: futureVR.src.replace('fa9303344feb', '094b00000000') },
  { ...futureVR, bytes: 100 }, { ...futureVR, version: 'v09' }]) {
  assert.equal(verifiedPending360(value), null)
}

const intro = structuredClone(data.intro.previous)
const other = { ...structuredClone(intro), ep: 36, kind: 'epilogue' }
const originalOther = structuredClone(other)
applyReadyV8Intro([intro, other])
assert.deepEqual(intro.formats, data.intro.current.formats)
assert.deepEqual(other, originalOther)
assert.equal(intro.version, 'v08')
const once = structuredClone(intro)
applyReadyV8Intro([intro]); assert.deepEqual(intro, once)
for (const modify of [
  e => { e.version = 'v09' },
  e => { e.formats.vr.src = 'vr/v08/newer-intro.mp4' },
  e => { e.formats.vr.version = 'v09' },
  e => { e.formats.vr.ready = false },
  e => { delete e.formats.vr },
]) {
  const value = structuredClone(data.intro.previous); modify(value)
  const before = structuredClone(value)
  applyReadyV8Intro([value]); assert.deepEqual(value, before)
}

if (process.argv[2]) {
  const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const before = structuredClone(manifest)
  applyReadyV8Intro(manifest.episodes)
  applyPublishedEpisodeCorrections(manifest.episodes)
  assert.equal(manifest.episodes.length, 37)
  assert.equal(manifest.episodes.find(e => e.ep === 36).kind, 'epilogue')
  for (const e of manifest.episodes) for (const f of formats) {
    assert.equal(e.formats[f].version, 'v08')
    assert.equal(e.formats[f].ready, true)
  }
  for (const [key, value] of Object.entries(before)) if (key !== 'episodes') assert.deepEqual(manifest[key], value)
  for (const e of manifest.episodes) if (e.ep !== 0 && e.ep !== 2) assert.deepEqual(e, before.episodes.find(b => b.ep === e.ep))
  assert.equal(manifest.episodes.find(e => e.ep === 2).formats['16x9'].sha256, '87aeb21bb0eb191bf47d1f0673ed0ff76121d528183894091a8c4d19ee3600ef')
}
console.log('PASS: V8 intro and E02 release guards; both full flat films; 12 scoped collections; pending 360 identity gate; episode/route preservation.')
