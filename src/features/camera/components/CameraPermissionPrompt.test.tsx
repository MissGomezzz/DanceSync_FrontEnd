import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCameraStore } from '../store/cameraStore'
import type { CameraStatus } from '../types'
import { CameraPermissionPrompt } from './CameraPermissionPrompt'
import { CameraPermissionPromptView } from './CameraPermissionPromptView'

function renderView(status: CameraStatus, errorMessage: string | null = null) {
  const onEnable = vi.fn()
  render(<CameraPermissionPromptView status={status} errorMessage={errorMessage} onEnable={onEnable} />)
  return onEnable
}

describe('CameraPermissionPromptView', () => {
  it('explains why the camera is needed before asking', async () => {
    const onEnable = renderView('prompt')
    expect(screen.getByRole('region', { name: 'Camera permission' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Turn on your camera' })).toBeTruthy()
    expect(screen.getByText(/no audio is sent/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Enable camera' }))
    expect(onEnable).toHaveBeenCalledTimes(1)
  })

  it('points to the browser prompt while waiting, without a button', () => {
    renderView('requesting')
    expect(screen.getByRole('heading', { name: 'Waiting for browser permission...' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('explains how to unblock a denied camera and lets the dancer retry', async () => {
    const onEnable = renderView('denied')
    expect(screen.getByRole('heading', { name: 'Camera access was blocked' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onEnable).toHaveBeenCalledTimes(1)
  })

  it.each<CameraStatus>(['unavailable', 'error'])('shows the error message when the camera is %s', (status) => {
    renderView(status, 'No camera was found.')
    expect(screen.getByRole('heading', { name: 'The camera is not available' })).toBeTruthy()
    expect(screen.getByText('No camera was found.')).toBeTruthy()
  })

  it('falls back to a generic message without one', () => {
    renderView('error')
    expect(screen.getByText('The camera could not be started.')).toBeTruthy()
  })
})

describe('CameraPermissionPrompt', () => {
  beforeEach(() => {
    useCameraStore.setState({ status: 'denied', errorMessage: 'Camera access was blocked.' })
  })

  it('renders the store state and requests the camera on demand', async () => {
    const requestCamera = vi.fn(async () => {})
    useCameraStore.setState({ requestCamera })
    render(<CameraPermissionPrompt />)

    expect(screen.getByRole('heading', { name: 'Camera access was blocked' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(requestCamera).toHaveBeenCalledTimes(1)
  })
})
