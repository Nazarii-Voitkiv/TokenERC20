import { expect } from "chai";
import { network } from "hardhat";

describe("MyTokenSafe", function () {
  async function deploySafeFixture() {
    const { ethers } = await network.connect();
    const [deployer, ownerA, ownerB, ownerC, nonOwner, treasury] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MyToken");
    const Safe = await ethers.getContractFactory("MyTokenSafe");

    const TOKEN_INITIAL_SUPPLY = 1_000_000n;
    const TOKEN_CLAIM_AMOUNT = 100n;

    const token = await Token.deploy("MyToken", "MTK", TOKEN_INITIAL_SUPPLY, TOKEN_CLAIM_AMOUNT);
    await token.waitForDeployment();

    const owners = [ownerA.address, ownerB.address, ownerC.address];
    const threshold = 2;
    const safe = await Safe.deploy(owners, threshold);
    await safe.waitForDeployment();

    await token.transferOwnership(await safe.getAddress());

    return {
      ethers,
      token,
      safe,
      owners,
      deployer,
      ownerA,
      ownerB,
      ownerC,
      nonOwner,
      treasury,
      threshold,
    };
  }

  async function submitSafeTx(
    safe: any,
    submitter: any,
    to: string,
    data: string,
    value: bigint = 0n
  ) {
    const txResponse = await safe.connect(submitter).submitTransaction(to, value, data);
    await txResponse.wait();
    const count = await safe.getTransactionCount();
    return Number(count - 1n);
  }

  it("requires threshold approvals before executing owner actions", async function () {
    const { token, safe, ownerA, ownerB, treasury, threshold } = await deploySafeFixture();
    const iface = token.interface;
    const calldata = iface.encodeFunctionData("setTreasury", [treasury.address]);

    const txId = await submitSafeTx(safe, ownerA, await token.getAddress(), calldata);

    const storedTx = await safe.getTransaction(txId);
    expect(storedTx.to).to.equal(await token.getAddress());
    expect(storedTx.executed).to.equal(false);
    expect(storedTx.numConfirmations).to.equal(1n);

    await expect(safe.connect(ownerB).executeTransaction(txId))
      .to.be.revertedWithCustomError(safe, "TxNotConfirmed")
      .withArgs(txId);

    await safe.connect(ownerB).confirmTransaction(txId);
    await safe.connect(ownerB).executeTransaction(txId);

    expect(await token.treasury()).to.equal(treasury.address);

    await expect(safe.connect(ownerB).executeTransaction(txId))
      .to.be.revertedWithCustomError(safe, "TxAlreadyExecuted")
      .withArgs(txId);

    expect(await safe.threshold()).to.equal(BigInt(threshold));
  });

  it("prevents duplicate confirmations and supports revocation", async function () {
    const { token, safe, ownerA, ownerB, ownerC } = await deploySafeFixture();
    const calldata = token.interface.encodeFunctionData("setFeeBps", [250]);
    const txId = await submitSafeTx(safe, ownerA, await token.getAddress(), calldata);

    await safe.connect(ownerB).confirmTransaction(txId);
    await safe.connect(ownerB).confirmTransaction(txId);

    let stored = await safe.getTransaction(txId);
    expect(stored.numConfirmations).to.equal(2n);

    await safe.connect(ownerB).revokeConfirmation(txId);
    stored = await safe.getTransaction(txId);
    expect(stored.numConfirmations).to.equal(1n);

    await safe.connect(ownerB).confirmTransaction(txId);
    await safe.connect(ownerC).confirmTransaction(txId);

    stored = await safe.getTransaction(txId);
    expect(stored.numConfirmations).to.equal(3n);
  });

  it("reverts and resets execution if underlying call fails", async function () {
    const { token, safe, ownerA, ownerB } = await deploySafeFixture();
    const calldata = token.interface.encodeFunctionData("setFeeBps", [1_000]);
    const txId = await submitSafeTx(safe, ownerA, await token.getAddress(), calldata);

    await safe.connect(ownerB).confirmTransaction(txId);

    await expect(safe.connect(ownerB).executeTransaction(txId)).to.be.revertedWithCustomError(
      safe,
      "ExecutionFailed"
    );

    const stored = await safe.getTransaction(txId);
    expect(stored.executed).to.equal(false);
    expect(stored.numConfirmations).to.equal(2n);
  });

  it("blocks non-owners from interacting with the multisig", async function () {
    const { safe, nonOwner, token, ownerA } = await deploySafeFixture();
    const calldata = token.interface.encodeFunctionData("pause");

    await expect(
      safe.connect(nonOwner).submitTransaction(await token.getAddress(), 0, calldata)
    ).to.be.revertedWithCustomError(safe, "NotOwner");

    const txId = await submitSafeTx(safe, ownerA, await token.getAddress(), calldata);
    await expect(safe.connect(nonOwner).confirmTransaction(txId)).to.be.revertedWithCustomError(
      safe,
      "NotOwner"
    );
    await expect(safe.connect(nonOwner).executeTransaction(txId)).to.be.revertedWithCustomError(
      safe,
      "NotOwner"
    );
  });
});
