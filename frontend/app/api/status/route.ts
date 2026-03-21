import { NextResponse } from 'next/server'
import { getState } from '@/app/lib/agentState'

export async function GET() {
  const { running, startedAt } = getState()
  return NextResponse.json({
    running,
    startedAt,
  })
}
