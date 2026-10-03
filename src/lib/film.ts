import { shallowRef } from 'vue'
import { playableFormat, epKind, type Episode } from './manifest'

export type FlatFormat = '16x9' | '9x16'
export interface FilmState { episodes: Episode[]; index: number; format: FlatFormat }
export const filmState = shallowRef<FilmState | null>(null)

export function startFilm(episodes: Episode[], format: FlatFormat): void {
  const ordered = episodes.filter(e => epKind(e) !== 'epilogue').sort((a, b) => a.ep - b.ep)
  if (!ordered.length || ordered.some(e => !playableFormat(e, format))) return
  filmState.value = { episodes: ordered, index: 0, format }
}
export function closeFilm(): void { filmState.value = null }
