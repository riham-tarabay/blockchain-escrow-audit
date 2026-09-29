const hre = require("hardhat");

async function main() {
  const address = process.env.ESCROW_ADDRESS;
  if (!address) throw new Error("Set ESCROW_ADDRESS before running the demo flow");
  const [buyer, seller] = await hre.ethers.getSigners();
  const escrow = await hre.ethers.getContractAt("Escrow", address);
  const latest = (await hre.ethers.provider.getBlock("latest")).timestamp;
  const deadline = latest + 3600;

  const create = await escrow.connect(buyer).createEscrow(seller.address, deadline);
  await create.wait();
  const fund = await escrow.connect(buyer).fundEscrow(0, { value: hre.ethers.parseEther("0.1") });
  await fund.wait();
  const complete = await escrow.connect(seller).markWorkComplete(0);
  await complete.wait();
  const release = await escrow.connect(buyer).release(0);
  await release.wait();

  console.log(JSON.stringify({
    escrowAddress: address,
    escrowId: 0,
    buyer: buyer.address,
    seller: seller.address,
    status: (await escrow.getEscrow(0)).status.toString(),
    sellerWithdrawable: (await escrow.withdrawable(seller.address)).toString(),
    transactions: [create.hash, fund.hash, complete.hash, release.hash]
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
