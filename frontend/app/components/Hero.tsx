'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import gsap from 'gsap'

// Three.js canvas — no SSR, WebGL is browser-only
const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false })

// ── Word-split helper for stagger animation ────────────────
function SplitWord({ word, className }: { word: string; className?: string }) {
  return (
    <>
      {word.split('').map((char, i) => (
        <span
          key={i}
          className={`hero-char inline-block ${className ?? ''}`}
          style={{ willChange: 'transform, opacity' }}
        >
          {char}
        </span>
      ))}
    </>
  )
}

export default function Hero() {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.4, defaults: { ease: 'power3.out' } })

      tl.fromTo(
        '.hero-char',
        { y: 80, opacity: 0, rotateX: -40 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.7,
          stagger: 0.028,
        }
      )
        .fromTo(
          '.hero-tagline',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 },
          '-=0.35'
        )
        .fromTo(
          '.hero-status',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          '-=0.25'
        )
        .fromTo(
          '.hero-scroll',
          { opacity: 0 },
          { opacity: 1, duration: 0.6 },
          '-=0.1'
        )
    }, overlayRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="relative w-full h-screen overflow-hidden bg-bg">
      {/* ── Three.js network ────────────────────────────── */}
      <HeroCanvas />

      {/* ── Radial vignette ─────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(8,8,15,0.85) 100%)',
        }}
        aria-hidden="true"
      />

      {/* ── Content overlay ─────────────────────────────── */}
      <div
        ref={overlayRef}
        className="relative z-10 flex flex-col items-center justify-center h-full text-center select-none px-4"
        style={{ perspective: '800px' }}
      >
        {/* Protocol label */}
        <p className="hero-tagline font-mono text-[10px] md:text-xs tracking-[0.5em] uppercase text-text-secondary mb-5 opacity-0">
          Tether WDK · Hackathon Galactica
        </p>

        {/* Main title */}
        <div
          className="overflow-hidden"
          style={{ lineHeight: 0.9 }}
          aria-label="AUTOBANK"
        >
          <h1
            className="font-display font-extrabold glow-accent"
            style={{ fontSize: 'clamp(2.8rem, 10vw, 8rem)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
          >
            <SplitWord word="AUTOBANK" />
          </h1>
        </div>

        {/* Tagline */}
        <p
          className="hero-tagline font-mono tracking-[0.45em] uppercase text-text-secondary opacity-0 mt-5"
          style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.8rem)' }}
        >
          Autonomous&nbsp;·&nbsp;AI-Powered&nbsp;·&nbsp;Lending&nbsp;Protocol
        </p>

        {/* Status badge */}
        <div className="hero-status flex items-center gap-3 mt-8 opacity-0">
          {/* Pulsing dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success shadow-glow-success" />
          </span>
          <span className="font-mono text-[11px] tracking-[0.35em] text-success uppercase">
            Protocol&nbsp;Active
          </span>
          <span className="font-mono text-[11px] text-border mx-1">·</span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-text-secondary uppercase">
            Sepolia Testnet
          </span>
        </div>

        {/* Sub-stats row */}
        <div className="hero-status flex items-center gap-6 mt-4 opacity-0">
          {[
            { label: 'Lender Agent', color: 'text-accent' },
            { label: 'Borrower Agent', color: 'text-accent' },
            { label: 'Arbiter Agent', color: 'text-success' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`font-mono text-[10px] tracking-widest uppercase ${color}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator ────────────────────────────── */}
      <motion.div
        className="hero-scroll absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-0"
        animate={{ y: [0, 9, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <span className="font-mono text-[9px] tracking-[0.4em] text-text-secondary uppercase">
          Scroll
        </span>
        <svg
          width="14"
          height="22"
          viewBox="0 0 14 22"
          fill="none"
          className="text-text-secondary"
        >
          <path
            d="M7 0v18M7 18L1 12M7 18l6-6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </section>
  )
}
