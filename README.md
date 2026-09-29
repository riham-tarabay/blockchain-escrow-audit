# Blockchain Escrow and Audit Platform

A security-aware Solidity escrow workflow demonstrating smart-contract state management, role-based access control, pull-based ETH settlement, dispute resolution, deadline refunds, event-driven auditability, automated testing, and reproducible deployment.

> **Important:** This is an educational portfolio project. It has not been professionally audited and must not be used to hold real funds or process production payments.

## Concrete engineering example

A buyer creates and funds an escrow for a seller. The seller marks the work complete, after which the buyer can release the funds. Either party can open a dispute before settlement, and a designated arbitrator can release the funds or refund the buyer. If the deadline expires while the escrow is funded or completed, anyone can trigger a buyer refund. Funds are credited to a pull-payment ledger and withdrawn separately, so settlement does not make an external payment call.

Every lifecycle transition emits an event. The audit script reconstructs an ordered event history with block numbers and transaction hashes, providing a simple immutable audit trail for an operator or support workflow.

## Technology

- Solidity 0.8.24
- Hardhat and ethers.js
- OpenZeppelin `ReentrancyGuard`
- Chai/Mocha contract tests
- Node.js scripts for deployment and event inspection
- GitHub Actions CI

## State machine

| Current state | Action | Caller | Next state |
|---|---|---|---|
| Created | `fundEscrow` | Buyer | Funded |
| Funded | `markWorkComplete` | Seller | Completed |
| Completed | `release` | Buyer | Released |
| Funded/Completed | `openDispute` | Buyer or seller | Disputed |
| Disputed | `resolveDispute` | Arbitrator | Released or Refunded |
| Funded/Completed | `refundExpired` after deadline | Anyone | Refunded |
| Released/Refunded | `withdraw` | Payee | Final |

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm test
npm run compile
npm run lint
npm run deploy:local
```

The local deployment writes an ignored network record under `deployments/`. No private keys are required for the in-memory Hardhat network.

To run a persistent local node and inspect events:

```bash
npx hardhat node
# In another terminal:
npm run deploy:local -- --network localhost
# Run the deterministic create/fund/complete/release flow:
ESCROW_ADDRESS=0x_DEPLOYED_ADDRESS npm run demo:local
# Export named event arguments and transaction hashes:
ESCROW_ADDRESS=0x_DEPLOYED_ADDRESS npm run audit:events
```

For Sepolia, copy `.env.example` to `.env`, load secrets through your shell or a secret manager, and run:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Never commit `DEPLOYER_PRIVATE_KEY`, RPC credentials, or wallet seed phrases. The deployment script records the network, chain ID, deployer, arbitrator, contract address, and deployment time.

## Security controls demonstrated

The contract uses explicit state transitions, custom errors, zero-address and deadline validation, role checks, a designated arbitrator, checks-effects-interactions ordering, pull-based withdrawals, and OpenZeppelin's `ReentrancyGuard` on the external payment function. Direct ETH transfers and unknown function calls are rejected. Settlement statuses prevent double release and double refund.

The test suite covers functional flows, authorization, invalid state transitions, deadline behavior, duplicate settlement, direct-transfer rejection, payout accounting, and withdrawal behavior. It is a project test suite, not a substitute for professional smart-contract auditing, formal verification, or an economic/security review.

## Repository guide

- [`contracts/Escrow.sol`](contracts/Escrow.sol) — escrow state machine and events
- [`test/Escrow.js`](test/Escrow.js) — automated contract tests
- [`scripts/deploy.js`](scripts/deploy.js) — local/testnet deployment metadata
- [`scripts/inspect-events.js`](scripts/inspect-events.js) — event-based audit export
- [`docs/architecture.md`](docs/architecture.md) — design decisions and trust boundaries
- [`docs/threat-model.md`](docs/threat-model.md) — threat model and mitigations
- [`docs/deployment.md`](docs/deployment.md) — deployment and operational checklist
- [`docs/audit-notes.md`](docs/audit-notes.md) — scope, limitations, and manual review checklist

## Portfolio positioning

This project demonstrates hands-on blockchain engineering capability: Solidity contract design, state-machine reasoning, access control, event schemas, security-conscious payment flows, automated testing, and deployment documentation. It should be presented as a **Blockchain Development Portfolio Project**, not as evidence of three years of professional blockchain employment.
