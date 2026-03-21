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

const httpServer = http.createServer()

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
})

io.on('connection', (socket) => {
  logger.info(`Client connected`, { socketId: socket.id })

  socket.on('disconnect', () => {
    logger.info(`Client disconnected`, { socketId: socket.id })
  })
})

export function broadcastLog(entry: LogEntry): void {
  try {
    io.emit('agent:log', entry)
  } catch {
    // Never throw from broadcast
  }
}

export function broadcastStats(stats: SystemStats): void {
  try {
    io.emit('agent:stats', stats)
  } catch {
    // Never throw from broadcast
  }
}

export function startWsServer(): void {
  const WS_PORT = 3001 // Always use 3001 for WebSocket server
  httpServer.listen(WS_PORT, () => {
    logger.info(`WebSocket server listening on port ${WS_PORT}`)
  })
}
