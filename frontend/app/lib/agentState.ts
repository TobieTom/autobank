// Shared state for agent process management
let isRunning = false
let startedAt: number | null = null

export function setRunning(running: boolean, time: number | null = null) {
  isRunning = running
  startedAt = time
}

export function getState() {
  return { running: isRunning, startedAt }
}
