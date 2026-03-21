/**
 * AUTOBANK WalletManager — Security-Critical Wallet Operations
 * Handles Ethereum wallet creation, balance queries, and USDT transfers
 * on Sepolia testnet using Ethers.js v6.
 *
 * SECURITY RULES:
 * - Private keys and mnemonics are NEVER logged
 * - All addresses validated with ethers.isAddress() before use
 * - All amounts validated as positive finite numbers within limits
 * - Private keys must match /^0x[0-9a-fA-F]{64}$/ before use
 */

import { ethers } from 'ethers'
import { config } from './config'
import { Logger } from './logger'

export interface WalletInfo {
  address: string
  privateKey: string
  mnemonic?: string
}

// Minimal ERC-20 ABI — only the functions we need
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

// USDT on Sepolia uses 6 decimals (mirrors mainnet)
const USDT_DECIMALS = 6

// Private key format: 0x followed by exactly 64 hex characters
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/

export class WalletManager {
  private provider: ethers.JsonRpcProvider
  private logger: Logger

  constructor() {
    this.logger = new Logger('WalletManager')

    // Use staticNetwork to avoid repeated eth_chainId calls
    // Safe here because we control the endpoint and chain never changes
    this.provider = new ethers.JsonRpcProvider(
      config.rpcUrlSepolia,
      ethers.Network.from(config.chainId),
      { staticNetwork: ethers.Network.from(config.chainId) }
    )

    this.logger.info('Provider initialized', {
      chainId: config.chainId,
      endpoint: config.rpcUrlSepolia.substring(0, 40) + '...',
    })
  }

  /**
   * Generate a brand new random Ethereum wallet.
   * Returns address, privateKey, and mnemonic.
   * NEVER logs the private key or mnemonic.
   */
  createWallet(): WalletInfo {
    const wallet = ethers.Wallet.createRandom()
    const info: WalletInfo = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
    }

    // Log address only — never privateKey or mnemonic
    this.logger.success('New wallet created', { address: wallet.address })

    return info
  }

  /**
   * Load an existing wallet from a private key and connect to Sepolia.
   * Validates private key format before use.
   */
  loadWallet(privateKey: string): ethers.Wallet {
    if (!PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        'Invalid private key format. Must be 0x followed by 64 hex characters.'
      )
    }

    const wallet = new ethers.Wallet(privateKey, this.provider)
    this.logger.info('Wallet loaded', { address: wallet.address })
    return wallet
  }

  /**
   * Get ETH balance for an address as a human-readable string.
   * Returns "0.0" on any error — never throws.
   */
  async getEthBalance(address: string): Promise<string> {
    try {
      if (!ethers.isAddress(address)) {
        this.logger.warn('getEthBalance: invalid address', { address })
        return '0.0'
      }

      const balanceWei = await this.provider.getBalance(address)
      const balance = ethers.formatEther(balanceWei)
      return balance
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn('getEthBalance failed', { address, error: message })
      return '0.0'
    }
  }

  /**
   * Get USDT balance for an address as a human-readable string.
   * Uses USDT contract from config. Returns "0.0" on error — never throws.
   */
  async getUsdtBalance(address: string): Promise<string> {
    try {
      if (!ethers.isAddress(address)) {
        this.logger.warn('getUsdtBalance: invalid address', { address })
        return '0.0'
      }

      const contract = new ethers.Contract(
        config.usdtContractSepolia,
        ERC20_ABI,
        this.provider
      )

      const rawBalance: bigint = await contract['balanceOf'](address)
      const balance = ethers.formatUnits(rawBalance, USDT_DECIMALS)
      return balance
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn('getUsdtBalance failed', { address, error: message })
      return '0.0'
    }
  }

  /**
   * Send USDT from one address to another.
   * Returns transaction hash on success.
   *
   * SECURITY validations:
   * - toAddress validated with ethers.isAddress()
   * - amount must be a positive finite number within maxLoanAmountUsdt
   * - fromPrivateKey must match private key regex
   * - private key is NEVER logged
   */
  async sendUsdt(
    fromPrivateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    // Validate private key format
    if (!PRIVATE_KEY_REGEX.test(fromPrivateKey)) {
      throw new Error('sendUsdt: invalid fromPrivateKey format')
    }

    // Validate destination address
    if (!ethers.isAddress(toAddress)) {
      throw new Error(`sendUsdt: invalid toAddress "${toAddress}"`)
    }

    // Validate amount
    const amountNum = parseFloat(amount)
    if (!isFinite(amountNum) || amountNum <= 0) {
      throw new Error(`sendUsdt: amount must be a positive number, got "${amount}"`)
    }
    if (amountNum > config.maxLoanAmountUsdt) {
      throw new Error(
        `sendUsdt: amount ${amountNum} exceeds maxLoanAmountUsdt ` +
        `(${config.maxLoanAmountUsdt})`
      )
    }

    try {
      const signer = new ethers.Wallet(fromPrivateKey, this.provider)
      const contract = new ethers.Contract(
        config.usdtContractSepolia,
        ERC20_ABI,
        signer
      )

      const parsedAmount = ethers.parseUnits(amount, USDT_DECIMALS)
      const tx = await contract['transfer'](toAddress, parsedAmount)

      // Log TX details — never log fromPrivateKey
      this.logger.tx('USDT transfer submitted', tx.hash, {
        from: signer.address,
        to: toAddress,
        amount,
        currency: 'USDT',
      })

      await tx.wait()

      this.logger.tx('USDT transfer confirmed', tx.hash, {
        from: signer.address,
        to: toAddress,
        amount,
      })

      return tx.hash as string
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`sendUsdt failed: ${message}`)
    }
  }

  /**
   * Get the current Sepolia block number.
   * Used for wallet age calculation in the reputation engine.
   */
  async getBlockNumber(): Promise<number> {
    const block = await this.provider.getBlockNumber()
    return block
  }

  /**
   * Estimate how many blocks ago an address first appeared on-chain.
   * Uses transaction count as a proxy: if nonce > 0 the wallet has history.
   * Returns 0 if address has no transactions (brand new wallet).
   * Never throws.
   */
  async getWalletAgeBlocks(address: string): Promise<number> {
    try {
      if (!ethers.isAddress(address)) {
        this.logger.warn('getWalletAgeBlocks: invalid address', { address })
        return 0
      }

      const [currentBlock, nonce] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getTransactionCount(address),
      ])

      if (nonce === 0) {
        // Brand new wallet — no on-chain history
        return 0
      }

      // Without an indexer we cannot know the exact first-tx block.
      // Return current block as a conservative upper-bound proxy,
      // indicating the wallet has *some* age but we cannot quantify it.
      return currentBlock
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn('getWalletAgeBlocks failed', { address, error: message })
      return 0
    }
  }
}

export default WalletManager
