import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { pictureAreas, pictureById, pictures, picturesFor, pictureWord } from '@/content/pictures'
import { TARGET_LANGS, type TargetLang } from '@/content/types'
import { moduleItems } from '@/lib/curriculum'
import { seededRandom } from '@/lib/distractors'
import { foldForMatch } from '@/lib/script/normalize'
import { cardKey, Rating } from '@/lib/srs'
import type { Candidate } from '@/lib/curriculum'
import { useSettings } from '@/store/settings'
import { ModulePage } from '@/features/module/module-page'
import { pictureOptions } from './options'
import { PicturesExercise } from './pictures-exercise'

const imageFiles = new Set(Object.keys(import.meta.glob('/public/pictures/*')).map((path) => path.split('/').pop()))

describe('picture content', () => {
  it('has an image on disk for every picture, and unique ids', () => {
    expect(new Set(pictures.map((p) => p.id)).size).toBe(pictures.length)
    for (const p of pictures) expect(imageFiles.has(p.image.file), p.image.file).toBe(true)
  })

  it('teaches a word in at least one language for every picture, and four or more per area and language', () => {
    for (const p of pictures) expect(TARGET_LANGS.some((l) => pictureWord(p, l)), p.id).toBe(true)
    for (const lang of TARGET_LANGS) {
      for (const area of pictureAreas) {
        expect(picturesFor(lang).filter((p) => p.area === area.id).length, `${lang}:${area.id}`).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('takes the word from the lexicon when a picture points at a concept', () => {
    const tea = pictureById.get('tea')!
    expect(tea.concept).toBeDefined()
    expect(pictureWord(tea, 'fa')?.gloss.en).toBe('tea')
  })
})

describe('pictureOptions', () => {
  it('gives the answer and three wrong pictures from the same area, all written differently', () => {
    for (const lang of TARGET_LANGS) {
      for (const target of picturesFor(lang)) {
        const options = pictureOptions(target, lang, 3, seededRandom(target.id))
        expect(options).toHaveLength(4)
        expect(options).toContain(target)
        const scripts = options.map((o) => foldForMatch(pictureWord(o, lang)!.entry.primary.script, lang))
        expect(new Set(scripts).size).toBe(4)
        const sameArea = picturesFor(lang).filter((p) => p.area === target.area).length
        if (sameArea >= 4) expect(options.every((o) => o.area === target.area), `${lang}:${target.id}`).toBe(true)
      }
    }
  })

  it('is stable for a seed', () => {
    const target = pictureById.get('ghormeh-sabzi')!
    const ids = () => pictureOptions(target, 'fa', 3, seededRandom('x')).map((p) => p.id)
    expect(ids()).toEqual(ids())
  })
})

describe('pictures in the curriculum', () => {
  it('opens every picture from the start, ordered by area', () => {
    const items = moduleItems('pictures', 'fa', {})
    expect(items).toHaveLength(picturesFor('fa').length)
    expect(items.every((it) => it.unlock.unlocked)).toBe(true)
    const areaOrder = items.map((it) => pictureAreas.findIndex((a) => a.id === it.unit))
    expect(areaOrder).toEqual([...areaOrder].sort((a, b) => a - b))
  })
})

function setup(lang: TargetLang, id: string, isNew: boolean) {
  const onDone = vi.fn()
  const item: Candidate = { key: cardKey(lang, 'pictures', id), itemId: id, isNew, order: 0 }
  render(
    <MemoryRouter>
      <TooltipProvider>
        <PicturesExercise item={item} lang={lang} attempt={0} onDone={onDone} />
      </TooltipProvider>
    </MemoryRouter>,
  )
  return onDone
}

const option = (latin: string) => [...screen.getByRole('group').querySelectorAll('button')].find((b) => b.textContent?.endsWith(latin))!

describe('PicturesExercise', () => {
  it('introduces a new picture with its word, then asks what you see', () => {
    useSettings.setState({ baseLang: 'en' })
    const word = pictureWord(pictureById.get('ghormeh-sabzi')!, 'fa')!
    const onDone = setup('fa', 'ghormeh-sabzi', true)
    expect(screen.getByText('New word')).toBeInTheDocument()
    expect(screen.getByText(word.gloss.en)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: word.gloss.en })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))
    expect(screen.getAllByText('What do you see?').length).toBeGreaterThan(0)
    expect(screen.getByRole('group', { name: 'What do you see?' }).querySelectorAll('button')).toHaveLength(4)
    fireEvent.click(option(word.entry.primary.latin))
    expect(screen.getByText('Correct!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pictures-mc' }))
    expect(onDone.mock.calls[0][0].grade).not.toBe(Rating.Easy)
  })

  it('says what the wrong pick means, in Swedish', () => {
    useSettings.setState({ baseLang: 'sv' })
    const onDone = setup('ckb', 'kebab', false)
    expect(screen.getAllByText('Vad ser du?').length).toBeGreaterThan(0)
    const wrong = [...screen.getByRole('group').querySelectorAll('button')].find(
      (b) => !b.textContent?.includes(pictureWord(pictureById.get('kebab')!, 'ckb')!.entry.primary.latin),
    )!
    fireEvent.click(wrong)
    expect(screen.getByText(/^Ordet du valde betyder/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fortsätt' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ grade: Rating.Again }))
  })
})

describe('Picture recognition module page', () => {
  it('lists the areas to practise', () => {
    useSettings.setState({ baseLang: 'sv', targetLang: 'fa', onboarded: true })
    render(
      <MemoryRouter initialEntries={['/learn/pictures']}>
        <Routes>
          <Route path="/learn/:module" element={<ModulePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Bildigenkänning' })).toBeInTheDocument()
    expect(screen.getByText('Öva per område')).toBeInTheDocument()
    for (const a of pictureAreas) expect(screen.getByText(a.title.sv)).toBeInTheDocument()
  })
})
