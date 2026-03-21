'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type State = 'idle' | 'running' | 'complete'

export default function ActivateButton() {
  const [state, setState] = useState<State>('idle')
  const [secondsRemaining, setSecondsRemaining] = useState(60)
  const [isLoading, setIsLoading] = useState(false)

  // Poll status every 2 seconds when running
  useEffect(() => {
    if (state !== 'running') return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/status')
        const { running } = await res.json()

        if (!running) {
          setState('complete')
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('Failed to poll status:', err)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [state])

  // Countdown timer
  useEffect(() => {
    if (state !== 'running') return

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
  }, [state])

  const handleActivate = async () => {
    setIsLoading(true)

    // Emit activation event so AgentTerminal clears logs
    window.dispatchEvent(new CustomEvent('agents:activating'))

    try {
      const res = await fetch('/api/activate', { method: 'POST' })
      const data = await res.json()

      if (data.status === 'started' || data.status === 'already_running') {
        setState('running')
        setSecondsRemaining(60)
      } else {
        console.error('Activation failed:', data)
      }
    } catch (err) {
      console.error('Failed to activate:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setState('idle')
    setSecondsRemaining(60)
  }

  return (
    <section className="w-full bg-bg py-24 px-4 md:px-8">
      <style>{`
        @keyframes pulse-ring {
          0%, 100% {
            r: 120px;
            opacity: 1;
          }
          100% {
            r: 160px;
            opacity: 0;
          }
        }
        .pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Pulsing ring background */}
              <div className="relative w-80 h-80 flex items-center justify-center">
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 300 300"
                  style={{ filter: 'drop-shadow(0 0 30px rgba(0, 212, 255, 0.2))' }}
                >
                  <circle
                    cx="150"
                    cy="150"
                    r="120"
                    fill="none"
                    stroke="rgba(0, 212, 255, 0.3)"
                    strokeWidth="1"
                  />
                  <circle
                    className="pulse-ring"
                    cx="150"
                    cy="150"
                    r="120"
                    fill="none"
                    stroke="rgba(0, 212, 255, 0.6)"
                    strokeWidth="2"
                  />
                </svg>

                {/* Button */}
                <button
                  onClick={handleActivate}
                  disabled={isLoading}
                  className="relative z-10 px-12 py-8 border-2 border-accent rounded-xl
                    hover:bg-accent hover:bg-opacity-10 transition-all duration-300
                    disabled:opacity-50 disabled:cursor-not-allowed
                    backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-display text-3xl font-bold text-accent tracking-tight">
                      ACTIVATE AUTOBANK
                    </span>
                    {isLoading && (
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {/* Subtitle */}
              <p className="font-mono text-sm text-text-secondary text-center max-w-md">
                Click to run a live 60-second autonomous cycle on Sepolia testnet
              </p>
            </motion.div>
          )}

          {state === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Spinner */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-24 h-24 border-2 border-transparent border-t-accent border-r-accent rounded-full"
                />
                <div className="absolute text-center">
                  <span className="font-mono text-xs text-accent font-bold">
                    {String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:
                    {String(secondsRemaining % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Status text */}
              <div className="flex flex-col items-center gap-4">
                <h3 className="font-display text-2xl font-bold text-accent">AGENTS RUNNING</h3>
                <p className="font-mono text-sm text-text-secondary">
                  {secondsRemaining} seconds remaining
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-sm h-1 bg-border rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: `${(secondsRemaining / 60) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                  className="h-full bg-accent"
                  style={{
                    boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)',
                  }}
                />
              </div>
            </motion.div>
          )}

          {state === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Success icon */}
              <motion.div
                animate={{ scale: [0.8, 1.1, 1] }}
                transition={{ duration: 0.6 }}
                className="relative w-32 h-32 flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-success rounded-full opacity-20" />
                <div className="text-5xl">✓</div>
              </motion.div>

              {/* Status text */}
              <div className="flex flex-col items-center gap-4">
                <h3 className="font-display text-3xl font-bold text-success">CYCLE COMPLETE</h3>
                <p className="font-mono text-sm text-text-secondary max-w-md text-center">
                  Autonomous agent loop executed successfully on Sepolia testnet
                </p>
              </div>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="px-8 py-3 border border-success text-success rounded-lg
                  hover:bg-success hover:bg-opacity-10 transition-colors font-mono text-sm
                  tracking-wider"
              >
                Activate Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
