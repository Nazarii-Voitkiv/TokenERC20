import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const token = await ethers.deployContract("MyToken", [
    "MyToken",
    "MTK",
    1_000_000,
  ]);
  await token.waitForDeployment();

  console.log("MyToken deployed to:", await token.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
