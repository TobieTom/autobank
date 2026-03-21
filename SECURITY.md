# AUTOBANK Security Policy

## Critical Rules
1. NEVER commit .env files or any file containing private keys
2. NEVER hardcode wallet addresses, private keys, or API keys in source code
3. ALL secrets must be loaded from environment variables via dotenv
4. ALWAYS validate Ethereum addresses before any transaction
5. ALWAYS validate loan amounts are positive numbers within allowed range
6. ALWAYS use ethers.isAddress() before sending any transaction
7. Agent wallets are hot wallets for testnet only — never use on mainnet

## Environment Variables Required
See agents/.env.example for all required variables

## Reporting Issues
This is a hackathon project on testnet only.
