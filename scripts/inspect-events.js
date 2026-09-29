const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const address = process.env.ESCROW_ADDRESS;
  if (!address) throw new Error("Set ESCROW_ADDRESS before running the audit command");
  const escrow = await hre.ethers.getContractAt("Escrow", address);
  const fromBlock = Number(process.env.FROM_BLOCK || 0);
  const toBlock = process.env.TO_BLOCK ? Number(process.env.TO_BLOCK) : "latest";
  const filters = [
    "EscrowCreated",
    "EscrowFunded",
    "WorkCompleted",
    "DisputeOpened",
    "EscrowReleased",
    "EscrowRefunded",
    "DisputeResolved",
    "Withdrawal"
  ];
  const events = [];
  for (const name of filters) {
    const logs = await escrow.queryFilter(escrow.filters[name](), fromBlock, toBlock);
    for (const log of logs) {
      events.push({
        event: name,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        args: Object.fromEntries(
          log.fragment.inputs.map((input, index) => [input.name, log.args[index]])
        )
      });
    }
  }
  events.sort((left, right) => left.blockNumber - right.blockNumber);
  const output = path.join(process.cwd(), "audit-output.json");
  fs.writeFileSync(
    output,
    `${JSON.stringify(events, (_, value) => typeof value === "bigint" ? value.toString() : value, 2)}\n`
  );
  console.log(JSON.stringify({ address, fromBlock, toBlock, eventCount: events.length, output }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
