const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ONE_ETH = ethers.parseEther("1");

async function deployFixture() {
  const [buyer, seller, arbitrator, other] = await ethers.getSigners();
  const escrow = await ethers.deployContract("Escrow", [arbitrator.address]);
  await escrow.waitForDeployment();
  return { escrow, buyer, seller, arbitrator, other };
}

async function createFundedFixture() {
  const state = await deployFixture();
  const deadline = (await time.latest()) + 3600;
  await state.escrow.connect(state.buyer).createEscrow(state.seller.address, deadline);
  await state.escrow.connect(state.buyer).fundEscrow(0, { value: ONE_ETH });
  return { ...state, deadline };
}

describe("Escrow", function () {
  describe("construction and creation", function () {
    it("stores the arbitrator", async function () {
      const { escrow, arbitrator } = await loadFixture(deployFixture);
      expect(await escrow.arbitrator()).to.equal(arbitrator.address);
      expect(await escrow.nextEscrowId()).to.equal(0);
    });

    it("rejects a zero arbitrator", async function () {
      await expect(ethers.deployContract("Escrow", [ethers.ZeroAddress]))
        .to.be.reverted;
    });

    it("creates an escrow and emits an audit event", async function () {
      const { escrow, buyer, seller } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(escrow.connect(buyer).createEscrow(seller.address, deadline))
        .to.emit(escrow, "EscrowCreated")
        .withArgs(0, buyer.address, seller.address, deadline);
      const record = await escrow.getEscrow(0);
      expect(record.buyer).to.equal(buyer.address);
      expect(record.seller).to.equal(seller.address);
      expect(record.amount).to.equal(0);
      expect(record.status).to.equal(0);
    });

    it("rejects a zero seller", async function () {
      const { escrow, buyer } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(escrow.connect(buyer).createEscrow(ethers.ZeroAddress, deadline))
        .to.be.revertedWithCustomError(escrow, "InvalidSeller");
    });

    it("rejects the buyer as seller", async function () {
      const { escrow, buyer } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await expect(escrow.connect(buyer).createEscrow(buyer.address, deadline))
        .to.be.revertedWithCustomError(escrow, "InvalidSeller");
    });

    it("rejects a past deadline", async function () {
      const { escrow, buyer, seller } = await loadFixture(deployFixture);
      await expect(escrow.connect(buyer).createEscrow(seller.address, 1))
        .to.be.revertedWithCustomError(escrow, "InvalidDeadline");
    });

    it("rejects an unknown escrow id", async function () {
      const { escrow } = await loadFixture(deployFixture);
      await expect(escrow.getEscrow(99))
        .to.be.revertedWithCustomError(escrow, "InvalidEscrow")
        .withArgs(99);
    });
  });

  describe("funding", function () {
    it("allows only the buyer to fund once", async function () {
      const { escrow, buyer, seller, other } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await escrow.connect(buyer).createEscrow(seller.address, deadline);
      await expect(escrow.connect(other).fundEscrow(0, { value: ONE_ETH }))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
      await expect(escrow.connect(buyer).fundEscrow(0, { value: ONE_ETH }))
        .to.emit(escrow, "EscrowFunded").withArgs(0, ONE_ETH);
      await expect(escrow.connect(buyer).fundEscrow(0, { value: ONE_ETH }))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("rejects zero-value funding", async function () {
      const { escrow, buyer, seller } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 3600;
      await escrow.connect(buyer).createEscrow(seller.address, deadline);
      await expect(escrow.connect(buyer).fundEscrow(0))
        .to.be.revertedWithCustomError(escrow, "ZeroValue");
    });

    it("rejects funding after the deadline", async function () {
      const { escrow, buyer, seller } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 60;
      await escrow.connect(buyer).createEscrow(seller.address, deadline);
      await time.increaseTo(deadline);
      await expect(escrow.connect(buyer).fundEscrow(0, { value: ONE_ETH }))
        .to.be.revertedWithCustomError(escrow, "DeadlinePassed");
    });
  });

  describe("completion and release", function () {
    it("allows only the seller to mark work complete", async function () {
      const { escrow, buyer, seller, other } = await loadFixture(createFundedFixture);
      await expect(escrow.connect(other).markWorkComplete(0))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
      await expect(escrow.connect(seller).markWorkComplete(0))
        .to.emit(escrow, "WorkCompleted").withArgs(0);
      expect((await escrow.getEscrow(0)).status).to.equal(2);
      expect(buyer.address).to.be.properAddress;
    });

    it("requires completion before buyer release", async function () {
      const { escrow, buyer } = await loadFixture(createFundedFixture);
      await expect(escrow.connect(buyer).release(0))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("credits seller using pull-based settlement", async function () {
      const { escrow, buyer, seller } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).markWorkComplete(0);
      await expect(escrow.connect(buyer).release(0))
        .to.emit(escrow, "EscrowReleased")
        .withArgs(0, seller.address, ONE_ETH);
      expect(await escrow.withdrawable(seller.address)).to.equal(ONE_ETH);
      expect((await escrow.getEscrow(0)).status).to.equal(4);
    });

    it("allows the seller to withdraw exactly once", async function () {
      const { escrow, buyer, seller } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).markWorkComplete(0);
      await escrow.connect(buyer).release(0);
      await expect(escrow.connect(seller).withdraw())
        .to.changeEtherBalance(seller, ONE_ETH);
      await expect(escrow.connect(seller).withdraw())
        .to.be.revertedWithCustomError(escrow, "NothingToWithdraw");
    });

    it("prevents unauthorized and duplicate release", async function () {
      const { escrow, buyer, seller, other } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).markWorkComplete(0);
      await expect(escrow.connect(other).release(0))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
      await escrow.connect(buyer).release(0);
      await expect(escrow.connect(buyer).release(0))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("disputes", function () {
    it("allows buyer or seller to open a dispute", async function () {
      const { escrow, buyer, seller } = await loadFixture(createFundedFixture);
      await expect(escrow.connect(seller).openDispute(0))
        .to.emit(escrow, "DisputeOpened").withArgs(0, seller.address);
      expect((await escrow.getEscrow(0)).status).to.equal(3);
      await expect(escrow.connect(buyer).openDispute(0))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("rejects dispute opening by a third party", async function () {
      const { escrow, other } = await loadFixture(createFundedFixture);
      await expect(escrow.connect(other).openDispute(0))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("allows the arbitrator to release disputed funds", async function () {
      const { escrow, buyer, seller, arbitrator } = await loadFixture(createFundedFixture);
      await escrow.connect(buyer).openDispute(0);
      await expect(escrow.connect(arbitrator).resolveDispute(0, true))
        .to.emit(escrow, "DisputeResolved").withArgs(0, true);
      expect(await escrow.withdrawable(seller.address)).to.equal(ONE_ETH);
      expect((await escrow.getEscrow(0)).status).to.equal(4);
    });

    it("allows the arbitrator to refund disputed funds", async function () {
      const { escrow, buyer, seller, arbitrator } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).openDispute(0);
      await expect(escrow.connect(arbitrator).resolveDispute(0, false))
        .to.emit(escrow, "DisputeResolved").withArgs(0, false);
      expect(await escrow.withdrawable(buyer.address)).to.equal(ONE_ETH);
      expect((await escrow.getEscrow(0)).status).to.equal(5);
    });

    it("rejects non-arbitrator resolution", async function () {
      const { escrow, buyer, seller, other } = await loadFixture(createFundedFixture);
      await escrow.connect(buyer).openDispute(0);
      await expect(escrow.connect(other).resolveDispute(0, true))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
      await expect(escrow.connect(seller).resolveDispute(0, false))
        .to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("rejects resolving a non-disputed escrow", async function () {
      const { escrow, arbitrator } = await loadFixture(createFundedFixture);
      await expect(escrow.connect(arbitrator).resolveDispute(0, true))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("expiry refunds", function () {
    it("rejects refund before the deadline", async function () {
      const { escrow } = await loadFixture(createFundedFixture);
      await expect(escrow.refundExpired(0))
        .to.be.revertedWithCustomError(escrow, "DeadlineNotReached");
    });

    it("refunds funded escrow after expiry", async function () {
      const { escrow, buyer, deadline } = await loadFixture(createFundedFixture);
      await time.increaseTo(deadline);
      await expect(escrow.connect(buyer).refundExpired(0))
        .to.emit(escrow, "EscrowRefunded")
        .withArgs(0, buyer.address, ONE_ETH);
      expect(await escrow.withdrawable(buyer.address)).to.equal(ONE_ETH);
      expect((await escrow.getEscrow(0)).status).to.equal(5);
    });

    it("allows anyone to trigger an expired refund", async function () {
      const { escrow, other, deadline } = await loadFixture(createFundedFixture);
      await time.increaseTo(deadline);
      await escrow.connect(other).refundExpired(0);
      expect((await escrow.getEscrow(0)).status).to.equal(5);
    });

    it("rejects refund after final settlement", async function () {
      const { escrow, buyer, seller, deadline } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).markWorkComplete(0);
      await escrow.connect(buyer).release(0);
      await time.increaseTo(deadline);
      await expect(escrow.refundExpired(0))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("payment safety", function () {
    it("rejects direct ETH transfers", async function () {
      const { escrow, buyer } = await loadFixture(deployFixture);
      await expect(buyer.sendTransaction({ to: await escrow.getAddress(), value: 1 }))
        .to.be.revertedWithCustomError(escrow, "DirectTransferNotAllowed");
    });

    it("emits a withdrawal audit event", async function () {
      const { escrow, buyer, seller } = await loadFixture(createFundedFixture);
      await escrow.connect(seller).markWorkComplete(0);
      await escrow.connect(buyer).release(0);
      await expect(escrow.connect(seller).withdraw())
        .to.emit(escrow, "Withdrawal").withArgs(seller.address, ONE_ETH);
    });

    it("does not expose a payout to an empty account", async function () {
      const { escrow, other } = await loadFixture(deployFixture);
      await expect(escrow.connect(other).withdraw())
        .to.be.revertedWithCustomError(escrow, "NothingToWithdraw");
    });
  });
});
