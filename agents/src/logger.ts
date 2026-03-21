/**
 * AUTOBANK Logger — Production-Grade Structured Logging
 * No external dependencies — pure Node.js console
 * Supports: info, warn, error, success, agent, tx
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'agent' | 'tx'

type BroadcastFn = (entry: {
  timestamp: string
  level: string
  module: string
  message: string
  data?: Record<string, unknown>
}) => void

export class Logger {
  private module: string
  private static broadcaster: BroadcastFn | null = null

  static setBroadcaster(fn: BroadcastFn): void {
    Logger.broadcaster = fn
  }

  constructor(module: string) {
    this.module = module
  }

  /**
   * Safely serialize data objects to JSON string
   * If serialization fails, returns empty string silently
   */
  private safeSerialize(data: unknown): string {
    try {
      if (data === null || data === undefined) {
        return ''
      }
      if (typeof data === 'string') {
        return data
      }
      if (typeof data === 'object') {
        return JSON.stringify(data)
      }
      return String(data)
    } catch {
      // Silently fail on serialization errors per security requirements
      return ''
    }
  }

  /**
   * Format timestamp as ISO 8601 with milliseconds
   */
  private getTimestamp(): string {
    return new Date().toISOString()
  }

  /**
   * Color codes for terminal output
   */
  private getColorCode(level: LogLevel): string {
    switch (level) {
      case 'info':
        return '\x1b[36m' // cyan
      case 'warn':
        return '\x1b[33m' // yellow
      case 'error':
        return '\x1b[31m' // red
      case 'success':
        return '\x1b[32m' // green
      case 'agent':
        return '\x1b[35m' // magenta
      case 'tx':
        return '\x1b[34m' // blue
      default:
        return '\x1b[37m' // white
    }
  }

  /**
   * Reset ANSI color codes
   */
  private getResetCode(): string {
    return '\x1b[0m'
  }

  /**
   * Format log level string (uppercase, padded)
   */
  private formatLevel(level: LogLevel): string {
    const padded = level.toUpperCase().padEnd(7)
    return padded
  }

  /**
   * Construct log entry with metadata
   */
  private formatLogEntry(
    timestamp: string,
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): string {
    const color = this.getColorCode(level)
    const reset = this.getResetCode()
    const levelStr = this.formatLevel(level)

    let entry = `${color}[${timestamp}] [${levelStr}] [${this.module}]${reset} ${message}`

    // Inline data serialization on same line
    if (data && Object.keys(data).length > 0) {
      const serialized = this.safeSerialize(data)
      if (serialized) {
        entry += ` ${serialized}`
      }
    }

    return entry
  }

  /**
   * Log at INFO level
   */
  info(message: string, data?: Record<string, unknown>): void {
    try {
      const timestamp = this.getTimestamp()
      const entry = this.formatLogEntry(timestamp, 'info', message, data)
      console.log(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'info', module: this.module, message, data }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Log at WARN level
   */
  warn(message: string, data?: Record<string, unknown>): void {
    try {
      const timestamp = this.getTimestamp()
      const entry = this.formatLogEntry(timestamp, 'warn', message, data)
      console.warn(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'warn', module: this.module, message, data }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Log at ERROR level
   */
  error(message: string, data?: Record<string, unknown>): void {
    try {
      const timestamp = this.getTimestamp()
      const entry = this.formatLogEntry(timestamp, 'error', message, data)
      console.error(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'error', module: this.module, message, data }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Log at SUCCESS level (for completed operations)
   */
  success(message: string, data?: Record<string, unknown>): void {
    try {
      const timestamp = this.getTimestamp()
      const entry = this.formatLogEntry(timestamp, 'success', message, data)
      console.log(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'success', module: this.module, message, data }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Log at AGENT level (autonomous agent decisions and actions)
   */
  agent(message: string, data?: Record<string, unknown>): void {
    try {
      const timestamp = this.getTimestamp()
      const entry = this.formatLogEntry(timestamp, 'agent', message, data)
      console.log(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'agent', module: this.module, message, data }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Log at TX level (blockchain transactions)
   * Prominently displays transaction hash
   */
  tx(
    message: string,
    txHash: string,
    data?: Record<string, unknown>
  ): void {
    try {
      const timestamp = this.getTimestamp()
      const txInfo = { txHash, ...data }
      const entry = this.formatLogEntry(timestamp, 'tx', message, txInfo)
      console.log(entry)
      try { Logger.broadcaster?.({ timestamp, level: 'tx', module: this.module, message, data: txInfo }) } catch { /* noop */ }
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Get current module name
   */
  getModule(): string {
    return this.module
  }
}

export default Logger
