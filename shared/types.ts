// ============================================
// AUTOBANK — Core Type Definitions
// Shared across agents and frontend
// ============================================

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'repaid'
  | 'defaulted'

export type AgentType = 'lender' | 'borrower' | 'arbiter'

export type Currency = 'USDT'

export interface AgentWallet {
  id: string
  address: string
  balance: number
  chain: string
  createdAt: number
}

export interface LoanRequest {
  id: string
  borrowerAddress: string
  borrowerAgentId: string
  amount: number
  currency: Currency
  durationBlocks: number
  requestedAt: number
  status: LoanStatus
}

export interface Loan {
  id: string
  request: LoanRequest
  lenderAddress: string
  interestRate: number
  dueBlock: number
  issuedAt: number
  repaidAt?: number
  txHash: string
  status: 'active' | 'repaid' | 'defaulted'
}

export interface ReputationScore {
  agentId: string
  address: string
  score: number
  loansRequested: number
  loansRepaid: number
  loansDefaulted: number
  totalVolumeUSDT: number
  walletAgeBlocks: number
  lastUpdated: number
}

export interface AgentAction {
  id: string
  agentId: string
  agentType: AgentType
  action: string
  details: string
  timestamp: number
  txHash?: string
  amount?: number
}

export interface SystemStats {
  totalLoansIssued: number
  totalVolumeUSDT: number
  totalFeesCollected: number
  feesUsedForCompute: number
  activeLoans: number
  defaultRate: number
  protocolBalance: number
  lastComputePayment: number
}

export interface LoanDecision {
  approved: boolean
  reason: string
  interestRate: number
  maxAmount: number
  agentReasoning: string
}

export interface ComputePayment {
  id: string
  amount: number
  currency: Currency
  fromAddress: string
  toAddress: string
  purpose: string
  txHash: string
  timestamp: number
}
