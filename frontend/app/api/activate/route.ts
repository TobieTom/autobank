import { spawn } from 'node:child_process'
import { NextResponse } from 'next/server'
import { join } from 'node:path'
import { setRunning, getState } from '@/app/lib/agentState'

const AGENTS_DIR = join(process.cwd(), '..', 'agents')

export async function POST() {
  try {
    const { running, startedAt } = getState()

    // Prevent multiple simultaneous runs
    if (running) {
      return NextResponse.json(
        { status: 'already_running', startedAt },
        { status: 409 }
      )
    }

    // Mark as running
    const now = Date.now()
    setRunning(true, now)

    // Spawn the agents process
    const child = spawn('npx', ['ts-node', 'src/index.ts'], {
      cwd: AGENTS_DIR,
      detached: false,
      stdio: 'pipe',
      timeout: 70000, // 70 second timeout to handle 60s execution + overhead
    })

    // Log output for debugging
    child.stdout?.on('data', (data) => {
      console.log(`[AGENTS] ${data.toString().trim()}`)
    })

    child.stderr?.on('data', (data) => {
      console.error(`[AGENTS ERROR] ${data.toString().trim()}`)
    })

    // Handle process exit
    child.on('exit', (code) => {
      console.log(`[AGENTS] Process exited with code ${code}`)
      setRunning(false, null)
    })

    // Handle spawn errors
    child.on('error', (err) => {
      console.error(`[AGENTS] Failed to spawn: ${err.message}`)
      setRunning(false, null)
    })

    // Don't wait for the process to complete
    child.unref()

    return NextResponse.json({
      status: 'started',
      startedAt: now,
      pid: child.pid,
    })
  } catch (err) {
    setRunning(false, null)
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[AGENTS] Activation failed: ${message}`)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
