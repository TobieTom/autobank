import { config } from './config'
import { Logger } from './logger'
import { WalletManager } from './walletManager'
import { ReputationEngine } from './reputationEngine'
import { LenderAgent } from './lenderAgent'
import { BorrowerAgent } from './borrowerAgent'
import { ArbiterAgent } from './arbiterAgent'
import { startWsServer, broadcastLog, broadcastStats } from './wsServer'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'

const logger = new Logger('AUTOBANK')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let loopActive = false

async function main(): Promise<void> {
  try {
    // Banner
    logger.info('╔════════════════════════════════════╗')
    logger.info('║     AUTOBANK PROTOCOL v1.0.0       ║')
    logger.info('║  Self-Sustaining Agent Lending     ║')
    logger.info('║  Tether WDK Hackathon Galactica    ║')
    logger.info('╚════════════════════════════════════╝')

    // Start WebSocket server and wire broadcaster into Logger
    startWsServer()
    Logger.setBroadcaster(broadcastLog)

    // Initialize infrastructure
    const walletManager = new WalletManager()
    const reputationEngine = new ReputationEngine()

    // Load persistent wallets from .env, or generate on first run and exit
    if (!config.lenderPrivateKey || !config.borrowerPrivateKey || !config.arbiterPrivateKey) {
      const lenderWallet = walletManager.createWallet()
      const borrowerWallet = walletManager.createWallet()
      const arbiterWallet = walletManager.createWallet()

      console.log('━━━ FIRST RUN: Wallet addresses generated ━━━')

      // Write private keys to local file (NEVER commit this file)
      const keysContent = `# AUTOBANK WALLET KEYS — NEVER COMMIT THIS FILE
# Generated: ${new Date().toISOString()}
# IMPORTANT: Delete this file after adding keys to .env
LENDER_PRIVATE_KEY=${lenderWallet.privateKey}
BORROWER_PRIVATE_KEY=${borrowerWallet.privateKey}
ARBITER_PRIVATE_KEY=${arbiterWallet.privateKey}
LENDER_ADDRESS=${lenderWallet.address}
BORROWER_ADDRESS=${borrowerWallet.address}
ARBITER_ADDRESS=${arbiterWallet.address}
`
      const keysFilePath = path.join(process.cwd(), 'wallet-keys.txt')
      fs.writeFileSync(keysFilePath, keysContent)

      // Print only addresses to console — NEVER print private keys
      console.log('✓ Wallet addresses generated:')
      console.log(`  Lender:   ${lenderWallet.address}`)
      console.log(`  Borrower: ${borrowerWallet.address}`)
      console.log(`  Arbiter:  ${arbiterWallet.address}`)
      console.log('')
      console.log('✓ Private keys saved to: wallet-keys.txt')
      console.log('  ⚠️  NEVER commit wallet-keys.txt to git!')
      console.log('  ⚠️  Copy the keys to agents/.env')
      console.log('  ⚠️  Delete wallet-keys.txt after use')
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

    logger.info('✓ All agents initialized. Waiting for activation...')

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
    logger.info('Reputation seeded. Awaiting activation...')

    // ─── Start HTTP server for /activate endpoint ──────
    const PORT = process.env.PORT || 3001
    const httpServer = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/activate') {
        if (loopActive) {
          res.writeHead(409, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'already_active' }))
          return
        }
        loopActive = true
        logger.info('✓ Activation received — starting autonomous loop')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'activated' }))
        // Start loop in background
        runAutonomousLoop(walletManager, reputationEngine, lenderAgent, borrowerAgent, arbiterAgent, lenderWallet)
        return
      }
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: loopActive ? 'active' : 'standby' }))
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    })

    httpServer.listen(PORT, () => {
      logger.info(`HTTP server listening on port ${PORT}`)
    })

    return // Exit main, wait for /activate to trigger loop
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`FATAL: ${message}`)
    process.exit(1)
  }
}

async function runAutonomousLoop(
  walletManager: WalletManager,
  reputationEngine: ReputationEngine,
  lenderAgent: LenderAgent,
  borrowerAgent: BorrowerAgent,
  arbiterAgent: ArbiterAgent,
  lenderWallet: any
): Promise<void> {
  let cycle = 0
  while (loopActive) {
    cycle++
    try {
      const currentBlock = await walletManager.getBlockNumber()
      logger.info(`── Cycle ${cycle} — Block ${currentBlock} ──`)

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

              // STEP 3.5 — Borrower repays the loan
              logger.info('Waiting 3s before repayment...')
              await sleep(3000)

              const repaymentSuccess = await borrowerAgent.repayLoan(loan, lenderWallet.address)
              if (repaymentSuccess) {
                logger.success('Loan repayment confirmed', {
                  loanId: loan.id,
                  borrower: borrowerWallet.address,
                  lender: lenderWallet.address,
                  amount: loan.request.amount,
                })
              } else {
                logger.error('Loan repayment failed — will retry in next cycle', {
                  loanId: loan.id,
                })
              }
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

      broadcastStats(stats)

      logger.info('Waiting 5 minutes before next cycle...')
      await sleep(300000) // 5 minutes
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Loop error: ${message}`)
    }
  }
  loopActive = false
  logger.info('Autonomous loop stopped')
}

main()
