import { expect } from "chai";
import { network } from "hardhat";

const INITIAL_SUPPLY_WHOLE = 1_000_000n;
const CLAIM_AMOUNT_WHOLE = 100n;
const REWARD_RATE = 1_000_000_000_000_000_000n; // 1 token per second (18 decimals)
const REWARD_FUND = 10_000n;
const SEED_BALANCE = 1_000n;

async function deployStakingFixture() {
  const { ethers } = await network.connect();
  const [owner, alice, bob] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(
    "MyToken",
    "MTK",
    INITIAL_SUPPLY_WHOLE,
    CLAIM_AMOUNT_WHOLE,
  );
  await token.waitForDeployment();

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(await token.getAddress(), REWARD_RATE);
  await staking.waitForDeployment();

  const decimals = BigInt(await token.decimals());
  const unit = 10n ** decimals;
  const rewardFund = REWARD_FUND * unit;
  const seedBalance = SEED_BALANCE * unit;

  await token.connect(owner).transfer(await staking.getAddress(), rewardFund);
  await token.connect(owner).transfer(alice.address, seedBalance);
  await token.connect(owner).transfer(bob.address, seedBalance);

  await token
    .connect(alice)
    .approve(await staking.getAddress(), ethers.MaxUint256);
  await token
    .connect(bob)
    .approve(await staking.getAddress(), ethers.MaxUint256);

  return {
    token,
    staking,
    owner,
    alice,
    bob,
    ethers,
    unit,
  };
}

describe("Staking", function () {
  it("lets users stake tokens and tracks balances", async function () {
    const { staking, token, alice, unit } = await deployStakingFixture();
    const amount = 100n * unit;

    await expect(staking.connect(alice).stake(amount))
      .to.emit(staking, "Staked")
      .withArgs(alice.address, amount);

    expect(await staking.totalStaked()).to.equal(amount);
    expect(await staking.balances(alice.address)).to.equal(amount);
    expect(await token.balanceOf(await staking.getAddress())).to.be.greaterThan(
      amount,
    );
  });

  it("allows withdrawals and prevents overdrafts", async function () {
    const { staking, token, alice, unit, ethers } =
      await deployStakingFixture();
    const amount = 50n * unit;

    await staking.connect(alice).stake(amount);

    await expect(staking.connect(alice).withdraw(amount))
      .to.emit(staking, "Withdrawn")
      .withArgs(alice.address, amount);

    expect(await staking.balances(alice.address)).to.equal(0n);

    await expect(staking.connect(alice).withdraw(amount)).to.be.revertedWith(
      "insufficient stake",
    );

    await expect(
      staking.connect(alice).withdraw(0),
    ).to.be.revertedWith("amount zero");
  });

  it("accrues and pays out rewards over time", async function () {
    const { staking, token, alice, unit, ethers } =
      await deployStakingFixture();
    const amount = 80n * unit;
    const seconds = 10n;

    await staking.connect(alice).stake(amount);
    const lastUpdate = await staking.lastUpdateTime();
    const targetTimestamp = Number(lastUpdate + seconds);
    await ethers.provider.send("evm_setNextBlockTimestamp", [targetTimestamp]);

    const before = await token.balanceOf(alice.address);
    await expect(staking.connect(alice).claimReward())
      .to.emit(staking, "RewardPaid")
      .withArgs(
        alice.address,
        REWARD_RATE * (BigInt(targetTimestamp) - lastUpdate),
      );
    const after = await token.balanceOf(alice.address);

    expect(after - before).to.equal(
      REWARD_RATE * (BigInt(targetTimestamp) - lastUpdate),
    );
    expect(await staking.rewards(alice.address)).to.equal(0n);
  });

  it("exit withdraws stake and rewards in one call", async function () {
    const { staking, token, alice, unit, ethers } =
      await deployStakingFixture();
    const amount = 60n * unit;

    await staking.connect(alice).stake(amount);
    const lastUpdate = await staking.lastUpdateTime();
    const targetTimestamp = Number(lastUpdate + 5n);
    await ethers.provider.send("evm_setNextBlockTimestamp", [targetTimestamp]);

    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).exit();
    const after = await token.balanceOf(alice.address);

    expect(await staking.balances(alice.address)).to.equal(0n);
    expect(after).to.be.gt(before);
  });

  it("only lets the owner update the reward rate", async function () {
    const { staking, owner, alice } = await deployStakingFixture();
    const newRate = REWARD_RATE * 2n;

    await expect(staking.connect(owner).setRewardRate(newRate))
      .to.emit(staking, "RewardRateUpdated")
      .withArgs(newRate);

    await expect(
      staking.connect(alice).setRewardRate(newRate),
    )
      .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
  });
});
