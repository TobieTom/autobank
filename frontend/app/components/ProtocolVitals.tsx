'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { io } from 'socket.io-client'

// ── Metric definitions ─────────────────────────────────────
const METRICS = [
  {
    label:  'LOANS ISSUED',
    target: 3,
    start:  0,
    format: (v: number) => Math.round(v).toString(),
    color:  '#00D4FF',
  },
  {
    label:  'USDT VOLUME',
    target: 50,
    start:  0,
    format: (v: number) => `$${v.toFixed(2)}`,
    color:  '#00FF94',
  },
  {
    label:  'FEES COLLECTED',
    target: 0.25,
    start:  0,
    format: (v: number) => `$${v.toFixed(2)}`,
    color:  '#00D4FF',
  },
  {
    label:  'COMPUTE PAID',
    target: 0.25,
    start:  0,
    format: (v: number) => `$${v.toFixed(2)}`,
    color:  '#00FF94',
  },
  {
    label:  'DEFAULT RATE',
    target: 0,
    start:  0,
    format: (v: number) => `${v.toFixed(2)}%`,
    color:  '#8888AA',
  },
]

interface SystemStats {
  totalLoansIssued:   number
  totalVolumeUSDT:    number
  totalFeesCollected: number
  feesUsedForCompute: number
  activeLoans:        number
  defaultRate:        number
}

// Ticker text — must be long enough that two copies exceed viewport width
const TICKER_CHUNK =
  'LENDER AGENT ACTIVE  ·  BORROWER AGENT ACTIVE  ·  ARBITER AGENT ACTIVE  ·  ' +
  'SEPOLIA TESTNET  ·  TETHER WDK  ·  GROQ LLAMA 3  ·  ' +
  '3 LOANS CONFIRMED ON-CHAIN  ·  50 USDT ISSUED  ·  SELF-SUSTAINING LOOP ACTIVE  ·  '

// ── Component ──────────────────────────────────────────────
export default function ProtocolVitals() {
  const sectionRef  = useRef<HTMLElement>(null)
  const valRefs     = useRef<(HTMLSpanElement | null)[]>([])
  const animated    = useRef(false)
  const currentVals = useRef(METRICS.map(m => m.start))
  const initialized = useRef(false)

  // Count-up on scroll into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || animated.current) return
        animated.current = true

        METRICS.forEach((m, i) => {
          const el = valRefs.current[i]
          if (!el) return
          const proxy = { v: m.start }
          gsap.to(proxy, {
            v:        m.target,
            duration: m.target === 0 ? 0.4 : 1.8,
            ease:     'power3.out',
            delay:    i * 0.14,
            onUpdate: () => {
              el.textContent = m.format(proxy.v)
              currentVals.current[i] = proxy.v
            },
          })
        })
      },
      { threshold: 0.35 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Socket.io — update metrics when real stats arrive
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const socket = io('http://localhost:3001', { autoConnect: false })

    socket.on('agent:stats', (stats: SystemStats) => {
      const newTargets = [
        stats.totalLoansIssued,
        stats.totalVolumeUSDT,
        stats.totalFeesCollected,
        stats.feesUsedForCompute,
        stats.defaultRate,
      ]

      newTargets.forEach((target, i) => {
        const el = valRefs.current[i]
        if (!el) return
        const from = currentVals.current[i]
        if (from === target) return
        const proxy = { v: from }
        gsap.to(proxy, {
          v:        target,
          duration: 1.4,
          ease:     'power3.out',
          onUpdate: () => {
            el.textContent = METRICS[i].format(proxy.v)
            currentVals.current[i] = proxy.v
          },
        })
      })
    })

    socket.connect()

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      initialized.current = false
    }
  }, [])

  return (
    <section ref={sectionRef} className="w-full bg-bg relative overflow-hidden">
      <style>{`
        /* Subtle horizontal rule lines */
        .vitals-bg {
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 47px,
            rgba(30,30,46,0.5) 47px,
            rgba(30,30,46,0.5) 48px
          );
        }
        /* Infinite ticker */
        @keyframes vitals-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .vitals-ticker {
          display: flex;
          white-space: nowrap;
          animation: vitals-scroll 28s linear infinite;
          will-change: transform;
        }
        .vitals-ticker:hover { animation-play-state: paused; }
      `}</style>

      {/* Horizontal lines overlay */}
      <div className="vitals-bg absolute inset-0 pointer-events-none" aria-hidden="true" />

      {/* Metrics */}
      <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-12">
        <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-text-secondary mb-12">
          Protocol Vitals
        </p>

        <div className="flex flex-col sm:flex-row">
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              className="flex-1 flex flex-col items-center justify-center py-8 sm:py-10 relative"
            >
              {/* Vertical divider */}
              {i > 0 && (
                <div
                  className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-px bg-border"
                  style={{ height: '4rem' }}
                  aria-hidden="true"
                />
              )}
              {/* Horizontal divider on mobile */}
              {i > 0 && (
                <div
                  className="sm:hidden absolute top-0 left-1/4 right-1/4 h-px bg-border"
                  aria-hidden="true"
                />
              )}

              {/* Number */}
              <span
                ref={el => { valRefs.current[i] = el }}
                className="font-mono font-bold tabular-nums leading-none"
                style={{
                  fontSize:   'clamp(2rem, 4.5vw, 3.6rem)',
                  color:      m.color,
                  textShadow: `0 0 24px ${m.color}55`,
                  letterSpacing: '-0.02em',
                }}
              >
                {m.format(m.start)}
              </span>

              {/* Label */}
              <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-text-secondary mt-3">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Infinite ticker */}
      <div className="relative border-t border-b border-border py-2.5 overflow-hidden">
        {/* Left/right fade masks */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

        <div className="vitals-ticker">
          {/* Two identical spans — at -50% translateX the loop is seamless */}
          <span className="font-mono text-[10px] tracking-[0.28em] text-text-secondary shrink-0 px-4">
            {(TICKER_CHUNK + '  ').repeat(3)}
          </span>
          <span className="font-mono text-[10px] tracking-[0.28em] text-text-secondary shrink-0 px-4">
            {(TICKER_CHUNK + '  ').repeat(3)}
          </span>
        </div>
      </div>
    </section>
  )
}
