'use client'

import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// ── Types ──────────────────────────────────────────────────
type LogLevel = 'INFO' | 'SUCCESS' | 'AGENT' | 'TX' | 'WARN' | 'ERROR'
type ActivateState = 'idle' | 'running' | 'complete'

interface LogData {
  txHash?: string
  hash?: string
  [key: string]: unknown
}

interface LogEntry {
  id:        number
  timestamp: string
  level:     LogLevel
  module:    string
  message:   string
  data?:     LogData
}

// ── Level mapping (server sends lowercase) ─────────────────
function toLevel(raw: string): LogLevel {
  const map: Record<string, LogLevel> = {
    info:    'INFO',
    success: 'SUCCESS',
    agent:   'AGENT',
    tx:      'TX',
    warn:    'WARN',
    error:   'ERROR',
  }
  return map[raw.toLowerCase()] ?? 'INFO'
}

// ── Simulated log pool — kept as seed data ─────────────────
const LOG_POOL: Omit<LogEntry, 'id' | 'timestamp'>[] = [
  { level: 'INFO',    module: 'ArbiterAgent',     message: 'Monitor loop starting — block 10491047, 3 active loans' },
  { level: 'AGENT',   module: 'BorrowerAgent',    message: 'Borrow decision made — amount: 10 USDT, duration: 200 blocks' },
  { level: 'AGENT',   module: 'ReputationEngine', message: 'Loan request recorded — loansRequested: 7, score: 75.36' },
  { level: 'AGENT',   module: 'LenderAgent',      message: 'Evaluating loan request — borrower: 0xA9dD...587a4, amount: 10 USDT' },
  { level: 'SUCCESS', module: 'LenderAgent',      message: 'Loan approved — 10 USDT at 4% interest | score: 77.86, reasoning: strong repayment history' },
  { level: 'TX',      module: 'WalletManager',    message: 'USDT transfer submitted | txHash: 0x5ffb6a258496f4f1fb217886d64c46470448...' },
  { level: 'TX',      module: 'WalletManager',    message: 'USDT transfer confirmed | txHash: 0x5ffb6a258496f4f1fb217886d64c46470448...' },
  { level: 'TX',      module: 'LenderAgent',      message: 'Loan issued successfully | loanId: 1774099347619 → 0xA9dD...587a4 | dueBlock: 10491249' },
  { level: 'SUCCESS', module: 'ArbiterAgent',     message: 'Protocol fee collected — 0.05 USDT | totalFeesCollected: 0.05' },
  { level: 'AGENT',   module: 'ReputationEngine', message: 'Repayment recorded — agentId: borrower-001, amount: 10 USDT, score: 79.17' },
]

// ── Level styling maps ─────────────────────────────────────
const LEVEL_COLOR: Record<LogLevel, string> = {
  INFO:    '#8888AA',
  SUCCESS: '#00FF94',
  AGENT:   '#00D4FF',
  TX:      '#FFB800',
  WARN:    '#FFB800',
  ERROR:   '#FF4560',
}

const LEVEL_BG: Record<LogLevel, string> = {
  INFO:    'transparent',
  SUCCESS: 'rgba(0,255,148,0.06)',
  AGENT:   'rgba(0,212,255,0.06)',
  TX:      'rgba(255,184,0,0.1)',
  WARN:    'rgba(255,184,0,0.08)',
  ERROR:   'rgba(255,69,96,0.1)',
}

// ── Helpers ────────────────────────────────────────────────
// Render message with clickable TX hash links
function renderMessageWithLinks(message: string) {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match

  // Regex matches: 0x followed by 6+ hex chars, optionally followed by ...
  const regex = /0x[a-fA-F0-9]{6,}(\.\.\.)?/g
  while ((match = regex.exec(message)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(message.substring(lastIndex, match.index))
    }
    // Extract the full matched text (including ... if present)
    const displayHash = match[0]
    // Strip ... to get the actual hash for the Etherscan URL
    const actualHash = displayHash.replace(/\.\.\.$/, '')

    parts.push(
      <a
        key={`tx-${match.index}`}
        href={`https://sepolia.etherscan.io/tx/${actualHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#00D4FF',
          textDecoration: 'none',
          cursor: 'pointer',
          borderBottom: '1px solid transparent',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderBottom = '1px solid #00D4FF')}
        onMouseLeave={(e) => (e.currentTarget.style.borderBottom = '1px solid transparent')}
      >
        {displayHash}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < message.length) {
    parts.push(message.substring(lastIndex))
  }

  return parts.length === 0 ? message : parts
}

let uid = 0
function mkEntry(base: Omit<LogEntry, 'id' | 'timestamp'>, ts?: string): LogEntry {
  return {
    ...base,
    id:        ++uid,
    timestamp: ts
      ? ts.replace('T', ' ').slice(0, 19) + 'Z'
      : new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
  }
}

// Seed initial lines with staggered timestamps
const INITIAL_LOGS: LogEntry[] = LOG_POOL.map((e, i) => ({
  ...e,
  id:        ++uid,
  timestamp: new Date(Date.now() - (10 - i) * 1500).toISOString().replace('T', ' ').slice(0, 19) + 'Z',
}))

// ── Component ──────────────────────────────────────────────
export default function AgentTerminal() {
  const [logs, setLogs]              = useState<LogEntry[]>(INITIAL_LOGS)
  const [newId, setNewId]            = useState<number | null>(null)
  const [connected, setConnected]    = useState(false)
  const [activateState, setActivateState] = useState<ActivateState>('idle')
  const [secondsRemaining, setSecondsRemaining] = useState(60)
  const [activateLoading, setActivateLoading] = useState(false)
  const scrollRef                    = useRef<HTMLDivElement>(null)
  const initialized                  = useRef(false)

  // Auto-scroll to bottom whenever logs change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [logs])

  // Socket.io — real agent log stream
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const socket = io('http://localhost:3001', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
    })

    socket.on('connect', () => {
      setConnected(true)
      const entry = mkEntry({ level: 'INFO', module: 'System', message: 'Connected to AUTOBANK agents — live feed active' })
      setNewId(entry.id)
      setLogs(prev => [...prev, entry].slice(-100))
      setTimeout(() => setNewId(null), 600)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      const entry = mkEntry({ level: 'WARN', module: 'System', message: 'Connection lost — reconnecting...' })
      setNewId(entry.id)
      setLogs(prev => [...prev, entry].slice(-100))
      setTimeout(() => setNewId(null), 600)
    })

    socket.on('agent:log', (data: { timestamp: string; level: string; module: string; message: string; data?: LogData }) => {
      const entry = mkEntry(
        { level: toLevel(data.level), module: data.module, message: data.message, data: data.data },
        data.timestamp,
      )
      setNewId(entry.id)
      setLogs(prev => [...prev, entry].slice(-100))
      setTimeout(() => setNewId(null), 600)
    })

    // Listen for activation event from ActivateButton
    const handleAgentsActivating = () => {
      setLogs([
        mkEntry({ level: 'INFO', module: 'System', message: 'Activation requested — connecting to agents...' })
      ])
      setConnected(false)
    }

    window.addEventListener('agents:activating', handleAgentsActivating)

    socket.connect()

    return () => {
      window.removeEventListener('agents:activating', handleAgentsActivating)
      socket.removeAllListeners()
      socket.disconnect()
      initialized.current = false
    }
  }, [])

  // Poll status every 2 seconds when activate is running
  useEffect(() => {
    if (activateState !== 'running') return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/status')
        const { running } = await res.json()

        if (!running) {
          setActivateState('complete')
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Failed to poll status:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [activateState])

  // Countdown timer when activate is running
  useEffect(() => {
    if (activateState !== 'running') return

    const countdown = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdown)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdown)
  }, [activateState])

  // Handle activate button click
  const handleActivateClick = async () => {
    setActivateLoading(true)
    window.dispatchEvent(new CustomEvent('agents:activating'))

    try {
      const res = await fetch('/api/activate', { method: 'POST' })
      const data = await res.json()

      if (data.status === 'started' || data.status === 'already_running') {
        setActivateState('running')
        setSecondsRemaining(60)
      } else {
        console.error('Activation failed:', data)
      }
    } catch (err) {
      console.error('Failed to activate:', err)
    } finally {
      setActivateLoading(false)
    }
  }

  // Reset activate button to idle
  const handleActivateReset = () => {
    setActivateState('idle')
    setSecondsRemaining(60)
  }

  return (
    <section className="w-full bg-surface py-20 px-4 md:px-8">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes txPulse {
          0%   { background-color: rgba(255,184,0,0); }
          20%  { background-color: rgba(255,184,0,0.22); }
          100% { background-color: rgba(255,184,0,0); }
        }
        .log-new    { animation: slideUp  0.28s ease forwards; }
        .log-tx-new { animation: slideUp  0.28s ease forwards,
                                 txPulse  1.4s ease forwards; }
      `}</style>

      {/* ── Section header ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-text-secondary mb-2">
          Live Feed
        </p>
        <h2 className="font-display text-2xl font-bold text-accent cursor-blink">
          AGENT TERMINAL
        </h2>
      </div>

      {/* ── Terminal window ───────────────────────────────── */}
      <div
        className="max-w-7xl mx-auto rounded-xl overflow-hidden border border-border"
        style={{ boxShadow: '0 0 0 1px #1E1E2E, 0 32px 80px rgba(0,0,0,0.7)' }}
      >
        {/* macOS title bar */}
        <div className="flex items-center gap-3 px-4 h-10 bg-surface-raised border-b border-border relative">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57] opacity-90" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E] opacity-90" />
            <span className="w-3 h-3 rounded-full bg-[#28C840] opacity-90" />
          </div>
          <span className="font-mono text-[11px] text-text-secondary absolute left-1/2 -translate-x-1/2">
            autobank-agents — zsh
          </span>
          {/* Activate button in header */}
          <div className="ml-auto flex items-center gap-3">
            {activateState === 'idle' && (
              <button
                onClick={handleActivateClick}
                disabled={activateLoading || connected}
                className="px-2 py-0.5 text-[10px] font-mono border border-accent text-accent rounded-md
                  hover:bg-accent hover:bg-opacity-5 transition-colors duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶ RUN
              </button>
            )}
            {activateState === 'running' && (
              <div className="text-[10px] font-mono text-accent tracking-wide">
                ● {String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:{String(secondsRemaining % 60).padStart(2, '0')}
              </div>
            )}
            {activateState === 'complete' && (
              <button
                onClick={handleActivateReset}
                className="text-[10px] font-mono text-success cursor-pointer hover:opacity-70 transition-opacity"
              >
                ✓ DONE
              </button>
            )}
            {/* LIVE / OFFLINE indicator */}
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? '#00FF94' : '#FF4560',
                boxShadow:  connected ? '0 0 6px #00FF94' : '0 0 6px #FF4560',
              }}
            />
            <span
              className="font-mono text-[9px] tracking-widest"
              style={{ color: connected ? '#00FF94' : '#FF4560' }}
            >
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Log area */}
        <div
          ref={scrollRef}
          className="h-[460px] overflow-y-auto p-5 bg-[#070710]"
        >
          {/* Shell prompt header */}
          <div className="font-mono text-xs mb-4 opacity-70">
            <span className="text-success">autobank</span>
            <span className="text-text-secondary">@</span>
            <span className="text-success">sepolia</span>
            <span className="text-text-secondary">:</span>
            <span className="text-accent">~/agents</span>
            <span className="text-text-primary"> $ npx ts-node src/index.ts</span>
          </div>

          {/* Log lines */}
          <div className="space-y-[2px]">
            {logs.length === 0 && !connected && (
              <div style={{ color: '#5555AA', opacity: 0.6 }} className="font-mono text-[11px] mt-20 text-center">
                Waiting for activation... Click ACTIVATE AUTOBANK above
              </div>
            )}
            {logs.map((log) => {
              const isNew = log.id === newId
              const isTx  = log.level === 'TX'
              return (
                <div
                  key={log.id}
                  className={isNew ? (isTx ? 'log-tx-new' : 'log-new') : ''}
                  style={{ background: isNew ? LEVEL_BG[log.level] : 'transparent', borderRadius: 3 }}
                >
                  <div className="flex items-start gap-0 font-mono text-[11px] leading-relaxed px-1">
                    {/* Timestamp */}
                    <span className="text-[#33334d] shrink-0 mr-2 hidden lg:inline select-none">
                      [{log.timestamp}]
                    </span>

                    {/* Level */}
                    <span
                      className="shrink-0 font-semibold mr-2"
                      style={{
                        color:    LEVEL_COLOR[log.level],
                        minWidth: '4.8rem',
                      }}
                    >
                      [{log.level.padEnd(7)}]
                    </span>

                    {/* Module */}
                    <span
                      className="text-text-secondary shrink-0 mr-2 hidden md:inline"
                      style={{ minWidth: '10rem' }}
                    >
                      [{log.module}]
                    </span>

                    {/* Message */}
                    <span style={{ color: LEVEL_COLOR[log.level], opacity: isTx ? 1 : 0.9 }}>
                      {renderMessageWithLinks(log.message)}
                      {log.data?.txHash && (
                        <>
                          <span> | </span>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${log.data.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#00D4FF',
                              textDecoration: 'none',
                              cursor: 'pointer',
                              borderBottom: '1px solid transparent',
                              transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderBottom = '1px solid #00D4FF')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderBottom = '1px solid transparent')}
                          >
                            {log.data.txHash}
                          </a>
                        </>
                      )}
                      {log.data?.hash && !log.data?.txHash && (
                        <>
                          <span> | </span>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${log.data.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#00D4FF',
                              textDecoration: 'none',
                              cursor: 'pointer',
                              borderBottom: '1px solid transparent',
                              transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderBottom = '1px solid #00D4FF')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderBottom = '1px solid transparent')}
                          >
                            {log.data.hash}
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Live cursor at bottom */}
          <div className="flex items-center gap-1 font-mono text-xs mt-4 opacity-60">
            <span className="text-success">autobank</span>
            <span className="text-text-secondary">@</span>
            <span className="text-success">sepolia</span>
            <span className="text-text-secondary">:</span>
            <span className="text-accent">~/agents</span>
            <span className="text-text-primary"> $ </span>
            <span
              className="inline-block w-[7px] h-[14px] bg-accent ml-0.5"
              style={{ animation: 'cursor-blink 1s step-end infinite' }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
