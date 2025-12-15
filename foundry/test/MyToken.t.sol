// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../../contracts/MyTokenERC20.sol";

contract MyTokenTest is Test {
    MyToken private token;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TREASURY = address(0x7EA5);

    uint256 private constant INITIAL_SUPPLY = 1_000_000;
    uint256 private constant CLAIM_AMOUNT = 100;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY, CLAIM_AMOUNT);
    }

    function testInitialSupplyMintedToOwner() public {
        uint8 decimals = token.decimals();
        uint256 expectedSupply = INITIAL_SUPPLY * 10 ** uint256(decimals);

        assertEq(token.totalSupply(), expectedSupply, "total supply mismatch");
        assertEq(token.balanceOf(address(this)), expectedSupply, "owner should hold full supply");
    }

    function testClaimFreeTokensOnce() public {
        uint256 claimAmount = token.CLAIM_AMOUNT();

        vm.prank(ALICE);
        token.claimFreeTokens();
        assertEq(token.balanceOf(ALICE), claimAmount, "claim amount not minted");

        vm.prank(ALICE);
        vm.expectRevert("already claimed");
        token.claimFreeTokens();
    }

    function testFeesFlowToTreasury() public {
        uint8 decimals = token.decimals();
        uint256 unit = 10 ** uint256(decimals);
        uint256 funding = 1_000 * unit;
        uint256 amount = 100 * unit;
        uint256 feeBps = 250; // 2.5%
        uint256 expectedFee = (amount * feeBps) / 10_000;

        token.transfer(ALICE, funding);

        token.setTreasury(TREASURY);
        token.setFeeBps(feeBps);

        vm.prank(ALICE);
        token.transfer(BOB, amount);

        assertEq(token.balanceOf(BOB), amount - expectedFee, "recipient balance incorrect");
        assertEq(token.balanceOf(TREASURY), expectedFee, "treasury did not receive fee");
    }

    function testMaxTransferLimit() public {
        uint8 decimals = token.decimals();
        uint256 unit = 10 ** uint256(decimals);
        uint256 limit = 50 * unit;

        token.transfer(ALICE, 2 * limit);
        token.setTreasury(TREASURY);
        token.setFeeBps(100); // 1%
        token.setMaxTransferAmount(limit);

        vm.prank(ALICE);
        vm.expectRevert("too big transfer");
        token.transfer(BOB, limit + 1);

        vm.prank(ALICE);
        token.transfer(BOB, limit);
    }

    function testPauseBlocksTransfersUnlessWhitelisted() public {
        uint8 decimals = token.decimals();
        uint256 amount = 10 * 10 ** uint256(decimals);

        token.transfer(ALICE, amount);
        token.pause();

        vm.prank(ALICE);
        vm.expectRevert("Token is paused");
        token.transfer(BOB, amount);

        address[] memory whitelist = new address[](1);
        whitelist[0] = ALICE;
        token.setWhitelisted(whitelist, true);

        vm.prank(ALICE);
        token.transfer(BOB, amount);
        assertEq(token.balanceOf(BOB), amount, "transfer should succeed for whitelisted address");
    }
}
