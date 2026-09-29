# Threat model

## Assets

The primary assets are escrowed ETH, the integrity of escrow status, the identity of buyer/seller/arbitrator roles, and the event history used for operational audit.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Unauthorized funding, release, or dispute resolution | Buyer/seller/arbitrator checks on every role-specific function | A compromised authorized wallet can still act within its role |
| Double release or refund | Explicit terminal statuses and `_settle` transition | Contract policy is intentionally simple and non-upgradeable |
| Reentrancy during payout | Pull-based ledger and OpenZeppelin `ReentrancyGuard` on `withdraw` | Wallet-level behavior and gas griefing still require operational handling |
| ETH sent to the wrong function | Reverting `receive` and `fallback` handlers | Users must still choose the intended function and chain |
| Funding after deadline | Deadline check on creation and funding | Block timestamps have miner/validator tolerances |
| Buyer or seller disputes | Either party can open one dispute; arbitrator resolves | Arbitrator is a trusted centralized role in this demo |
| Event-history omission | Events emitted for every lifecycle and withdrawal action | Logs are append-only but operator tooling must query the correct block range |
| Malformed configuration | Zero-address checks, deadline checks, custom errors | No formal verification or external audit has been performed |

## Out of scope

This project does not address legal escrow obligations, identity/KYC, sanctions screening, oracle-based delivery proof, ERC-20 token behavior, upgrade governance, cross-chain messaging, MEV, chain reorganization policy, or production key custody. A real deployment would require independent security review, operational controls, legal review, and a threat model tailored to the business process.
