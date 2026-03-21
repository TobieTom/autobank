'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────
type LogLevel = 'INFO' | 'SUCCESS' | 'AGENT' | 'TX' | 'WARN' | 'ERROR'

interface LogEntry {
  id:        number
  timestamp: string
  level:     LogLevel
  module:    string
  message:   string
}

// ── Simulated log pool (mirrors real agent output) ─────────
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
  { level: 'INFO',    module: 'ArbiterAgent',     message: 'Monitor loop complete — loansChecked: 2, dueLoans: 0, defaultsHandled: 0' },
  { level: 'AGENT',   module: 'BorrowerAgent',    message: 'Borrow decision made — shouldBorrow: true, amount: 20 USDT, reasoning: low balance, decent score' },
  { level: 'AGENT',   module: 'LenderAgent',      message: 'AI loan decision made — approved: true, interestRate: 4.5%, score: 76.33' },
  { level: 'SUCCESS', module: 'LenderAgent',      message: 'Loan approved — 20 USDT at 4.5% interest' },
  { level: 'TX',      module: 'WalletManager',    message: 'USDT transfer submitted | txHash: 0x17a01c89800b89c1bd3d11e63c82b0c1f2ca...' },
  { level: 'TX',      module: 'WalletManager',    message: 'USDT transfer confirmed | txHash: 0x17a01c89800b89c1bd3d11e63c82b0c1f2ca...' },
  { level: 'SUCCESS', module: 'ArbiterAgent',     message: 'Protocol fee collected — 0.10 USDT | feesUntilNextComputePayment: 0.0000' },
  { level: 'AGENT',   module: 'ArbiterAgent',     message: 'Initiating self-sustaining compute payment — paymentAmount: 0.15 USDT' },
  { level: 'SUCCESS', module: 'ArbiterAgent',     message: 'AUTOBANK is self-sustaining — fees paid for compute | purpose: Groq LLM costs' },
  { level: 'WARN',    module: 'WalletManager',    message: 'getUsdtBalance: retrying after provider timeout — attempt 2/3' },
  { level: 'INFO',    module: 'WalletManager',    message: 'Provider initialized — chainId: 11155111, endpoint: eth-sepolia.g.alchemy.com' },
  { level: 'AGENT',   module: 'LenderAgent',      message: 'LenderAgent initialized — lenderAddress: 0x137B...e6fD' },
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
let uid = 0
function mkEntry(base: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  return {
    ...base,
    id:        ++uid,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
  }
}

// Seed initial lines with staggered timestamps
const INITIAL_LOGS: LogEntry[] = LOG_POOL.slice(0, 10).map((e, i) => ({
  ...e,
  id:        ++uid,
  timestamp: new Date(Date.now() - (10 - i) * 1500).toISOString().replace('T', ' ').slice(0, 19) + 'Z',
}))

// ── Component ──────────────────────────────────────────────
export default function AgentTerminal() {
  const [logs, setLogs]     = useState<LogEntry[]>(INITIAL_LOGS)
  const [newId, setNewId]   = useState<number | null>(null)
  const scrollRef           = useRef<HTMLDivElement>(null)
  const poolIdxRef          = useRef(10)

  // Auto-scroll to bottom whenever logs change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [logs])

  // Stream a new line every 1.5 s
  useEffect(() => {
    const interval = setInterval(() => {
      const base  = LOG_POOL[poolIdxRef.current % LOG_POOL.length]
      poolIdxRef.current++
      const entry = mkEntry(base)
      setNewId(entry.id)
      setLogs(prev => [...prev, entry].slice(-60)) // keep last 60
      // Clear "new" flag after animation completes
      setTimeout(() => setNewId(null), 600)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

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
        <div className="flex items-center gap-3 px-4 h-10 bg-surface-raised border-b border-border">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57] opacity-90" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E] opacity-90" />
            <span className="w-3 h-3 rounded-full bg-[#28C840] opacity-90" />
          </div>
          <span className="font-mono text-[11px] text-text-secondary absolute left-1/2 -translate-x-1/2">
            autobank-agents — zsh
          </span>
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
                      {log.message}
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
