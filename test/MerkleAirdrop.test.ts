import { expect } from "chai";
import { network } from "hardhat";

const INITIAL_SUPPLY_WHOLE = 1_000_000n;
const CLAIM_AMOUNT_WHOLE = 0n;
const CLAIM_ALICE = 250n;
const CLAIM_BOB = 100n;

async function deployMerkleFixture() {
  const { ethers } = await network.connect();
  const [owner, alice, bob, treasury] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(
    "MyToken",
    "MTK",
    INITIAL_SUPPLY_WHOLE,
    CLAIM_AMOUNT_WHOLE,
  );
  await token.waitForDeployment();

  const decimals = BigInt(await token.decimals());
  const claimAlice = CLAIM_ALICE * 10n ** decimals;
  const claimBob = CLAIM_BOB * 10n ** decimals;

  const leafAlice = ethers.solidityPackedKeccak256(
    ["uint256", "address", "uint256"],
    [0, alice.address, claimAlice],
  );
  const leafBob = ethers.solidityPackedKeccak256(
    ["uint256", "address", "uint256"],
    [1, bob.address, claimBob],
  );
  const [left, right] =
    BigInt(leafAlice) < BigInt(leafBob)
      ? [leafAlice, leafBob]
      : [leafBob, leafAlice];
  const root = ethers.keccak256(ethers.concat([left, right]));

  const Airdrop = await ethers.getContractFactory("MerkleAirdrop");
  const distributor = await Airdrop.deploy(
    await token.getAddress(),
    root,
    owner.address,
  );
  await distributor.waitForDeployment();

  await token
    .connect(owner)
    .transfer(await distributor.getAddress(), claimAlice + claimBob);

  const proofForIndex = (index: number) =>
    index === 0 ? [leafBob] : [leafAlice];

  return {
    token,
    distributor,
    owner,
    alice,
    bob,
    treasury,
    ethers,
    leafAlice,
    leafBob,
    root,
    claimAlice,
    claimBob,
    proofForIndex,
  };
}

describe("MerkleAirdrop", function () {
  it("lets eligible accounts claim exactly once", async function () {
    const { distributor, token, alice, claimAlice, proofForIndex } =
      await deployMerkleFixture();

    await expect(
      distributor
        .connect(alice)
        .claim(0, alice.address, claimAlice, proofForIndex(0)),
    )
      .to.emit(distributor, "Claimed")
      .withArgs(0, alice.address, claimAlice);

    expect(await token.balanceOf(alice.address)).to.equal(claimAlice);
    expect(await distributor.isClaimed(0)).to.equal(true);

    await expect(
      distributor
        .connect(alice)
        .claim(0, alice.address, claimAlice, proofForIndex(0)),
    ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
  });

  it("reverts when the proof does not match the claim data", async function () {
    const { distributor, bob, claimBob, ethers } = await deployMerkleFixture();
    const badProof = [ethers.ZeroHash];

    await expect(
      distributor.connect(bob).claim(1, bob.address, claimBob, badProof),
    ).to.be.revertedWithCustomError(distributor, "InvalidProof");
  });

  it("allows the owner to rotate the root and recover leftover funds", async function () {
    const { distributor, token, owner, claimAlice } =
      await deployMerkleFixture();
    const newRoot =
      "0x9a0c83cd55e186ec6c155e04508a1f2d2940cce544204265028ef44bacb00000";

    await expect(distributor.connect(owner).setMerkleRoot(newRoot))
      .to.emit(distributor, "MerkleRootUpdated")
      .withArgs(newRoot);

    const ownerBalanceBefore = await token.balanceOf(owner.address);
    await expect(distributor.connect(owner).recover(owner.address, claimAlice))
      .to.emit(distributor, "FundsRecovered")
      .withArgs(owner.address, claimAlice);

    const ownerBalanceAfter = await token.balanceOf(owner.address);
    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(claimAlice);
  });
});
