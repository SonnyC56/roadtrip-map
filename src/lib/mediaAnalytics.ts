import { episodeContent, mediaContent } from './analyticsPolicy'
import type { Media, Episode } from './manifest'
import type { PlaybackContext } from './videoTelemetry'

export function mediaContext(item: Media, episodes: Episode[], continuous = false, singleFile = false): PlaybackContext {
  if (singleFile) return { content: `film:${item.id.replace(/-(v\d+)$/, ':$1')}:360`, mode: 'single-file' }
  const episode = episodes.find(e => e.ep === item.episode)
  // Only generated episode media IDs represent episodes; source clips can have an episode field too.
  if (episode && /^e\d+-vr$/.test(item.id)) {
    return { content: episodeContent(episode.ep, '360', episode.formats.vr?.version), mode: continuous ? 'film-queue' : 'episode' }
  }
  return { content: mediaContent(item), mode: 'gallery' }
}
