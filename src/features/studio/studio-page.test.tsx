import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { setAudioManifest } from '@/lib/audio'
import { useSettings } from '@/store/settings'
import { promptsFor, promptTotal } from './prompts'
import { useStudio } from './store'
import { StudioPage } from './studio-page'

beforeEach(() => {
  useSettings.setState({ baseLang: 'en' })
  useStudio.setState({ speaker: '', lang: null, consentAt: null, group: 'words', takes: {} })
  setAudioManifest(null)
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudioPage />
    </MemoryRouter>,
  )

describe('StudioPage', () => {
  it('asks for language, name and consent before recording', () => {
    renderPage()
    const go = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(screen.getByRole('radio', { name: /Sorani/ }))
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Aras' } })
    expect(go).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(go)
    expect(useStudio.getState()).toMatchObject({ speaker: 'Aras', lang: 'ckb', consentAt: expect.any(String) })
    expect(screen.getByText(/Recording Sorani Kurdish as Aras/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled()
  })

  it('runs the microphone check before the first recording', () => {
    useStudio.setState({ speaker: 'Aras', lang: 'ckb', consentAt: '2026-11-08T10:00:00.000Z' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    expect(screen.getByRole('dialog', { name: 'Microphone check' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start the test/ })).toBeInTheDocument()
  })

  it('counts only texts without a native recording, here or in the app', () => {
    const [first, second] = promptsFor('ckb', 'words')
    useStudio.setState({
      speaker: 'Aras',
      lang: 'ckb',
      consentAt: '2026-11-08T10:00:00.000Z',
      takes: { [`ckb:${first.text}`]: { lang: 'ckb', text: first.text, latin: first.latin, kind: 'word', recordedAt: '2026-11-08T10:00:00.000Z', durationMs: 900, peakDb: -6 } },
    })
    setAudioManifest({ ckb: { [second.text]: { f: 'ckb/rec-x.mp3', v: 'ckb-rec-aras', h: 1 } }, fa: {}, voices: {} })
    renderPage()
    const total = promptTotal('ckb', 'words')
    expect(screen.getByText(`${total - 2} of ${total} still need a voice`)).toBeInTheDocument()
    expect(screen.getByText('1 recording on this device')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download 1 recording' })).toBeEnabled()
  })
})
