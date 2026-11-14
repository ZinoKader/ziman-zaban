import { z } from 'zod'
import { conceptById } from '.'
import { pictureFileSchema } from './schema'
import type { Gloss, LanguageEntry, Localized, Picture, PictureArea, TargetLang } from './types'

const pictureFiles = import.meta.glob('./data/pictures/*.json', { eager: true, import: 'default' })

const parsed = Object.keys(pictureFiles)
  .sort()
  .flatMap((path) => {
    const result = pictureFileSchema.safeParse(pictureFiles[path])
    if (!result.success) {
      console.error(`Invalid content file ${path}`, z.prettifyError(result.error))
      return []
    }
    return [result.data]
  })
  .sort((a, b) => a.area.order - b.area.order)

export const pictureAreas: PictureArea[] = parsed.map((f) => f.area)
export const pictures: Picture[] = parsed.flatMap((f) => f.pictures.map((p) => ({ ...p, area: f.area.id }) as Picture))
export const pictureById = new Map(pictures.map((p) => [p.id, p]))
export const pictureAreaById = new Map(pictureAreas.map((a) => [a.id, a]))

export interface PictureWord {
  gloss: Gloss
  senseNote?: Localized
  entry: LanguageEntry
}

/** The word a picture teaches in one language, taken from the lexicon when the picture points at a concept. */
export function pictureWord(p: Picture, lang: TargetLang): PictureWord | null {
  const source = p.concept ? conceptById.get(p.concept) : p
  const entry = source?.[lang]
  if (!source?.gloss || !entry) return null
  return { gloss: source.gloss, senseNote: source.senseNote, entry }
}

export function picturesFor(lang: TargetLang): Picture[] {
  return pictures.filter((p) => pictureWord(p, lang))
}

export function pictureUrl(p: Picture): string {
  return `${import.meta.env.BASE_URL ?? '/'}pictures/${p.image.file}`
}
