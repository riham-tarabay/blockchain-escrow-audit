const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const arbitrator = process.env.ARBITRATOR_ADDRESS || deployer.address;
  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(arbitrator);
  await escrow.waitForDeployment();

  const deployment = {
    contract: "Escrow",
    address: await escrow.getAddress(),
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    arbitrator,
    deployedAt: new Date().toISOString()
  };
  const output = path.join(process.cwd(), "deployments");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, `${network.name}.json`), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
