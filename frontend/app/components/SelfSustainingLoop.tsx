'use client'

import { useEffect, useRef } from 'react'

// ── TX data ────────────────────────────────────────────────
const TXS = [
  { hash: '0x5ffb6a258496f4f1fb217886d64c46470448...', amount: '10 USDT',  label: 'LOAN ISSUED' },
  { hash: '0x17a01c89800b89c1bd3d11e63c82b0c1f2ca...', amount: '20 USDT',  label: 'LOAN ISSUED' },
  { hash: '0x6efc6b73e4cd1774099373397...compute',     amount: '0.25 USDT', label: 'COMPUTE PAID' },
]

// ── Circular node positions (cx, cy in SVG 200×200 viewBox) ─
// Top=LOANS, Right=FEES, Bottom=COMPUTE, Left=AGENTS
const R = 72  // radius of the circle
const CX = 100
const CY = 100

const NODES = [
  { id: 'loans',   label: 'LOANS',   x: CX,       y: CY - R,   color: '#00D4FF' },
  { id: 'fees',    label: 'FEES',    x: CX + R,   y: CY,       color: '#00FF94' },
  { id: 'compute', label: 'COMPUTE', x: CX,       y: CY + R,   color: '#FFB800' },
  { id: 'agents',  label: 'AGENTS',  x: CX - R,   y: CY,       color: '#00D4FF' },
]

const FLOW_LABELS = [
  { text: 'USDT issued',    angle: -45 },
  { text: '0.5% fee',       angle:  45 },
  { text: 'Groq API paid',  angle: 135 },
  { text: 'Decisions made', angle: 225 },
]

// ── Arcs between consecutive nodes ────────────────────────
// Each arc is a cubic bezier that follows the circle
function arcPath(from: typeof NODES[0], to: typeof NODES[0]) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // Control point pulled outward from center
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const len = Math.sqrt(dx * dx + dy * dy)
  // perpendicular inward toward center
  const nx = (CX - mx) / len
  const ny = (CY - my) / len
  const pull = 18
  const cpx = mx + nx * pull
  const cpy = my + ny * pull
  return `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`
}

export default function SelfSustainingLoop() {
  const arcRefs = useRef<(SVGPathElement | null)[]>([])

  // Animate stroke-dashoffset for each arc
  useEffect(() => {
    const lengths: number[] = []
    arcRefs.current.forEach((el, i) => {
      if (!el) return
      const len = el.getTotalLength()
      lengths[i] = len
      el.style.strokeDasharray  = `${len}`
      el.style.strokeDashoffset = `${len}`
    })

    // Stagger the arcs
    arcRefs.current.forEach((el, i) => {
      if (!el) return
      const len = lengths[i]
      let start: number | null = null
      const duration = 1200
      const delay = i * 300

      function step(ts: number) {
        if (start === null) start = ts
        const elapsed = ts - start - delay
        if (elapsed < 0) { requestAnimationFrame(step); return }
        const progress = Math.min(elapsed / duration, 1)
        el!.style.strokeDashoffset = `${len * (1 - progress)}`
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }, [])

  const arcs = NODES.map((node, i) => ({
    from: node,
    to: NODES[(i + 1) % NODES.length],
    color: node.color,
    flowLabel: FLOW_LABELS[i],
  }))

  return (
    <section className="w-full bg-bg py-24 px-4 md:px-8">
      <style>{`
        @keyframes node-pulse {
          0%, 100% { opacity: 0.7; r: 9px; }
          50%       { opacity: 1;   r: 11px; }
        }
        @keyframes loop-flow {
          from { stroke-dashoffset: var(--arc-len); }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes arc-travel {
          0%   { stroke-dashoffset: var(--arc-len); }
          100% { stroke-dashoffset: calc(var(--arc-len) * -1); }
        }
        .arc-animated {
          animation: arc-travel 3s linear infinite;
        }
        .node-circle {
          animation: node-pulse 2.4s ease-in-out infinite;
        }
        .tx-row:hover {
          background: rgba(0, 212, 255, 0.06);
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-text-secondary mb-4">
          Protocol Mechanics
        </p>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
          THE SELF-SUSTAINING LOOP
        </h2>
        <p className="font-mono text-[11px] tracking-[0.25em] text-text-secondary uppercase mb-16">
          AUTOBANK funds its own existence
        </p>

        {/* Main content: diagram + TX list */}
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* ── SVG circular diagram ──────────────────────── */}
          <div className="relative shrink-0" style={{ width: 380, height: 360 }}>
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
              }}
            />

            <svg
              viewBox="-45 -30 290 260"
              width="380"
              height="360"
              overflow="visible"
            >
              {/* Defs: glows */}
              <defs>
                {NODES.map(n => (
                  <filter key={n.id} id={`glow-${n.id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
                <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Guide circle (faint) */}
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

              {/* Arcs — drawn once on mount (the static dim path) */}
              {arcs.map((arc, i) => (
                <g key={i}>
                  {/* Dim base arc */}
                  <path
                    d={arcPath(arc.from, arc.to)}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="0.8"
                    opacity="0.12"
                  />
                  {/* Animated bright arc */}
                  <path
                    ref={el => { arcRefs.current[i] = el }}
                    d={arcPath(arc.from, arc.to)}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    filter="url(#arc-glow)"
                    opacity="0.9"
                    style={{
                      strokeDasharray: '9999',
                      strokeDashoffset: '9999',
                    }}
                  />
                </g>
              ))}

              {/* Flow labels — placed at midpoint angle */}
              {arcs.map((arc, i) => {
                const mid = {
                  x: (arc.from.x + arc.to.x) / 2,
                  y: (arc.from.y + arc.to.y) / 2,
                }
                // Nudge outward from center
                const dx = mid.x - CX
                const dy = mid.y - CY
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                const ox = mid.x + (dx / dist) * 14
                const oy = mid.y + (dy / dist) * 14
                return (
                  <text
                    key={i}
                    x={ox}
                    y={oy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="4.5"
                    fontFamily="var(--font-jetbrains-mono, monospace)"
                    fill={arc.color}
                    opacity="0.65"
                    letterSpacing="0.04em"
                  >
                    {arc.flowLabel.text}
                  </text>
                )
              })}

              {/* Nodes */}
              {NODES.map((node, i) => (
                <g key={node.id}>
                  {/* Outer halo */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={16}
                    fill={node.color}
                    opacity="0.06"
                  />
                  {/* Inner filled circle */}
                  <circle
                    className="node-circle"
                    cx={node.x}
                    cy={node.y}
                    r={10}
                    fill="#08080F"
                    stroke={node.color}
                    strokeWidth="1.5"
                    filter={`url(#glow-${node.id})`}
                    style={{ animationDelay: `${i * 0.6}s` }}
                  />
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + (node.y < CY ? -19 : node.y > CY ? 22 : 0)}
                    dy={node.y === CY ? (node.x < CX ? 0 : 0) : 0}
                    dx={node.y === CY ? (node.x < CX ? -22 : 22) : 0}
                    textAnchor={
                      node.y === CY
                        ? node.x < CX ? 'end' : 'start'
                        : 'middle'
                    }
                    dominantBaseline="middle"
                    fontSize="6"
                    fontFamily="var(--font-jetbrains-mono, monospace)"
                    fontWeight="700"
                    fill={node.color}
                    letterSpacing="0.08em"
                  >
                    {node.label}
                  </text>
                </g>
              ))}

              {/* Center label */}
              <text
                x={CX}
                y={CY - 5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fontFamily="var(--font-jetbrains-mono, monospace)"
                fill="#8888AA"
                letterSpacing="0.1em"
              >
                AUTO
              </text>
              <text
                x={CX}
                y={CY + 5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fontFamily="var(--font-jetbrains-mono, monospace)"
                fill="#8888AA"
                letterSpacing="0.1em"
              >
                BANK
              </text>
            </svg>
          </div>

          {/* ── Right panel ───────────────────────────────── */}
          <div className="flex-1 w-full">
            {/* How it works bullets */}
            <div className="space-y-4 mb-10">
              {[
                { color: '#00D4FF', step: '01', text: 'AI agents issue USDT loans to borrowers on Sepolia' },
                { color: '#00FF94', step: '02', text: 'Arbiter collects a 0.5% protocol fee on each loan' },
                { color: '#FFB800', step: '03', text: 'Fees are forwarded to pay Groq LLM compute costs' },
                { color: '#00D4FF', step: '04', text: 'Funded agents continue making autonomous decisions' },
              ].map(({ color, step, text }) => (
                <div key={step} className="flex items-start gap-4">
                  <span
                    className="font-mono text-[10px] tracking-widest shrink-0 mt-0.5"
                    style={{ color }}
                  >
                    {step}
                  </span>
                  <p className="font-mono text-[11px] text-text-secondary leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* Verified TX hashes */}
            <div>
              <p className="font-mono text-[9px] tracking-[0.5em] uppercase text-text-secondary mb-4">
                Verified on Sepolia Testnet
              </p>

              <div className="border border-border rounded-lg overflow-hidden">
                {TXS.map((tx, i) => (
                  <div
                    key={i}
                    className="tx-row flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status dot */}
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: '#00FF94',
                          boxShadow: '0 0 6px #00FF94',
                        }}
                      />
                      {/* Hash */}
                      <span className="font-mono text-[10px] text-text-secondary truncate">
                        {tx.hash}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="font-mono text-[10px] text-accent">{tx.amount}</span>
                      <span
                        className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          color:       '#00FF94',
                          background:  'rgba(0,255,148,0.08)',
                          border:      '1px solid rgba(0,255,148,0.2)',
                        }}
                      >
                        {tx.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
