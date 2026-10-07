import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

async function load(file) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
const { allowedAnalytics, analyticsUrl, episodeContent } = await load('../src/lib/analyticsPolicy.ts')
const { attachVideoTelemetry, addRange } = await load('../src/lib/videoTelemetry.ts')

for (const host of ['2025roadtrip.com', 'www.2025roadtrip.com', 'roadtrip-map.vercel.app']) {
  assert.equal(allowedAnalytics(`https://${host}/#e2`, false), true)
  assert.equal(allowedAnalytics(`https://${host}/methodology/`, false), true)
}
for (const url of ['https://www.2025roadtrip.com/review/private', 'http://localhost:8947/', 'https://roadtrip-map-preview.vercel.app/', 'https://www.2025roadtrip.com/?vr=preview', 'https://www.2025roadtrip.com/?analytics_off=1', 'https://www.2025roadtrip.com/private', 'https://www.2025roadtrip.com/privacy/']) {
  assert.equal(allowedAnalytics(url, false), false, url)
}
assert.equal(allowedAnalytics('https://www.2025roadtrip.com/', true), false)
assert.equal(allowedAnalytics('https://www.2025roadtrip.com/', false, '1'), false)
assert.equal(allowedAnalytics('https://www.2025roadtrip.com/', false, null, true), false)
assert.equal(allowedAnalytics('https://www.2025roadtrip.com/', false, null, false, true), false)
assert.equal(analyticsUrl('https://www.2025roadtrip.com/?email=private@example.com&token=secret&utm_source=youtube&utm_campaign=launch-v8#private'), 'https://www.2025roadtrip.com/?utm_source=youtube&utm_campaign=launch-v8')
assert.equal(analyticsUrl('https://www.2025roadtrip.com/?utm_source=private@example.com'), 'https://www.2025roadtrip.com/')
assert.equal(analyticsUrl('https://www.2025roadtrip.com/review/token'), null)
assert.equal(episodeContent(2, 'vr', 'v08'), 'E02:v08:360')

const ranges = []
assert.equal(addRange(ranges, 0, 10), 10)
assert.equal(addRange(ranges, 5, 12), 12)
assert.equal(addRange(ranges, 20, 30), 22)
assert.equal(addRange(ranges, 12, 20), 30)
assert.deepEqual(ranges, [[0, 30]])

function fixture(headset = false) {
  let now = 0
  const video = Object.assign(new EventTarget(), { currentTime: 0, duration: 100, playbackRate: 1, readyState: 4, paused: true, seeking: false, error: null })
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const win = new EventTarget()
  const events = []
  const dispose = attachVideoTelemetry(video, { content: 'E02:v08:16x9', mode: headset ? 'headset' : 'episode', headset }, (name, data) => events.push({ name, ...data }), () => now, doc, win)
  const fire = (type, target = video) => target.dispatchEvent(new Event(type))
  const advance = (seconds = 1, mediaSeconds = seconds) => { now += seconds * 1000; video.currentTime += mediaSeconds; fire('timeupdate') }
  const play = () => { video.paused = false; fire('play'); fire('playing') }
  const pause = () => { video.paused = true; fire('pause') }
  const seek = (to) => { video.seeking = true; fire('seeking'); video.currentTime = to; video.seeking = false; fire('seeked') }
  const sum = name => events.filter(e => e.name === name).reduce((n, e) => n + (e.seconds || 0), 0)
  return { video, doc, win, events, dispose, fire, advance, play, pause, seek, sum }
}

{
  const f = fixture()
  assert.equal(f.events.filter(e => e.name === 'video_start').length, 0, 'opening is not watching')
  f.play(); f.fire('playing')
  for (let i = 0; i < 30; i++) f.advance()
  f.pause(); f.pause(); f.dispose(); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 30)
  assert.equal(f.events.filter(e => e.name === 'video_start').length, 1)
  assert.equal(f.events.filter(e => e.name === 'player_exit').length, 1)
  assert.deepEqual(f.events.filter(e => e.name === 'video_progress').map(e => e.percent), [25])
  f.play(); f.advance()
  assert.equal(f.sum('video_watch_seconds'), 30, 'disposed listeners removed')
}
{
  const f = fixture(); f.play()
  for (let i = 0; i < 10; i++) f.advance()
  f.seek(90)
  for (let i = 0; i < 10; i++) f.advance()
  f.fire('ended'); f.fire('ended'); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 20, 'skip is not watch time')
  assert.equal(f.events.filter(e => e.name === 'video_progress').length, 0, 'seeking to end is not completion coverage')
  assert.equal(f.events.filter(e => e.name === 'video_end').length, 1)
  assert.equal(f.events.find(e => e.name === 'player_exit').percent, 20)
}
{
  const f = fixture(); f.play()
  for (let i = 0; i < 20; i++) f.advance()
  f.seek(0)
  for (let i = 0; i < 20; i++) f.advance()
  f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 40)
  assert.equal(f.events.find(e => e.name === 'player_exit').percent, 20, 'replay counted once for coverage')
}
{
  const f = fixture(); f.play(); f.advance(1)
  f.fire('waiting'); f.advance(3, 0); f.fire('playing'); f.advance(1)
  f.doc.visibilityState = 'hidden'; f.fire('visibilitychange', f.doc); f.advance(3)
  f.doc.visibilityState = 'visible'; f.fire('visibilitychange', f.doc); f.advance(1)
  f.pause(); f.advance(3, 0); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 3)
  assert.equal(f.sum('video_buffer_seconds'), 3)
}
{
  const f = fixture(true); f.doc.visibilityState = 'hidden'; f.play(); f.advance(2); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 2, 'headset session remains visible while desktop document is hidden')
}
{
  const f = fixture(); f.play()
  for (let i = 0; i < 65; i++) f.advance()
  assert.equal(f.sum('video_watch_seconds'), 60, 'one heartbeat per minute of actual playback')
  f.fire('pagehide', f.win); f.fire('pagehide', f.win); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 65, 'last partial minute flushed without double counting')
}
{
  const f = fixture(); f.play(); f.advance(30, 30); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 0, 'suspended clock does not manufacture watch time')
}
{
  const f = fixture(); f.play(); f.video.playbackRate = 2; f.fire('ratechange'); f.advance(1, 2); f.dispose()
  assert.equal(f.sum('video_watch_seconds'), 1, 'watch time is wall time at double speed')
}
{
  const f = fixture(); f.video.error = { code: 3, message: 'private URL must never be sent' }; f.fire('error'); f.fire('error'); f.dispose()
  assert.deepEqual(f.events.filter(e => e.name === 'video_error'), [{ name: 'video_error', content: 'E02:v08:16x9', reason: 'decode' }])
  assert.ok(f.events.every(e => Object.keys(e).length <= 3), 'no more than two custom properties')
}
console.log('Analytics checks passed: privacy, opt-out, coverage, replay, seeking, buffering, hidden tabs, headset, lifecycle, errors, event budget.')
