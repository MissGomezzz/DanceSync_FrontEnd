import { Button } from '../../../shared/ui/atoms/Button'
import type { CameraStatus } from '../types'

interface CameraPermissionPromptViewProps {
  status: CameraStatus
  errorMessage: string | null
  onEnable: () => void
}

export function CameraPermissionPromptView({ status, errorMessage, onEnable }: CameraPermissionPromptViewProps) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Camera permission"
      className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center"
    >
      <PromptContent status={status} errorMessage={errorMessage} onEnable={onEnable} />
    </div>
  )
}

function PromptContent({ status, errorMessage, onEnable }: CameraPermissionPromptViewProps) {
  switch (status) {
    case 'requesting':
      return (
        <>
          <h2 className="text-base font-semibold text-slate-100">Waiting for browser permission...</h2>
          <p className="text-sm text-slate-400">Look for the prompt near the address bar.</p>
        </>
      )
    case 'denied':
      return (
        <>
          <h2 className="text-base font-semibold text-slate-100">Camera access was blocked</h2>
          <p className="text-sm text-slate-400">
            To dance in this battle, click the camera or lock icon next to the address bar, allow the camera for
            this site, and then try again.
          </p>
          <Button onClick={onEnable}>Try again</Button>
        </>
      )
    case 'unavailable':
    case 'error':
      return (
        <>
          <h2 className="text-base font-semibold text-slate-100">The camera is not available</h2>
          <p className="text-sm text-slate-400">{errorMessage ?? 'The camera could not be started.'}</p>
          <Button onClick={onEnable}>Try again</Button>
        </>
      )
    default:
      return (
        <>
          <h2 className="text-base font-semibold text-slate-100">Turn on your camera</h2>
          <p className="text-sm text-slate-400">
            You are one of the two dancers in this battle. Your opponent and the spectators will watch your camera
            live.
          </p>
          <p className="text-sm text-slate-400">
            After you continue, your browser will ask for permission to use the camera. Only video is shared; no
            audio is sent.
          </p>
          <Button onClick={onEnable}>Enable camera</Button>
        </>
      )
  }
}
