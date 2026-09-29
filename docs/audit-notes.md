# Audit notes and limitations

This repository contains a self-review checklist, not a professional audit. The contract must not hold real funds.

## Manual review checklist

- Verify every external function has an explicit caller and state precondition.
- Verify state is updated before the external ETH call in `withdraw`.
- Verify every terminal state is unreachable through a second settlement path.
- Verify all payout amounts are represented in `withdrawable` and cannot be claimed twice.
- Verify custom errors and events describe operational failures and transitions.
- Verify deadlines are checked at creation, funding, and expiry.
- Verify arbitrator authority is explicit and documented as a trust assumption.
- Run tests, compiler output, and static analysis from a clean checkout.
- Review compiler and npm dependency advisories before any release.
- Use an independent auditor and formal review before handling real funds.

## Known limitations

The contract uses native ETH only, has a centralized arbitrator, does not verify off-chain work completion, and has no upgrade mechanism. It does not provide legal escrow guarantees, identity verification, oracle integrations, formal verification, or an economic security analysis. The test suite improves confidence in the demonstrated behavior but cannot prove the absence of vulnerabilities.
