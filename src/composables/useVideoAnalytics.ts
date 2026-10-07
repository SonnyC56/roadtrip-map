import { onBeforeUnmount, watch, type Ref } from 'vue'
import { trackEvent } from '../lib/analytics'
import { attachVideoTelemetry, type PlaybackContext } from '../lib/videoTelemetry'

export function useVideoAnalytics(video: Ref<HTMLVideoElement | null>, context: Ref<PlaybackContext | null>): void {
  let dispose: (() => void) | undefined
  const stop = watch([video, context], ([v, c]) => {
    dispose?.(); dispose = v && c ? attachVideoTelemetry(v, c, trackEvent) : undefined
  }, { flush: 'post', immediate: true })
  onBeforeUnmount(() => { stop(); dispose?.() })
}
