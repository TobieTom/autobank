import * as fs from 'fs'
import * as path from 'path'
import { Logger } from './logger'
import { config } from './config'
import { ReputationScore } from '../../shared/types'

const DATA_DIR = path.join(__dirname, '../data')
const DATA_FILE = path.join(DATA_DIR, 'reputation.json')

const logger = new Logger('ReputationEngine')

type ScoreMap = Record<string, ReputationScore>

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    logger.info('Created data directory', { path: DATA_DIR })
  }
}

function loadScores(): ScoreMap {
  try {
    ensureDataDir()
    if (!fs.existsSync(DATA_FILE)) {
      return {}
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as ScoreMap
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Failed to load reputation data', { error: message })
    return {}
  }
}

function saveScores(scores: ScoreMap): void {
  try {
    ensureDataDir()
    fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2), 'utf-8')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Failed to save reputation data', { error: message })
  }
}

function calculateScore(rep: ReputationScore): number {
  const base = 50

  // Signal 1 — Repayment ratio (max 40 points)
  const repaymentRatio =
    rep.loansRequested > 0 ? rep.loansRepaid / rep.loansRequested : 0
  const signal1 = repaymentRatio * 40

  // Signal 2 — Default penalty (max 30 points deducted)
  const defaultRatio =
    rep.loansRequested > 0 ? rep.loansDefaulted / rep.loansRequested : 0
  const signal2 = defaultRatio * 30

  // Signal 3 — Volume bonus (max 20 points)
  const signal3 = Math.min(rep.totalVolumeUSDT / 50, 20)

  const raw = base + signal1 - signal2 + signal3
  return Math.max(0, Math.min(100, raw))
}

function validateAgentId(agentId: string): void {
  if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
    throw new Error('agentId must be a non-empty string')
  }
}

function validateAmount(amount: number): void {
  if (!isFinite(amount) || amount <= 0) {
    throw new Error(`amount must be a positive finite number, got: ${amount}`)
  }
}

export class ReputationEngine {
  getOrCreate(agentId: string, address: string): ReputationScore {
    validateAgentId(agentId)
    const scores = loadScores()

    if (scores[agentId]) {
      return scores[agentId]
    }

    const now = Date.now()
    const newScore: ReputationScore = {
      agentId,
      address,
      score: 50,
      loansRequested: 0,
      loansRepaid: 0,
      loansDefaulted: 0,
      totalVolumeUSDT: 0,
      walletAgeBlocks: 0,
      lastUpdated: now,
    }

    scores[agentId] = newScore
    saveScores(scores)
    logger.info('New reputation record created', { agentId, address, score: 50 })
    return newScore
  }

  recordLoanRequest(agentId: string): ReputationScore {
    validateAgentId(agentId)
    const scores = loadScores()

    if (!scores[agentId]) {
      throw new Error(`No reputation record found for agentId: ${agentId}`)
    }

    scores[agentId].loansRequested += 1
    scores[agentId].score = calculateScore(scores[agentId])
    scores[agentId].lastUpdated = Date.now()

    saveScores(scores)
    logger.agent('Loan request recorded', {
      agentId,
      loansRequested: scores[agentId].loansRequested,
      score: scores[agentId].score,
    })
    return scores[agentId]
  }

  recordRepayment(agentId: string, amount: number): ReputationScore {
    validateAgentId(agentId)
    validateAmount(amount)
    const scores = loadScores()

    if (!scores[agentId]) {
      throw new Error(`No reputation record found for agentId: ${agentId}`)
    }

    scores[agentId].loansRepaid += 1
    scores[agentId].totalVolumeUSDT += amount
    scores[agentId].score = calculateScore(scores[agentId])
    scores[agentId].lastUpdated = Date.now()

    saveScores(scores)
    logger.agent('Repayment recorded', {
      agentId,
      amount,
      loansRepaid: scores[agentId].loansRepaid,
      score: scores[agentId].score,
    })
    return scores[agentId]
  }

  recordDefault(agentId: string): ReputationScore {
    validateAgentId(agentId)
    const scores = loadScores()

    if (!scores[agentId]) {
      throw new Error(`No reputation record found for agentId: ${agentId}`)
    }

    scores[agentId].loansDefaulted += 1
    scores[agentId].score = calculateScore(scores[agentId])
    scores[agentId].lastUpdated = Date.now()

    saveScores(scores)
    logger.warn('Default recorded', {
      agentId,
      loansDefaulted: scores[agentId].loansDefaulted,
      score: scores[agentId].score,
    })
    return scores[agentId]
  }

  isEligibleForLoan(
    agentId: string,
    requestedAmount: number
  ): { eligible: boolean; reason: string; score: number } {
    validateAgentId(agentId)
    const scores = loadScores()
    const rep = scores[agentId]

    if (!rep) {
      return {
        eligible: false,
        reason: `No reputation record found for agentId: ${agentId}`,
        score: 0,
      }
    }

    if (rep.score < config.minReputationScore) {
      return {
        eligible: false,
        reason: `Score ${rep.score} is below minimum ${config.minReputationScore}`,
        score: rep.score,
      }
    }

    if (requestedAmount > config.maxLoanAmountUsdt) {
      return {
        eligible: false,
        reason: `Requested amount ${requestedAmount} USDT exceeds maximum ${config.maxLoanAmountUsdt} USDT`,
        score: rep.score,
      }
    }

    return {
      eligible: true,
      reason: 'Eligible for loan',
      score: rep.score,
    }
  }

  getAllScores(): ReputationScore[] {
    const scores = loadScores()
    return Object.values(scores)
  }
}

export default ReputationEngine
