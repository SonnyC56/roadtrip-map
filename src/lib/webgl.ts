// photo-sphere-viewer 5 needs WebGL 2. Checked once, before the (large) viewer chunk is loaded.
// Chrome with hardware acceleration off / a crashed GPU process has no WebGL here.
let cached: boolean | null = null

export function hasWebGL2(): boolean {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    cached = !!gl
    ;(gl as WebGL2RenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

/** Call when the viewer failed to start, so the rest of the session goes straight to the flat view. */
export function markWebGLUnavailable(): void {
  cached = false
}
