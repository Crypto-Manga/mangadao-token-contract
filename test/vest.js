const { expect } = require("chai");
const { ethers } = require("hardhat");
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

describe("MangaDAO token", () => {
  let MAD, mad;
  let owner, addr1, addr2, addr3, addr4, addr5, addr6;
  let merkleTree, merkleRoot;

  const createMerkleNode = (address, amount) => {
    return ethers.utils.solidityKeccak256(
      ["address", "uint256"],
      [address, amount]
    );
  };

  beforeEach(async () => {
    MAD = await ethers.getContractFactory("MAD");

    [owner, addr1, addr2, addr3, addr4, addr5, addr6] =
      await ethers.getSigners();

    merkleTree = new MerkleTree(
      [
        createMerkleNode(addr1.address, "1000"),
        createMerkleNode(addr2.address, "2000"),
        createMerkleNode(addr3.address, "1000"),
        createMerkleNode(addr4.address, "5000"),
        createMerkleNode(addr5.address, "7000"),
      ],
      keccak256,
      { sort: true }
    );

    merkleRoot = merkleTree.getHexRoot();

    mad = await MAD.deploy(merkleRoot);
  });

  it("Should claim correct amount of tokens for account #1", async () => {
    // ✅ address 1 is claiming 1000, whitelisted for 1000

    const proof = merkleTree.getHexProof(
      createMerkleNode(addr1.address, "1000")
    );

    await mad.connect(addr1).claim(1000, proof);

    expect(await mad.balanceOf(addr1.address)).to.equal("1000");
    expect(await mad.balanceOf(addr2.address)).to.equal("0");
  });

  it("Should claim correct amount of tokens for account #2", async () => {
    // ✅ address 2 is claiming 2000, whitelisted for 2000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr2.address, "2000")
    );

    await mad.connect(addr2).claim(2000, proof);

    expect(await mad.balanceOf(addr2.address)).to.equal("2000");
    expect(await mad.balanceOf(addr1.address)).to.equal("0");
  });

  it("Should claim correct amount of tokens for account #3", async () => {
    // ✅ address 3 is claiming 1000, whitelisted for 1000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr3.address, "1000")
    );

    await mad.connect(addr3).claim(1000, proof);

    expect(await mad.balanceOf(addr3.address)).to.equal("1000");
  });

  it("Should claim correct amount of tokens for account #4", async () => {
    // ✅ address 4 is claiming 5000, whitelisted for 5000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr4.address, "5000")
    );

    await mad.connect(addr4).claim(5000, proof);

    expect(await mad.balanceOf(addr4.address)).to.equal("5000");
  });

  it("Should claim correct amount of tokens for account #5", async () => {
    // ✅ address 5 is claiming 7000, whitelisted for 7000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr5.address, "7000")
    );

    await mad.connect(addr5).claim(7000, proof);

    expect(await mad.balanceOf(addr5.address)).to.equal("7000");
  });

  it("Should not be able to claim incorrect amount of tokens for account #1", async () => {
    // ❌ address 1 is claiming 2000, whitelisted only for 1000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr1.address, "2000")
    );

    try {
      await mad.connect(addr1).claim(2000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: could not verify merkleProof'"
      );
    }
  });

  it("Should not be able to claim incorrect amount of tokens for account #2", async () => {
    // ❌ address 2 is claiming 1000, whitelisted for 2000
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr2.address, "1000")
    );

    try {
      await mad.connect(addr2).claim(1000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: could not verify merkleProof'"
      );
    }
  });

  it("Should not let address that is not whitelist to claim tokens", async () => {
    // ❌ address 6 is trying to claim tokens, it is not whitelisted
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr6.address, "1000")
    );

    try {
      await mad.connect(addr6).claim(1000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: could not verify merkleProof'"
      );
    }
  });

  it("whitelisted account should not be able to claim tokens for another whitelisted account", async () => {
    // ❌ address 1 and 2 are whitelisted, but address 1 is trying to claim tokens for address 2
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr2.address, "2000")
    );

    try {
      await mad.connect(addr1).claim(2000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: could not verify merkleProof'"
      );
    }
  });

  it("whitelisted address cannot repeatedly claim tokens", async () => {
    // ❌ address 1 is whitelisted, claims once and then tries to claim again.
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr1.address, "1000")
    );

    await mad.connect(addr1).claim(1000, proof);

    expect(await mad.balanceOf(addr1.address)).to.equal("1000");

    try {
      await mad.connect(addr1).claim(1000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: Already claimed tokens'"
      );
    }
  });

  it("Should vest to new beneficiary after updating merkle root", async () => {
    // ❌ & then ✅ address 6 is not whitelisted at first. tries to claim, fails. Then merkle root is updated to include it following
    // which it should succeed.
    const proof = merkleTree.getHexProof(
      createMerkleNode(addr6.address, "3000")
    );

    try {
      await mad.connect(addr6).claim(3000, proof);
    } catch (err) {
      expect(err.message).to.equal(
        "VM Exception while processing transaction: reverted with reason string 'MAD: could not verify merkleProof'"
      );
    }

    const newMerkleTree = new MerkleTree(
      [
        createMerkleNode(addr1.address, "1000"),
        createMerkleNode(addr2.address, "2000"),
        createMerkleNode(addr3.address, "1000"),
        createMerkleNode(addr6.address, "3000"),
      ],
      keccak256,
      { sort: true }
    );
    await mad.connect(owner).setMerkleRoot(newMerkleTree.getHexRoot());

    const newProof = newMerkleTree.getHexProof(
      createMerkleNode(addr6.address, "3000")
    );

    await mad.connect(addr6).claim(3000, newProof);
  });

  it("Should vest to beneficiary who was whitelisted in both merkle trees", async () => {
    // ✅  address 1 is whitelisted at first, but claims only after the merkle tree is updated.

    const proof = merkleTree.getHexProof(
      createMerkleNode(addr2.address, "2000")
    );

    await mad.connect(addr2).claim(2000, proof);

    const newMerkleTree = new MerkleTree(
      [
        createMerkleNode(addr1.address, "1000"),
        createMerkleNode(addr2.address, "2000"),
        createMerkleNode(addr3.address, "1000"),
        createMerkleNode(addr6.address, "3000"),
      ],
      keccak256,
      { sort: true }
    );
    await mad.connect(owner).setMerkleRoot(newMerkleTree.getHexRoot());

    const newProof = newMerkleTree.getHexProof(
      createMerkleNode(addr1.address, "1000")
    );

    await mad.connect(addr1).claim(1000, newProof);
  });
});
