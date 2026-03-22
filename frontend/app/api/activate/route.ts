import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const agentsUrl = process.env.AGENTS_URL || 'http://localhost:3001'

    if (!process.env.AGENTS_URL) {
      console.warn('[ACTIVATE] AGENTS_URL not set, trying localhost:3001')
    }

    const response = await fetch(`${agentsUrl}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 409) {
        return NextResponse.json(
          { status: 'already_active' },
          { status: 409 }
        )
      }
      throw new Error(`Agents returned ${response.status}: ${JSON.stringify(data)}`)
    }

    console.log('[ACTIVATE] Agents activated successfully')
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ACTIVATE] Failed: ${message}`)
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
