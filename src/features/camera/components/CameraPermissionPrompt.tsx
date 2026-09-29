import { useCameraError, useCameraStatus, useCameraStore } from '../store/cameraStore'
import { CameraPermissionPromptView } from './CameraPermissionPromptView'

/**
 * Explains why the camera is needed before the browser prompt appears: the
 * permission request only happens when the dancer presses the button.
 */
export function CameraPermissionPrompt() {
  const status = useCameraStatus()
  const errorMessage = useCameraError()
  const requestCamera = useCameraStore((state) => state.requestCamera)

  return (
    <CameraPermissionPromptView status={status} errorMessage={errorMessage} onEnable={() => void requestCamera()} />
  )
}
