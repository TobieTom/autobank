# AUTOBANK
## Self-Sustaining AI Agent Lending Protocol

> Built on Tether WDK for Hackathon Galactica: WDK Edition 1

### What is AUTOBANK?
AUTOBANK is an autonomous lending protocol where AI agents hold
real wallets, issue USDT loans, score borrower reputation on-chain,
collect protocol fees, and use those fees to pay their own compute
costs — running indefinitely without human intervention.

### Architecture
- **Lender Agent** — Evaluates reputation scores, issues USDT loans via WDK
- **Borrower Agent** — Requests loans, executes tasks, repays autonomously
- **Arbiter Agent** — Monitors repayments, handles disputes, triggers collections
- **Reputation Engine** — On-chain scoring: wallet age + repayment history + volume
- **Self-Sustaining Loop** — Protocol fees → Groq API compute costs → agents keep running

### Tech Stack
- Tether WDK (wallet creation, USDT transfers, multi-chain)
- Ethers.js v6 (blockchain interaction)
- Groq + LLaMA 3 (agent reasoning — open source LLM for bonus points)
- Next.js 14 + TypeScript (real-time dashboard)
- Sepolia testnet (development and demo)

### Security
- All private keys stored in .env only — never committed to git
- Input validation on all loan amounts and addresses
- Rate limiting on agent actions
- Reputation system prevents bad actors

### Hackathon Track
Primary: Lending Bot
Secondary: Best Overall
