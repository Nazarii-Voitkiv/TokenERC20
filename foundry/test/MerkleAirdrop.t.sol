// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../../contracts/MyTokenERC20.sol";
import "../../contracts/MerkleAirdrop.sol";

contract MerkleAirdropTest is Test {
    MyToken private token;
    MerkleAirdrop private distributor;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    uint256 private constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 private constant CLAIM_ALICE = 250 ether;
    uint256 private constant CLAIM_BOB = 100 ether;

    bytes32 private leafAlice;
    bytes32 private leafBob;
    bytes32 private root;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY / 1 ether, 0);

        leafAlice = keccak256(abi.encodePacked(uint256(0), ALICE, CLAIM_ALICE));
        leafBob = keccak256(abi.encodePacked(uint256(1), BOB, CLAIM_BOB));
        root = keccak256(bytes.concat(leafAlice, leafBob));

        distributor = new MerkleAirdrop(address(token), root, address(this));
        token.transfer(address(distributor), CLAIM_ALICE + CLAIM_BOB);
    }

    function testClaimTransfersTokensAndMarksClaimed() public {
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafBob;

        vm.prank(ALICE);
        distributor.claim(0, ALICE, CLAIM_ALICE, proof);

        assertEq(token.balanceOf(ALICE), CLAIM_ALICE);
        assertTrue(distributor.isClaimed(0));
    }

    function testCannotClaimTwice() public {
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leafBob;

        vm.prank(ALICE);
        distributor.claim(0, ALICE, CLAIM_ALICE, proof);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(MerkleAirdrop.AlreadyClaimed.selector, 0));
        distributor.claim(0, ALICE, CLAIM_ALICE, proof);
    }

    function testClaimFailsWithWrongProof() public {
        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32(uint256(123)); // gibberish leaf not part of tree

        vm.prank(BOB);
        vm.expectRevert(MerkleAirdrop.InvalidProof.selector);
        distributor.claim(1, BOB, CLAIM_BOB, badProof);
    }

    function testOwnerCanUpdateRootAndRecover() public {
        bytes32 freshLeaf = keccak256(abi.encodePacked(uint256(0), ALICE, CLAIM_BOB));
        bytes32 newRoot = keccak256(bytes.concat(freshLeaf, freshLeaf));

        distributor.setMerkleRoot(newRoot);
        assertEq(distributor.merkleRoot(), newRoot);

        distributor.recover(address(this), CLAIM_ALICE);
        assertEq(token.balanceOf(address(this)), INITIAL_SUPPLY - CLAIM_BOB);
    }
}
