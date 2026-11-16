import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoTile } from './VideoTile'

const fakeStream = () => ({ id: 'stream' }) as unknown as MediaStream

/** The box that holds the video, the placeholder or the overlay (the figure's only child). */
const box = () => screen.getByRole('figure').firstElementChild as HTMLElement

beforeEach(() => {
  // jsdom implements neither play() nor srcObject.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
})

afterEach(() => vi.restoreAllMocks())

describe('VideoTile', () => {
  it('shows the placeholder in a 16:9 box while there is no stream', () => {
    render(<VideoTile stream={null} label="Ana" placeholder="Connecting to Ana's camera..." />)

    expect(screen.getByText("Connecting to Ana's camera...")).toBeTruthy()
    expect(box().className).toContain('aspect-video')
    expect(screen.getByLabelText('Ana camera').className).toContain('hidden')
  })

  it('plays the stream, mirrored only when asked, with the name and the badges over it', () => {
    const stream = fakeStream()
    render(<VideoTile stream={stream} label="Ana" mirrored placeholder="Waiting" badges={<span>dancer</span>} />)

    const video = screen.getByLabelText('Ana camera') as HTMLVideoElement
    expect(video.srcObject).toBe(stream)
    expect(video.className).not.toContain('hidden')
    expect(video.className).toContain('-scale-x-100')
    expect(screen.queryByText('Waiting')).toBeNull()
    expect(within(screen.getByRole('figure')).getByText('dancer')).toBeTruthy()
  })

  it('grows with an overlay instead of forcing it into 16:9, and keeps it clear of the name row', () => {
    render(
      <VideoTile
        stream={fakeStream()}
        label="Ana"
        placeholder="Starting your camera..."
        overlay={<button type="button">Try again</button>}
      />,
    )

    // 16:9 is only the minimum now: a spacer holds it, the box itself may be taller.
    expect(box().className.split(' ')).not.toContain('aspect-video')
    expect(box().className).toContain('grid')
    const spacer = box().querySelector('[aria-hidden]') as HTMLElement
    expect(spacer.className).toContain('aspect-video')
    expect(spacer.className).toContain('self-start')

    // The prompt sits in the flow of the tile with room for the name and the badges under it.
    const overlay = screen.getByTestId('tile-overlay')
    expect(within(overlay).getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(overlay.className).toContain('pb-14')
    expect(overlay.className).not.toContain('absolute')

    // The overlay replaces both the video and the placeholder.
    expect(screen.getByLabelText('Ana camera').className).toContain('hidden')
    expect(screen.queryByText('Starting your camera...')).toBeNull()
  })
})
