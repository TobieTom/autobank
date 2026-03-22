import * as http from 'http'
import { Server } from 'socket.io'
import { Logger } from './logger'
import { SystemStats } from '../../shared/types'

export interface LogEntry {
  timestamp: string
  level: string
  module: string
  message: string
  data?: Record<string, unknown>
}

const logger = new Logger('WsServer')

let httpServer: http.Server
let io: Server

// Get allowed origins from environment, or default to localhost
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim())
  }
  // Default to localhost for development
  return ['http://localhost:3000', 'http://localhost:3001']
}

export function broadcastLog(entry: LogEntry): void {
  try {
    if (io) {
      io.emit('agent:log', entry)
    }
  } catch {
    // Never throw from broadcast
  }
}

export function broadcastStats(stats: SystemStats): void {
  try {
    if (io) {
      io.emit('agent:stats', stats)
    }
  } catch {
    // Never throw from broadcast
  }
}

export function startWsServer(existingHttpServer: http.Server): void {
  httpServer = existingHttpServer

  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    logger.info(`Client connected`, { socketId: socket.id })

    socket.on('disconnect', () => {
      logger.info(`Client disconnected`, { socketId: socket.id })
    })
  })

  logger.info('WebSocket server attached to HTTP server')
}
