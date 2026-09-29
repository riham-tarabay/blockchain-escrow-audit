# Deployment and operations

## Local network

```bash
npm install
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

The deployment script records the contract address, network, chain ID, deployer, arbitrator, and timestamp in an ignored `deployments/` file. Use the printed address for event inspection.

## Testnet checklist

Before deploying to Sepolia, configure `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `ARBITRATOR_ADDRESS` through a secret manager or shell environment. Fund the deployer with test ETH, compile from a clean commit, inspect the contract bytecode and constructor parameters, deploy, and record the address and transaction hash. Verify the contract with the relevant explorer tooling if the testnet deployment is retained.

Never use a production private key in local development. Never commit a private key, seed phrase, RPC credential, or deployment file containing sensitive information.

## Post-deployment smoke test

1. Confirm the deployed chain ID and contract address.
2. Create and fund a small test escrow.
3. Confirm `EscrowCreated` and `EscrowFunded` events.
4. Complete and release the escrow, then withdraw with the seller wallet.
5. Run the event audit script over the deployment block range.
6. Confirm terminal status and payout balances.
7. Retain the deployment metadata and test transaction hashes with the release record.

This is a portfolio deployment procedure. It does not establish production readiness or authorize real-value deposits.
