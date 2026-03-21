import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

interface Config {
  groqApiKey: string
  rpcUrlSepolia: string
  chainId: number
  usdtContractSepolia: string
  protocolFeePercent: number
  maxLoanAmountUsdt: number
  minReputationScore: number
  port: number
  logLevel: string
  nodeEnv: string
  lenderPrivateKey: string | undefined
  borrowerPrivateKey: string | undefined
  arbiterPrivateKey: string | undefined
  lenderAddress: string | undefined
  borrowerAddress: string | undefined
  arbiterAddress: string | undefined
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    throw new Error(
      `SECURITY ERROR: Missing required environment variable: ${key}\n` +
      `Copy agents/.env.example to agents/.env and fill in all values.`
    )
  }
  return value.trim()
}

function requireEnvNumber(key: string): number {
  const value = requireEnv(key)
  const num = parseFloat(value)
  if (isNaN(num)) {
    throw new Error(
      `CONFIG ERROR: Environment variable ${key} must be a ` +
      `number, got: ${value}`
    )
  }
  return num
}

export const config: Config = {
  groqApiKey: requireEnv('GROQ_API_KEY'),
  rpcUrlSepolia: requireEnv('RPC_URL_SEPOLIA'),
  chainId: requireEnvNumber('CHAIN_ID'),
  usdtContractSepolia: requireEnv('USDT_CONTRACT_SEPOLIA'),
  protocolFeePercent: requireEnvNumber('PROTOCOL_FEE_PERCENT'),
  maxLoanAmountUsdt: requireEnvNumber('MAX_LOAN_AMOUNT_USDT'),
  minReputationScore: requireEnvNumber('MIN_REPUTATION_SCORE'),
  port: requireEnvNumber('PORT'),
  logLevel: requireEnv('LOG_LEVEL'),
  nodeEnv: requireEnv('NODE_ENV'),
  lenderPrivateKey: process.env['LENDER_PRIVATE_KEY'] || undefined,
  borrowerPrivateKey: process.env['BORROWER_PRIVATE_KEY'] || undefined,
  arbiterPrivateKey: process.env['ARBITER_PRIVATE_KEY'] || undefined,
  lenderAddress: process.env['LENDER_ADDRESS'] || undefined,
  borrowerAddress: process.env['BORROWER_ADDRESS'] || undefined,
  arbiterAddress: process.env['ARBITER_ADDRESS'] || undefined,
}

export default config
