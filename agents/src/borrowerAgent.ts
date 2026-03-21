/**
 * AUTOBANK BorrowerAgent — Autonomous Loan Requesting Agent
 * Uses Groq LLaMA 3.3-70b to decide whether to borrow, how much,
 * and manages repayment autonomously.
 *
 * SECURITY RULES:
 * - Private keys are NEVER logged
 * - All addresses validated before transactions
 * - Groq failures return null — never crash
 */

import Groq from 'groq-sdk'
import { config } from './config'
import { Logger } from './logger'
import { WalletManager } from './walletManager'
import { ReputationEngine } from './reputationEngine'
import {
  LoanRequest,
  Loan,
  AgentAction,
} from '../../shared/types'

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

interface BorrowDecision {
  shouldBorrow: boolean
  amount: number
  durationBlocks: number
  reasoning: string
}

export class BorrowerAgent {
  private groq: Groq
  private logger: Logger
  private walletManager: WalletManager
  private reputationEngine: ReputationEngine
  private borrowerPrivateKey: string
  private borrowerAgentId: string
  private borrowerAddress: string
  private actions: AgentAction[] = []

  constructor(
    walletManager: WalletManager,
    reputationEngine: ReputationEngine,
    borrowerPrivateKey: string,
    borrowerAgentId: string
  ) {
    this.walletManager = walletManager
    this.reputationEngine = reputationEngine
    this.borrowerPrivateKey = borrowerPrivateKey
    this.borrowerAgentId = borrowerAgentId
    this.logger = new Logger('BorrowerAgent')
    this.groq = new Groq({ apiKey: config.groqApiKey })

    // Load wallet to get address — never log the private key
    const wallet = this.walletManager.loadWallet(borrowerPrivateKey)
    this.borrowerAddress = wallet.address
    this.logger.info('BorrowerAgent initialized', {
      agentId: this.borrowerAgentId,
      address: this.borrowerAddress,
    })
  }

  /**
   * AI decision: should this agent request a loan right now?
   * Returns a LoanRequest if yes, null if no or on any error.
   */
  async decideToBorrow(): Promise<LoanRequest | null> {
    try {
      const reputation = this.reputationEngine.getOrCreate(
        this.borrowerAgentId,
        this.borrowerAddress
      )
      const usdtBalance = await this.walletManager.getUsdtBalance(this.borrowerAddress)
      const currentBlock = await this.walletManager.getBlockNumber()

      const systemPrompt = `You are an autonomous borrower agent for the AUTOBANK protocol, a decentralized AI-driven lending system on Ethereum Sepolia testnet. Your job is to decide whether to request a loan based on your current financial situation.

You must respond with ONLY valid JSON — no commentary, no markdown, no extra text.

Respond with this exact JSON structure:
{
  "shouldBorrow": boolean,
  "amount": number (USDT, between 1 and ${config.maxLoanAmountUsdt}, only relevant if shouldBorrow is true),
  "durationBlocks": number (how many blocks until repayment, e.g. 100 for ~20 minutes on Sepolia),
  "reasoning": "brief explanation of your decision (1-2 sentences)"
}

Guidelines:
- Borrow if your USDT balance is low and you have a decent reputation score
- Don't borrow if you already have a poor repayment history (high defaults)
- Keep requested amounts modest relative to your track record
- Set realistic durations (50-500 blocks)
- If uncertain, do NOT borrow (shouldBorrow: false)`

      const userPrompt = `Here is your current financial status:

Agent ID: ${this.borrowerAgentId}
Wallet Address: ${this.borrowerAddress}
Current USDT Balance: ${usdtBalance} USDT
Current Block Number: ${currentBlock}
Max Loan Allowed: ${config.maxLoanAmountUsdt} USDT

Reputation:
- Score: ${reputation.score}/100
- Loans Requested: ${reputation.loansRequested}
- Loans Repaid: ${reputation.loansRepaid}
- Loans Defaulted: ${reputation.loansDefaulted}
- Total Volume: ${reputation.totalVolumeUSDT} USDT

Should you request a loan right now?`

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      })

      const raw = completion.choices[0]?.message?.content ?? ''

      let parsed: BorrowDecision
      try {
        parsed = JSON.parse(raw) as BorrowDecision
      } catch {
        // JSON parse failure → safety: do not borrow
        this.logger.warn('Failed to parse Groq borrow decision, defaulting to no-borrow', {
          agentId: this.borrowerAgentId,
          raw,
        })
        return null
      }

      this.logger.agent('Borrow decision made', {
        agentId: this.borrowerAgentId,
        shouldBorrow: parsed.shouldBorrow,
        amount: parsed.amount,
        durationBlocks: parsed.durationBlocks,
        reasoning: parsed.reasoning,
      })

      if (!parsed.shouldBorrow) {
        this.recordAction('decide_to_borrow', 'decided not to borrow', {
          reasoning: parsed.reasoning,
        })
        return null
      }

      // Validate AI-provided values before using them
      const amount = typeof parsed.amount === 'number' && isFinite(parsed.amount) && parsed.amount > 0
        ? Math.min(parsed.amount, config.maxLoanAmountUsdt)
        : 1

      const durationBlocks = typeof parsed.durationBlocks === 'number' && parsed.durationBlocks > 0
        ? Math.floor(parsed.durationBlocks)
        : 100

      return this.requestLoan(amount, durationBlocks)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error('decideToBorrow failed, returning null', {
        agentId: this.borrowerAgentId,
        error: message,
      })
      return null
    }
  }

  /**
   * Build a LoanRequest and register it in the reputation engine.
   */
  async requestLoan(amount: number, durationBlocks: number): Promise<LoanRequest> {
    if (!isFinite(amount) || amount <= 0) {
      throw new Error(`requestLoan: invalid amount ${amount}`)
    }
    if (!isFinite(durationBlocks) || durationBlocks <= 0) {
      throw new Error(`requestLoan: invalid durationBlocks ${durationBlocks}`)
    }

    const request: LoanRequest = {
      id: `${Date.now()}-${this.borrowerAgentId}`,
      borrowerAddress: this.borrowerAddress,
      borrowerAgentId: this.borrowerAgentId,
      amount,
      currency: 'USDT',
      durationBlocks: Math.floor(durationBlocks),
      requestedAt: Date.now(),
      status: 'pending',
    }

    this.reputationEngine.recordLoanRequest(this.borrowerAgentId)

    this.logger.agent('Loan request created', {
      requestId: request.id,
      amount,
      currency: request.currency,
      durationBlocks: request.durationBlocks,
    })

    this.recordAction('request_loan', request.id, {
      amount,
      durationBlocks,
    }, undefined, amount)

    return request
  }

  /**
   * Repay a loan by sending USDT back to the lender.
   * Records result in reputation engine. Never throws — returns false on error.
   */
  async repayLoan(loan: Loan, lenderAddress: string): Promise<boolean> {
    try {
      const amount = loan.request.amount.toString()

      const txHash = await this.walletManager.sendUsdt(
        this.borrowerPrivateKey,
        lenderAddress,
        amount
      )

      this.reputationEngine.recordRepayment(this.borrowerAgentId, loan.request.amount)

      this.logger.tx('Loan repaid', txHash, {
        loanId: loan.id,
        lenderAddress,
        amount: loan.request.amount,
        currency: loan.request.currency,
      })

      this.recordAction('repay_loan', loan.id, {
        lenderAddress,
        amount: loan.request.amount,
        txHash,
      }, txHash, loan.request.amount)

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error('Loan repayment failed', {
        loanId: loan.id,
        error: message,
      })
      return false
    }
  }

  /**
   * Return all actions this agent has taken.
   */
  getActions(): AgentAction[] {
    return [...this.actions]
  }

  private recordAction(
    action: string,
    details: string,
    meta: Record<string, unknown>,
    txHash?: string,
    amount?: number
  ): void {
    const entry: AgentAction = {
      id: generateId('action'),
      agentId: this.borrowerAgentId,
      agentType: 'borrower',
      action,
      details: `${details} ${JSON.stringify(meta)}`,
      timestamp: Date.now(),
      txHash,
      amount,
    }
    this.actions.push(entry)
  }
}

export default BorrowerAgent
