import type { Episode, EpisodeFormatKey } from './manifest'

// These three immutable movies passed remote-identity and public playback checks.
// The larger release worker still owns the manifest and collection pointers.
// Exact source + digest guards make this correction expire when that release lands.
const correctedOpening = {
  "16x9": {
    "previousSrc": "episodes/e02/16x9-v08-b94b7612d9f4.mp4",
    "previousSha256": "b94b7612d9f4f2ad66ac164740140a39b9568ba970211d0fb5c3bd5905d8efc4",
    "src": "episodes/e02/16x9-v08-87aeb21bb0eb.mp4",
    "sha256": "87aeb21bb0eb191bf47d1f0673ed0ff76121d528183894091a8c4d19ee3600ef",
    "captions": "captions/v08/e02-16x9-93a1fb165a3e.vtt"
  },
  "9x16": {
    "previousSrc": "episodes/e02/9x16-v08-0d38f8fd12f5.mp4",
    "previousSha256": "0d38f8fd12f546fc19390c8ef421a793ee461fd4c539184d147189c87bd6c8fa",
    "src": "episodes/e02/9x16-v08-70472e942348.mp4",
    "sha256": "70472e94234804a95028386fda04b928f2805804f0d87e6003a1cad82937d35a",
    "captions": "captions/v08/e02-9x16-93a1fb165a3e.vtt"
  },
  "vr": {
    "previousSrc": "vr/v08/e02-57d8f315b22a.mp4",
    "previousSha256": "57d8f315b22a617bf6fec6ca7d4a4f487597acfef32024c154990000128557c5",
    "src": "vr/v08/e02-5a1775aa6f6b.mp4",
    "sha256": "5a1775aa6f6bc6887fe40015b6bef2c11b3cc1dd18d4055a884b7acf7a2f7644",
    "captions": "captions/v08/e02-vr-93a1fb165a3e.vtt"
  }
} as const
const formats: EpisodeFormatKey[] = ['16x9', '9x16', 'vr']

export function applyPublishedEpisodeCorrections(episodes: Episode[]): void {
  const episode = episodes.find(e => e.ep === 2)
  if (episode?.version !== 'v08' || !formats.every(key => {
    const current = episode.formats[key]
    const corrected = correctedOpening[key]
    return current?.version === 'v08' && current.ready === true
      && current.src === corrected.previousSrc && current.sha256 === corrected.previousSha256
  })) return

  // Apply all three formats together; never overwrite a newer or mixed release.
  for (const key of formats) {
    const corrected = correctedOpening[key]
    episode.formats[key] = {
      ...episode.formats[key]!, src: corrected.src,
      sha256: corrected.sha256, captions: corrected.captions,
    }
  }
  episode.captions = correctedOpening['16x9'].captions
}
