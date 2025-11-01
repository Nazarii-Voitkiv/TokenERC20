import { ethers } from "hardhat";

async function main() {
  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy("MyToken", "MTK", 1_000_000);
  await token.deployed();
  console.log("MyToken deployed to:", token.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});