import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'src/lib/publishedEpisodeCorrections.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { applyPublishedEpisodeCorrections } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const formats = ['16x9', '9x16', 'vr']
const oldHashes = ['b94b7612d9f4f2ad66ac164740140a39b9568ba970211d0fb5c3bd5905d8efc4', '0d38f8fd12f546fc19390c8ef421a793ee461fd4c539184d147189c87bd6c8fa', '57d8f315b22a617bf6fec6ca7d4a4f487597acfef32024c154990000128557c5']
const newHashes = ['87aeb21bb0eb191bf47d1f0673ed0ff76121d528183894091a8c4d19ee3600ef', '70472e94234804a95028386fda04b928f2805804f0d87e6003a1cad82937d35a', '5a1775aa6f6bc6887fe40015b6bef2c11b3cc1dd18d4055a884b7acf7a2f7644']
const key = (format, hash) => format === 'vr' ? `vr/v08/e02-${hash.slice(0, 12)}.mp4` : `episodes/e02/${format}-v08-${hash.slice(0, 12)}.mp4`
const before = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : {
  ep: 2, version: 'v08', kind: 'episode', title: 'CHICAGO > MT RUSHMORE', start: '2025-08-14', end: '2025-08-16', stops: [2], duration: 8198 / 30,
  captions: 'captions/v08/e02-16x9-2438da32989d.vtt', ready: true,
  formats: Object.fromEntries(formats.map((format, i) => [format, {
    src: key(format, oldHashes[i]), sha256: oldHashes[i], captions: `captions/v08/e02-${format}-2438da32989d.vtt`,
    ready: true, version: 'v08', duration: 8198 / 30, frames: 8198, poster: 'existing-poster.jpg',
  }])),
}
const episodes = [{ ...structuredClone(before), ep: 1 }, structuredClone(before), { ...structuredClone(before), ep: 36, kind: 'epilogue' }]
const untouched = [structuredClone(episodes[0]), structuredClone(episodes[2])]
applyPublishedEpisodeCorrections(episodes)
assert.deepEqual([episodes[0], episodes[2]], untouched)
for (let i = 0; i < formats.length; i++) {
  const format = formats[i], actual = episodes[1].formats[format], expected = before.formats[format]
  assert.equal(actual.src, key(format, newHashes[i]))
  assert.equal(actual.sha256, newHashes[i])
  assert.equal(actual.captions, `captions/v08/e02-${format}-93a1fb165a3e.vtt`)
  for (const field of Object.keys(expected).filter(k => !['src', 'sha256', 'captions'].includes(k))) assert.deepEqual(actual[field], expected[field])
}
for (const field of Object.keys(before).filter(k => !['formats', 'captions'].includes(k))) assert.deepEqual(episodes[1][field], before[field])
const corrected = structuredClone(episodes)
applyPublishedEpisodeCorrections(episodes)
assert.deepEqual(episodes, corrected)

let guards = 0
for (const modify of [
  e => { e.version = 'v09' },
  e => { e.formats['vr'].version = 'v09' },
  e => { e.formats['16x9'].src = 'episodes/e02/future-v08.mp4' },
  e => { e.formats['9x16'].sha256 = 'a'.repeat(64) },
  e => { delete e.formats.vr },
  e => { e.formats.vr.ready = false },
  e => { e.ep = 3 },
]) {
  const e = structuredClone(before); modify(e); const expected = structuredClone(e)
  applyPublishedEpisodeCorrections([e]); assert.deepEqual(e, expected); guards++
}
applyPublishedEpisodeCorrections([])
console.log(`PASS: all three verified formats, matching captions, untouched other episodes/metadata, idempotent release handoff, ${guards} future/mixed/unready guards`)
