/** Where someone without a session is sent to join `roomCode`: the login page with the code filled in. */
export function joinPath(roomCode: string): string {
  return `/?join=${encodeURIComponent(roomCode.toUpperCase())}`
}
