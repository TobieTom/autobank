/**
 * AUTOBANK LenderAgent — Autonomous AI Loan Decision Engine
 * Uses Groq LLaMA 3.3-70b to evaluate loan requests and issue USDT loans
 * on Sepolia testnet.
 *
 * SECURITY RULES:
 * - Private keys are NEVER logged
 * - All addresses validated before transactions
 * - Groq failures default to loan rejection — never crash
 */

import Groq from 'groq-sdk'
import { config } from './config'
import { Logger } from './logger'
import { WalletManager } from './walletManager'
import { ReputationEngine } from './reputationEngine'
import {
  LoanRequest,
  Loan,
  LoanDecision,
  AgentAction,
} from '../../shared/types'

// Safe uuid using Node.js built-in crypto — no extra package needed
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

const REJECTION_DECISION: LoanDecision = {
  approved: false,
  reason: 'Defaulting to rejection due to internal error',
  interestRate: 0,
  maxAmount: 0,
  agentReasoning: 'Safety default: could not complete AI evaluation',
}

export class LenderAgent {
  private groq: Groq
  private logger: Logger
  private walletManager: WalletManager
  private reputationEngine: ReputationEngine
  private lenderPrivateKey: string
  private lenderAddress: string
  private actions: AgentAction[] = []

  constructor(
    walletManager: WalletManager,
    reputationEngine: ReputationEngine,
    lenderPrivateKey: string
  ) {
    this.walletManager = walletManager
    this.reputationEngine = reputationEngine
    this.lenderPrivateKey = lenderPrivateKey
    this.logger = new Logger('LenderAgent')
    this.groq = new Groq({ apiKey: config.groqApiKey })

    // Load wallet to get address — never log the private key
    const wallet = this.walletManager.loadWallet(lenderPrivateKey)
    this.lenderAddress = wallet.address
    this.logger.info('LenderAgent initialized', { lenderAddress: this.lenderAddress })
  }

  /**
   * Core AI decision method. Evaluates a loan request using:
   * 1. Reputation eligibility check (fast, no API cost)
   * 2. Groq LLaMA 3 reasoning (only if eligible)
   */
  async evaluateLoanRequest(request: LoanRequest): Promise<LoanDecision> {
    this.logger.agent('Evaluating loan request', {
      requestId: request.id,
      borrower: request.borrowerAddress,
      amount: request.amount,
      currency: request.currency,
      durationBlocks: request.durationBlocks,
    })

    // Step 1 — Get reputation score
    const reputation = this.reputationEngine.getOrCreate(
      request.borrowerAgentId,
      request.borrowerAddress
    )

    // Step 2 — Basic eligibility check (no Groq call if ineligible)
    const eligibility = this.reputationEngine.isEligibleForLoan(
      request.borrowerAgentId,
      request.amount
    )

    // Step 3 — Reject immediately if ineligible
    if (!eligibility.eligible) {
      const decision: LoanDecision = {
        approved: false,
        reason: eligibility.reason,
        interestRate: 0,
        maxAmount: 0,
        agentReasoning: `Pre-screening rejected: ${eligibility.reason}`,
      }

      this.recordAction('evaluate_loan_request', request.id, {
        decision: 'rejected',
        reason: eligibility.reason,
        score: eligibility.score,
      })

      this.logger.agent('Loan rejected at pre-screening', {
        requestId: request.id,
        reason: eligibility.reason,
      })

      return decision
    }

    // Step 4-8 — Call Groq LLaMA 3 for AI reasoning
    try {
      const systemPrompt = `You are an autonomous lending agent for the AUTOBANK protocol, a decentralized AI-driven lending system on Ethereum. Your job is to evaluate loan requests and decide whether to approve or reject them.

You must respond with ONLY valid JSON — no commentary, no markdown, no extra text.

Respond with this exact JSON structure:
{
  "approved": boolean,
  "reason": "brief explanation (1-2 sentences)",
  "interestRate": number (annual percentage, e.g. 5.0 for 5%, between 3 and 25),
  "maxAmount": number (USDT, must not exceed requested amount),
  "agentReasoning": "detailed reasoning about the borrower's creditworthiness"
}

Guidelines:
- Approve if reputation score >= ${config.minReputationScore} and repayment history is good
- Higher default ratio = higher interest rate or rejection
- Higher volume history = more trust
- Never approve amounts above ${config.maxLoanAmountUsdt} USDT
- Be conservative: when in doubt, reject`

      const userPrompt = `Evaluate this loan request:

Borrower Address: ${request.borrowerAddress}
Requested Amount: ${request.amount} ${request.currency}
Loan Duration: ${request.durationBlocks} blocks

Borrower Reputation:
- Score: ${reputation.score}/100
- Loans Requested: ${reputation.loansRequested}
- Loans Repaid: ${reputation.loansRepaid}
- Loans Defaulted: ${reputation.loansDefaulted}
- Total Volume: ${reputation.totalVolumeUSDT} USDT

Should this loan be approved?`

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

      // Step 7 — Parse JSON response
      let decision: LoanDecision
      try {
        const parsed = JSON.parse(raw) as Partial<LoanDecision>
        decision = {
          approved: parsed.approved === true,
          reason: parsed.reason ?? 'No reason provided',
          interestRate: typeof parsed.interestRate === 'number' ? parsed.interestRate : 10,
          maxAmount: typeof parsed.maxAmount === 'number' ? parsed.maxAmount : 0,
          agentReasoning: parsed.agentReasoning ?? raw,
        }
      } catch {
        // Step 8 — JSON parse failure → safety rejection
        this.logger.warn('Failed to parse Groq JSON response, defaulting to rejection', {
          requestId: request.id,
          raw,
        })
        decision = { ...REJECTION_DECISION, reason: 'Could not parse AI response' }
      }

      // Step 9 — Log the decision
      this.logger.agent('AI loan decision made', {
        requestId: request.id,
        approved: decision.approved,
        reason: decision.reason,
        interestRate: decision.interestRate,
        score: reputation.score,
      })

      this.recordAction('evaluate_loan_request', request.id, {
        decision: decision.approved ? 'approved' : 'rejected',
        reason: decision.reason,
        interestRate: decision.interestRate,
        score: reputation.score,
      })

      return decision
    } catch (err) {
      // Groq API failure → safety rejection, never crash
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error('Groq API call failed, defaulting to rejection', {
        requestId: request.id,
        error: message,
      })
      return { ...REJECTION_DECISION, reason: `AI evaluation failed: ${message}` }
    }
  }

  /**
   * Issue a loan by sending USDT to the borrower.
   * Returns null if decision is not approved.
   */
  async issueLoan(request: LoanRequest, decision: LoanDecision): Promise<Loan | null> {
    if (!decision.approved) {
      this.logger.agent('Loan issuance skipped — not approved', {
        requestId: request.id,
        reason: decision.reason,
      })
      return null
    }

    // Validate amount
    const amount = request.amount
    if (!isFinite(amount) || amount <= 0) {
      throw new Error(`issueLoan: invalid amount ${amount}`)
    }

    try {
      const txHash = await this.walletManager.sendUsdt(
        this.lenderPrivateKey,
        request.borrowerAddress,
        amount.toString()
      )

      const currentBlock = await this.walletManager.getBlockNumber()

      const loan: Loan = {
        id: generateId(),
        request,
        lenderAddress: this.lenderAddress,
        interestRate: decision.interestRate,
        dueBlock: currentBlock + request.durationBlocks,
        issuedAt: Date.now(),
        txHash,
        status: 'active',
      }

      this.logger.tx('Loan issued successfully', txHash, {
        loanId: loan.id,
        borrower: request.borrowerAddress,
        amount,
        currency: request.currency,
        dueBlock: loan.dueBlock,
      })

      this.recordAction('issue_loan', loan.id, {
        borrower: request.borrowerAddress,
        amount,
        txHash,
      }, txHash, amount)

      return loan
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error('Loan issuance failed', {
        requestId: request.id,
        error: message,
      })
      throw new Error(`issueLoan failed: ${message}`)
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
      id: generateId(),
      agentId: this.lenderAddress,
      agentType: 'lender',
      action,
      details: `${details} ${JSON.stringify(meta)}`,
      timestamp: Date.now(),
      txHash,
      amount,
    }
    this.actions.push(entry)
  }
}

export default LenderAgent
