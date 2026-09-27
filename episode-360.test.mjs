import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterIndex, episode360Media } from './src/lib/episode360.ts'

const ep = (n, overrides = {}) => ({ ep: n, title: n === 0 ? 'INTRO' : `Place ${n}`, start: '2025-08-12', end: '2025-08-13', stops: [2], duration: 30, formats: { vr: { src: `vr/v06/e${n}.mp4`, duration: 31 } }, ...overrides })
test('whole-film and direct-episode starts use the same ordered playable chapters', () => {
  const input = [ep(36), ep(2, { formats: { vr: { src: 'pending.mp4', ready: false } } }), ep(10), ep(0), ep(1), ep(3, { formats: {} })]
  const list = episode360Media(input, [])
  assert.deepEqual(list.map(m => m.episode), [0, 1, 10, 36])
  assert.equal(chapterIndex(list), 0)
  assert.equal(chapterIndex(list, 10), 2)
  assert.equal(chapterIndex(list, 2), -1)
  assert.deepEqual(input.map(e => e.ep), [36, 2, 10, 0, 1, 3])
})
test('chapter links are stable and preserve the published VR source and duration', () => {
  const [m] = episode360Media([ep(10)], [{ id: 2, name: 'Olympic', start: '', end: '', lat: 47.8, lon: -123.6 }])
  assert.equal(m.id, 'e10-vr')
  assert.equal(m.src, 'vr/v06/e10.mp4')
  assert.equal(m.duration, 31)
  assert.equal(m.stop, 2)
  assert.equal(m.lat, 47.8)
  assert.equal(m.caption, 'E10 · Place 10')
})
test('intro and unavailable chapters do not produce a wrong starting episode', () => {
  const [intro] = episode360Media([ep(0, { stops: [] })], [])
  assert.equal(intro.caption, 'INTRO')
  assert.equal(intro.stop, null)
  assert.equal(chapterIndex([], 0), -1)
  assert.equal(chapterIndex([]), -1)
  assert.equal(chapterIndex([intro], 36), -1)
})
