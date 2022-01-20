const merkleTree = require("./merkleTree.json");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MAD = await ethers.getContractFactory("MAD");
  const mad = await MAD.deploy(merkleTree.merkleRoot);

  console.log("Token address:", mad.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
