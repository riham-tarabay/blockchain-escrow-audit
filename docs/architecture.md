# Architecture and trust boundaries

```text
Buyer wallet ─┐
              ├──> Escrow smart contract ───> escrow state and ETH balance
Seller wallet ─┘             │
                              ├──> lifecycle events
Arbitrator wallet ────────────┘

Operator / audit CLI ────────> event logs and transaction hashes
```

The contract is the source of truth for escrow state, balances, roles, deadlines, and settlement decisions. The buyer and seller control normal workflow actions. The arbitrator is a trusted dispute-resolution role and can resolve only escrows already marked `Disputed`. The audit CLI is read-only and reconstructs history from emitted events; it cannot mutate contract state.

Funds use a pull-based model. Release and refund operations only update the contract's `withdrawable` ledger. The payee later calls `withdraw`, which performs the external ETH transfer under `nonReentrant`. This limits reentrancy exposure and keeps settlement state changes separate from wallet behavior.

The contract intentionally avoids arbitrary callbacks, token integrations, upgradeability, and external price/oracle dependencies. Those omissions reduce the demonstration's attack surface and keep the state machine auditable.
