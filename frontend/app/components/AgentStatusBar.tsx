'use client'

import { useEffect, useState } from 'react'

// ── Types ──────────────────────────────────────────────────
type AgentType = 'lender' | 'borrower' | 'arbiter'
type AgentStatus = 'active' | 'idle' | 'processing'

interface AgentState {
  type:          AgentType
  name:          string
  pid:           string
  status:        AgentStatus
  lastAction:    string
  loansHandled:  number
  usdtVolume:    number
  lastTx:        string
  uptime:        number      // seconds
  activity:      number[]   // sparkline heights 0–100
}

// ── Static base config ─────────────────────────────────────
const BASE_AGENTS: AgentState[] = [
  {
    type:         'lender',
    name:         'LenderAgent',
    pid:          '3841',
    status:       'active',
    lastAction:   'Loan approved — 20 USDT at 4.5%',
    loansHandled: 3,
    usdtVolume:   50,
    lastTx:       '0x17a0...3b8f',
    uptime:       0,
    activity:     [30, 60, 45, 80, 70, 90, 55, 85, 100, 70, 90, 75],
  },
  {
    type:         'borrower',
    name:         'BorrowerAgent',
    pid:          '3842',
    status:       'processing',
    lastAction:   'Borrow decision — 20 USDT requested',
    loansHandled: 3,
    usdtVolume:   50,
    lastTx:       '0x6efc...e4cd',
    uptime:       0,
    activity:     [20, 40, 30, 55, 45, 65, 50, 70, 60, 80, 65, 90],
  },
  {
    type:         'arbiter',
    name:         'ArbiterAgent',
    pid:          '3843',
    status:       'active',
    lastAction:   'Self-sustaining loop — 0.25 USDT compute paid',
    loansHandled: 3,
    usdtVolume:   50,
    lastTx:       'compute-1774099373397',
    uptime:       0,
    activity:     [15, 25, 20, 35, 55, 45, 60, 50, 75, 65, 80, 70],
  },
]

// ── Status color helpers ───────────────────────────────────
const STATUS_COLOR: Record<AgentStatus, string> = {
  active:     '#00FF94',
  idle:       '#8888AA',
  processing: '#00D4FF',
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  active:     'ACTIVE',
  idle:       'IDLE',
  processing: 'PROC',
}

const TYPE_ACCENT: Record<AgentType, string> = {
  lender:   '#00D4FF',
  borrower: '#00FF94',
  arbiter:  '#FFB800',
}

// ── Sparkline SVG ──────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 96
  const H = 28
  const barW = Math.floor(W / data.length) - 1

  return (
    <svg width={W} height={H} className="shrink-0">
      {data.map((val, i) => {
        const h = Math.max(2, (val / 100) * H)
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={H - h}
            width={barW}
            height={h}
            rx={1}
            fill={color}
            opacity={0.2 + (i / data.length) * 0.65}
          />
        )
      })}
    </svg>
  )
}

// ── Agent monitor card ─────────────────────────────────────
function AgentMonitor({ agent }: { agent: AgentState }) {
  const accent = TYPE_ACCENT[agent.type]
  const statusColor = STATUS_COLOR[agent.status]

  const hours   = Math.floor(agent.uptime / 3600)
  const minutes = Math.floor((agent.uptime % 3600) / 60)
  const secs    = agent.uptime % 60
  const uptimeStr = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`

  return (
    <div
      className="flex-1 border border-border rounded-lg overflow-hidden bg-[#0A0A14] font-mono text-[11px]"
      style={{ boxShadow: `0 0 0 1px ${accent}14, inset 0 1px 0 ${accent}0a` }}
    >
      {/* Process header bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border"
        style={{ background: `linear-gradient(90deg, ${accent}12, transparent)` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: accent }} className="font-semibold tracking-wider">
            {agent.name}
          </span>
          <span className="text-[#33334d]">PID:{agent.pid}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              animation: agent.status !== 'idle' ? 'pulse 2s ease infinite' : 'none',
            }}
          />
          <span style={{ color: statusColor }} className="text-[10px] tracking-widest">
            {STATUS_LABEL[agent.status]}
          </span>
        </div>
      </div>

      {/* Process stats grid */}
      <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border text-[10px]">
        <div className="flex justify-between">
          <span className="text-[#33334d]">loans</span>
          <span style={{ color: accent }}>{agent.loansHandled}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#33334d]">vol</span>
          <span className="text-text-secondary">{agent.usdtVolume} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#33334d]">up</span>
          <span className="text-text-secondary">{uptimeStr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#33334d]">tx</span>
          <span className="text-text-secondary truncate max-w-[5rem]">{agent.lastTx}</span>
        </div>
      </div>

      {/* Last action */}
      <div className="px-3 py-2 border-b border-border">
        <div className="text-[#33334d] mb-1">last_action</div>
        <div className="text-text-secondary leading-tight truncate">
          {agent.lastAction}
        </div>
      </div>

      {/* Sparkline */}
      <div className="flex items-end justify-between px-3 py-2">
        <div className="text-[#33334d] text-[10px] self-start mt-1">activity</div>
        <Sparkline data={agent.activity} color={accent} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function AgentStatusBar() {
  const [agents, setAgents] = useState<AgentState[]>(
    BASE_AGENTS.map(a => ({ ...a, uptime: Math.floor(Math.random() * 60) + 30 }))
  )

  // Tick uptime and randomize activity bars
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => ({
        ...agent,
        uptime:   agent.uptime + 1,
        activity: [
          ...agent.activity.slice(1),
          Math.floor(30 + Math.random() * 70),
        ],
      })))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
      {/* Sub-header */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-text-secondary mb-2">
          System Processes
        </p>
        <h3 className="font-display text-lg font-semibold text-text-primary">
          Agent Monitor
        </h3>
      </div>

      {/* Three monitors */}
      <div className="flex flex-col md:flex-row gap-4">
        {agents.map(agent => (
          <AgentMonitor key={agent.type} agent={agent} />
        ))}
      </div>
    </div>
  )
}
