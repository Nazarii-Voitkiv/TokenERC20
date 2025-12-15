import { expect } from "chai";
import { network } from "hardhat";

const NAME = "MyToken";
const SYMBOL = "MTK";
const INITIAL_SUPPLY_WHOLE = 1_000_000n;
const CLAIM_AMOUNT_WHOLE = 100n;

async function deployTokenFixture() {
  const { ethers } = await network.connect();
  const [owner, alice, bob, treasurySigner] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(NAME, SYMBOL, INITIAL_SUPPLY_WHOLE, CLAIM_AMOUNT_WHOLE);
  await token.waitForDeployment();

  return { token, owner, alice, bob, treasurySigner, ethers };
}

describe("MyToken", function () {
  describe("Deployment", function () {
    it("mints the full initial supply to the deployer", async function () {
      const { token, owner } = await deployTokenFixture();
      const decimals = BigInt(await token.decimals());
      const expectedSupply = INITIAL_SUPPLY_WHOLE * 10n ** decimals;

      expect(await token.totalSupply()).to.equal(expectedSupply);
      expect(await token.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("Claiming free tokens", function () {
    it("lets each address claim exactly once", async function () {
      const { token, alice, ethers } = await deployTokenFixture();
      const claimAmount = await token.CLAIM_AMOUNT();

      await expect(token.connect(alice).claimFreeTokens())
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, claimAmount);

      await expect(token.connect(alice).claimFreeTokens()).to.be.revertedWithCustomError(
        token,
        "AlreadyClaimed",
      );
    });
  });

  describe("Fee mechanics", function () {
    it("sends a percentage of transfers to the treasury when configured", async function () {
      const { token, owner, alice, bob, treasurySigner, ethers } =
        await deployTokenFixture();
      const decimals = BigInt(await token.decimals());
      const unit = 10n ** decimals;
      const fundingAmount = 1_000n * unit;
      const transferAmount = 100n * unit;
      const feeBps = 250n; // 2.5%
      const expectedFee = (transferAmount * feeBps) / 10_000n;

      await token.connect(owner).transfer(alice.address, fundingAmount);
      await token.connect(owner).setTreasury(treasurySigner.address);
      await token.connect(owner).setFeeBps(Number(feeBps));

      await token.connect(alice).transfer(bob.address, transferAmount);

      expect(await token.balanceOf(bob.address)).to.equal(
        transferAmount - expectedFee,
      );
      expect(await token.balanceOf(treasurySigner.address)).to.equal(
        expectedFee,
      );
    });

    it("rejects transfers above the configured max when fees apply", async function () {
      const { token, owner, alice, bob, treasurySigner, ethers } =
        await deployTokenFixture();
      const decimals = BigInt(await token.decimals());
      const unit = 10n ** decimals;
      const limit = 50n * unit;

      await token.connect(owner).transfer(alice.address, 2n * limit);
      await token.connect(owner).setTreasury(treasurySigner.address);
      await token.connect(owner).setFeeBps(100); // 1%
      await token.connect(owner).setMaxTransferAmount(limit);

      await expect(
        token.connect(alice).transfer(bob.address, limit + 1n),
      ).to.be.revertedWithCustomError(token, "TransferTooLarge");

      await expect(
        token.connect(alice).transfer(bob.address, limit),
      ).to.not.revert(ethers);
    });
  });

  describe("Pause and whitelist controls", function () {
    it("blocks transfers while paused, unless a party is whitelisted", async function () {
      const { token, owner, alice, bob, ethers } = await deployTokenFixture();
      const decimals = BigInt(await token.decimals());
      const unit = 10n ** decimals;
      const amount = 10n * unit;

      await token.connect(owner).transfer(alice.address, amount);
      await token.connect(owner).pause();

      await expect(
        token.connect(alice).transfer(bob.address, amount),
      ).to.be.revertedWithCustomError(token, "TokenPaused");

      await token.connect(owner).setWhitelisted([alice.address], true);
      await expect(
        token.connect(alice).transfer(bob.address, amount),
      ).to.not.revert(ethers);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
    });
  });
});
