export interface PlaybackContext { content: string; mode: string; headset?: boolean }
export type EventSink = (name: string, properties: Record<string, string | number | boolean>) => void

/** Union intervals, so replaying or seeking past a scene does not inflate coverage. */
export function addRange(ranges: [number, number][], from: number, to: number): number {
  if (!(to > from)) return ranges.reduce((sum, [a, b]) => sum + b - a, 0)
  ranges.push([from, to]); ranges.sort((a, b) => a[0] - b[0])
  const joined: [number, number][] = []
  for (const r of ranges) {
    const previous = joined[joined.length - 1]
    if (previous && r[0] <= previous[1] + .05) previous[1] = Math.max(previous[1], r[1])
    else joined.push([...r])
  }
  ranges.splice(0, ranges.length, ...joined)
  return ranges.reduce((sum, [a, b]) => sum + b - a, 0)
}

/** One attachment per active source; detached/preloaded headset videos are not counted. */
export function attachVideoTelemetry(video: HTMLVideoElement, context: PlaybackContext, send: EventSink,
  clock: () => number = () => performance.now(), doc: Document = document, win: Window = window): () => void {
  let disposed = false, started = false, running = false, finished = false, errorSent = false
  let wall = clock(), position = video.currentTime || 0, watched = 0, reported = 0, coverage = 0
  let buffering: number | null = null, bufferSeconds = 0, playRequested: number | null = null
  const ranges: [number, number][] = []
  const milestones = new Set<number>()
  const removers: (() => void)[] = []
  const data = { content: context.content, mode: context.mode }
  const visible = () => !!context.headset || doc.visibilityState !== 'hidden'
  const emit = (name: string, extra: Record<string, string | number | boolean> = {}) => {
    if (!disposed) send(name, { content: context.content, ...extra })
  }
  const reset = () => { wall = clock(); position = video.currentTime || 0 }
  const flush = () => {
    const seconds = Math.floor(watched - reported)
    if (seconds > 0) { emit('video_watch_seconds', { seconds }); reported += seconds }
    if (bufferSeconds >= .5) { emit('video_buffer_seconds', { seconds: Math.round(bufferSeconds * 10) / 10 }); bufferSeconds = 0 }
  }
  const settleBuffer = () => {
    if (buffering != null) { bufferSeconds += Math.max(0, (clock() - buffering) / 1000); buffering = null }
  }
  const sample = () => {
    const now = clock(), t = video.currentTime || 0, dt = (now - wall) / 1000, delta = t - position
    // Exclude seeks, buffering, hidden tabs, and suspended clocks. Measure actual playing time.
    if (running && visible() && dt > 0 && dt <= 5 && delta > 0 && delta <= dt * video.playbackRate + .75) {
      watched += Math.min(dt, delta / Math.max(.1, video.playbackRate))
      coverage = addRange(ranges, Math.max(0, position), Number.isFinite(video.duration) ? Math.min(t, video.duration) : t)
      if (video.duration > 0 && Number.isFinite(video.duration)) {
        for (const percent of [25, 50, 75, 90]) {
          if (!milestones.has(percent) && coverage / video.duration * 100 >= percent) {
            milestones.add(percent); emit('video_progress', { percent })
          }
        }
      }
      if (watched - reported >= 60) flush()
    }
    wall = now; position = t
  }
  const playing = () => {
    settleBuffer()
    if (!started) {
      started = true; send('video_start', data)
      if (playRequested != null) emit('video_start_delay_ms', { milliseconds: Math.round(clock() - playRequested) })
    }
    running = true; reset()
  }
  const listen = (target: EventTarget, type: string, handler: EventListener) => {
    target.addEventListener(type, handler); removers.push(() => target.removeEventListener(type, handler))
  }
  send('player_open', data)
  listen(video, 'play', () => { if (!started && playRequested == null) playRequested = clock() })
  listen(video, 'playing', playing)
  listen(video, 'timeupdate', sample)
  listen(video, 'pause', () => { sample(); running = false; settleBuffer(); flush() })
  listen(video, 'waiting', () => {
    sample(); running = false
    if (started && !video.paused && !video.seeking && visible() && buffering == null) buffering = clock()
  })
  listen(video, 'seeking', () => { running = false; settleBuffer(); reset() })
  listen(video, 'seeked', () => { running = !video.paused && video.readyState >= 2; reset() })
  listen(video, 'ratechange', reset)
  listen(video, 'ended', () => {
    sample(); running = false; settleBuffer(); flush()
    if (!finished) { finished = true; send('video_end', data) }
  })
  const error = () => {
    sample(); running = false; settleBuffer(); flush()
    if (!errorSent && video.error) {
      errorSent = true
      emit('video_error', { reason: ['unknown', 'aborted', 'network', 'decode', 'unsupported'][video.error.code] || 'unknown' })
    }
  }
  listen(video, 'error', error)
  listen(doc, 'visibilitychange', () => {
    if (visible()) { running = started && !video.paused && video.readyState >= 2; reset() }
    else { sample(); running = false; settleBuffer(); flush() }
  })
  listen(win, 'pagehide', () => { sample(); running = false; settleBuffer(); flush() })
  listen(win, 'pageshow', () => { running = started && !video.paused && video.readyState >= 2; reset() })
  if (video.error && video.currentSrc === video.src) error()
  else if (!video.paused && video.readyState >= 2) playing()
  return () => {
    if (disposed) return
    sample(); settleBuffer(); flush()
    emit('player_exit', { percent: video.duration > 0 && Number.isFinite(video.duration) ? Math.min(100, Math.round(coverage / video.duration * 100)) : 0 })
    disposed = true; removers.forEach(remove => remove())
  }
}
