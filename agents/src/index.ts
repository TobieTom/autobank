import { config } from './config'
import { Logger } from './logger'
import { WalletManager } from './walletManager'
import { ReputationEngine } from './reputationEngine'
import { LenderAgent } from './lenderAgent'
import { BorrowerAgent } from './borrowerAgent'
import { ArbiterAgent } from './arbiterAgent'

const logger = new Logger('AUTOBANK')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  try {
    // Banner
    logger.info('╔════════════════════════════════════╗')
    logger.info('║     AUTOBANK PROTOCOL v1.0.0       ║')
    logger.info('║  Self-Sustaining Agent Lending     ║')
    logger.info('║  Tether WDK Hackathon Galactica    ║')
    logger.info('╚════════════════════════════════════╝')

    // Initialize infrastructure
    const walletManager = new WalletManager()
    const reputationEngine = new ReputationEngine()

    // Load persistent wallets from .env, or generate on first run and exit
    if (!config.lenderPrivateKey || !config.borrowerPrivateKey || !config.arbiterPrivateKey) {
      const lenderWallet = walletManager.createWallet()
      const borrowerWallet = walletManager.createWallet()
      const arbiterWallet = walletManager.createWallet()

      console.log('━━━ FIRST RUN: Wallet addresses generated ━━━')
      console.log('Add these to your agents/.env file:')
      console.log(`LENDER_PRIVATE_KEY=${lenderWallet.privateKey}`)
      console.log(`BORROWER_PRIVATE_KEY=${borrowerWallet.privateKey}`)
      console.log(`ARBITER_PRIVATE_KEY=${arbiterWallet.privateKey}`)
      console.log(`LENDER_ADDRESS=${lenderWallet.address}`)
      console.log(`BORROWER_ADDRESS=${borrowerWallet.address}`)
      console.log(`ARBITER_ADDRESS=${arbiterWallet.address}`)
      console.log('━━━ Then run again ━━━')
      process.exit(0)
    }

    const lenderWallet = walletManager.loadWallet(config.lenderPrivateKey)
    const borrowerWallet = walletManager.loadWallet(config.borrowerPrivateKey)
    const arbiterWallet = walletManager.loadWallet(config.arbiterPrivateKey)

    logger.info('Lender wallet', { address: lenderWallet.address })
    logger.info('Borrower wallet', { address: borrowerWallet.address })
    logger.info('Arbiter wallet', { address: arbiterWallet.address })

    // Initialize agents
    const lenderAgent = new LenderAgent(
      walletManager,
      reputationEngine,
      lenderWallet.privateKey
    )

    const borrowerAgent = new BorrowerAgent(
      walletManager,
      reputationEngine,
      borrowerWallet.privateKey,
      'borrower-001'
    )

    const arbiterAgent = new ArbiterAgent(
      walletManager,
      reputationEngine,
      arbiterWallet.privateKey,
      lenderWallet.address  // lender address as protocol treasury
    )

    logger.info('All agents initialized. Starting autonomous loop...')

    // ─── Reputation Seeding for Demo ──────────────────────────────────────
    logger.info('━━━ Seeding borrower reputation for demo ━━━')
    reputationEngine.getOrCreate('borrower-001', borrowerWallet.address)
    reputationEngine.recordLoanRequest('borrower-001')
    reputationEngine.recordLoanRequest('borrower-001')
    reputationEngine.recordLoanRequest('borrower-001')
    reputationEngine.recordLoanRequest('borrower-001')
    reputationEngine.recordRepayment('borrower-001', 25)
    reputationEngine.recordRepayment('borrower-001', 25)
    reputationEngine.recordRepayment('borrower-001', 25)
    reputationEngine.recordRepayment('borrower-001', 50)
    const seededScores = reputationEngine.getAllScores()
    const seededBorrower = seededScores.find((s) => s.agentId === 'borrower-001')
    logger.info('Borrower seeded score', { agentId: 'borrower-001', score: seededBorrower?.score })
    logger.info('Reputation seeded. Borrower ready for autonomous loop.')

    // ─── Autonomous Loop — 3 cycles ───────────────────────────────────────
    for (let cycle = 1; cycle <= 3; cycle++) {
      const currentBlock = await walletManager.getBlockNumber()
      logger.info(`── Cycle ${cycle} / 3 — Block ${currentBlock} ──`)

      // STEP 1 — Borrower decides whether to borrow
      let loanRequest = await borrowerAgent.decideToBorrow()

      if (!loanRequest) {
        logger.info('Borrower decided not to borrow this cycle')
      } else {
        // STEP 2 — Lender evaluates the request
        const decision = await lenderAgent.evaluateLoanRequest(loanRequest)
        logger.agent('Lender decision', {
          approved: decision.approved,
          reason: decision.reason,
          interestRate: decision.interestRate,
          reasoning: decision.agentReasoning,
        })

        // STEP 3 — Issue the loan if approved
        if (decision.approved) {
          try {
            const loan = await lenderAgent.issueLoan(loanRequest, decision)
            if (loan) {
              arbiterAgent.registerLoan(loan)

              const fee = loanRequest.amount * config.protocolFeePercent / 100
              await arbiterAgent.collectProtocolFee(fee)
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.warn('Loan issuance failed (likely insufficient testnet funds)', {
              error: message,
            })
          }
        }
      }

      // STEP 4 — Arbiter monitors all active loans
      await arbiterAgent.monitorLoop(currentBlock)

      // STEP 5 — Log cycle stats
      const stats = arbiterAgent.getSystemStats()
      logger.info('Cycle stats', {
        totalLoansIssued: stats.totalLoansIssued,
        totalVolumeUSDT: stats.totalVolumeUSDT,
        totalFeesCollected: stats.totalFeesCollected,
        feesUsedForCompute: stats.feesUsedForCompute,
        activeLoans: stats.activeLoans,
      })

      if (cycle < 3) {
        logger.info('Waiting 2s before next cycle...')
        await sleep(2000)
      }
    }

    // ─── Final Summary ─────────────────────────────────────────────────────
    const finalStats = arbiterAgent.getSystemStats()
    logger.success('Final system stats', {
      totalLoansIssued: finalStats.totalLoansIssued,
      totalVolumeUSDT: finalStats.totalVolumeUSDT,
      totalFeesCollected: finalStats.totalFeesCollected,
      feesUsedForCompute: finalStats.feesUsedForCompute,
      activeLoans: finalStats.activeLoans,
      defaultRate: finalStats.defaultRate,
    })

    logger.success('AUTOBANK autonomous loop complete')
    logger.success('This system is self-sustaining — agents funded their own compute')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`FATAL: ${message}`)
    process.exit(1)
  }
}

main()
