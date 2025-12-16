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

  async function executeSafeTx(
    safe: any,
    submitter: any,
    confirmers: any[],
    to: string,
    data: string,
    value: bigint = 0n,
    executor?: any
  ) {
    const txId = await submitSafeTx(safe, submitter, to, data, value);
    for (const confirmer of confirmers) {
      await safe.connect(confirmer).confirmTransaction(txId);
    }
    const execSigner = executor ?? confirmers[confirmers.length - 1] ?? submitter;
    await safe.connect(execSigner).executeTransaction(txId);
    return txId;
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

    await expect(safe.connect(ownerB).revokeConfirmation(txId))
      .to.be.revertedWithCustomError(safe, "TxNotConfirmedBySender")
      .withArgs(txId);

    await safe.connect(ownerB).confirmTransaction(txId);
    await expect(safe.connect(ownerB).confirmTransaction(txId))
      .to.be.revertedWithCustomError(safe, "TxAlreadyConfirmed")
      .withArgs(txId);

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

  it("rejects invalid targets and enforces self-managed administration", async function () {
    const { safe, ownerA, ownerB, nonOwner } = await deploySafeFixture();
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    await expect(
      safe.connect(ownerA).submitTransaction(zeroAddress, 0, "0x")
    ).to.be.revertedWithCustomError(safe, "ZeroAddressTarget");

    await expect(safe.connect(ownerA).addOwner(nonOwner.address)).to.be.revertedWithCustomError(
      safe,
      "OnlySelfCall"
    );

    await expect(safe.connect(ownerA).removeOwner(ownerB.address)).to.be.revertedWithCustomError(
      safe,
      "OnlySelfCall"
    );

    await expect(safe.connect(ownerA).changeThreshold(1)).to.be.revertedWithCustomError(
      safe,
      "OnlySelfCall"
    );
  });

  it("allows owner lifecycle changes via multisig while preserving at least one owner", async function () {
    const { safe, ownerA, ownerB, ownerC, nonOwner } = await deploySafeFixture();
    const safeAddress = await safe.getAddress();

    await executeSafeTx(
      safe,
      ownerA,
      [ownerB],
      safeAddress,
      safe.interface.encodeFunctionData("addOwner", [nonOwner.address])
    );
    expect(await safe.isOwner(nonOwner.address)).to.equal(true);

    await executeSafeTx(
      safe,
      ownerA,
      [ownerC],
      safeAddress,
      safe.interface.encodeFunctionData("removeOwner", [ownerB.address])
    );
    expect(await safe.isOwner(ownerB.address)).to.equal(false);

    await executeSafeTx(
      safe,
      ownerA,
      [nonOwner],
      safeAddress,
      safe.interface.encodeFunctionData("removeOwner", [ownerC.address])
    );
    expect(await safe.isOwner(ownerC.address)).to.equal(false);

    await executeSafeTx(
      safe,
      ownerA,
      [nonOwner],
      safeAddress,
      safe.interface.encodeFunctionData("removeOwner", [nonOwner.address])
    );
    expect(await safe.threshold()).to.equal(1n);
    expect(await safe.isOwner(nonOwner.address)).to.equal(false);

    const removeLastData = safe.interface.encodeFunctionData("removeOwner", [ownerA.address]);
    const lastRemovalTxId = await submitSafeTx(safe, ownerA, safeAddress, removeLastData);
    const revertData = safe.interface.encodeErrorResult("OwnerRequired", []);

    await expect(safe.connect(ownerA).executeTransaction(lastRemovalTxId))
      .to.be.revertedWithCustomError(safe, "ExecutionFailed")
      .withArgs(revertData);
  });
});
