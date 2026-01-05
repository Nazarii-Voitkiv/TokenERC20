// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../../contracts/MyTokenERC20.sol";

/// @title Fuzz tests for MyToken transfer fees
/// @notice Tests fee calculations and transfer limits with random inputs
contract MyTokenFuzzTest is Test {
    MyToken private token;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TREASURY = address(0x77EA5);

    uint256 private constant INITIAL_SUPPLY_WHOLE = 1_000_000;
    uint256 private constant CLAIM_AMOUNT = 100;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY_WHOLE, CLAIM_AMOUNT);
        
        // Setup treasury and fees
        token.setTreasury(TREASURY);
        token.setFeeBps(100); // 1%
        
        // Give Alice some tokens
        token.transfer(ALICE, 100_000 ether);
    }

    /// @notice Fuzz test: Fee calculation should never exceed 5%
    /// @param amount Random transfer amount
    function testFuzz_FeeNeverExceeds5Percent(uint256 amount) public {
        // Bound amount to reasonable range
        amount = bound(amount, 1 ether, 50_000 ether);
        
        uint256 treasuryBefore = token.balanceOf(TREASURY);
        uint256 aliceBefore = token.balanceOf(ALICE);
        uint256 bobBefore = token.balanceOf(BOB);

        vm.prank(ALICE);
        token.transfer(BOB, amount);

        uint256 treasuryAfter = token.balanceOf(TREASURY);
        uint256 aliceAfter = token.balanceOf(ALICE);
        uint256 bobAfter = token.balanceOf(BOB);

        uint256 feeCollected = treasuryAfter - treasuryBefore;
        uint256 aliceSent = aliceBefore - aliceAfter;
        uint256 bobReceived = bobAfter - bobBefore;

        // Fee should never exceed 5% of transfer
        assertLe(feeCollected, (amount * 500) / 10_000, "Fee exceeds 5%");
        
        // Conservation: alice sent = bob received + fee
        assertEq(aliceSent, bobReceived + feeCollected, "Token conservation violated");
    }

    /// @notice Fuzz test: Random fee basis points (0-500)
    function testFuzz_VariableFeeBps(uint256 feeBps, uint256 amount) public {
        feeBps = bound(feeBps, 0, 500);
        amount = bound(amount, 1 ether, 50_000 ether);
        
        token.setFeeBps(feeBps);

        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.prank(ALICE);
        token.transfer(BOB, amount);

        uint256 feeCollected = token.balanceOf(TREASURY) - treasuryBefore;
        uint256 expectedFee = (amount * feeBps) / 10_000;

        assertEq(feeCollected, expectedFee, "Fee calculation incorrect");
    }

    /// @notice Fuzz test: Transfer with max limit
    function testFuzz_MaxTransferLimit(uint256 limit, uint256 amount) public {
        limit = bound(limit, 1 ether, 10_000 ether);
        amount = bound(amount, 1 ether, 50_000 ether);
        
        token.setMaxTransferAmount(limit);

        vm.prank(ALICE);
        if (amount > limit) {
            vm.expectRevert(MyToken.TransferTooLarge.selector);
        }
        token.transfer(BOB, amount);
    }

    /// @notice Fuzz test: Whitelisted transfers bypass fees
    function testFuzz_WhitelistBypassesFees(uint256 amount) public {
        amount = bound(amount, 1 ether, 50_000 ether);
        
        address[] memory addrs = new address[](1);
        addrs[0] = ALICE;
        token.setWhitelisted(addrs, true);

        uint256 treasuryBefore = token.balanceOf(TREASURY);

        vm.prank(ALICE);
        token.transfer(BOB, amount);

        uint256 feeCollected = token.balanceOf(TREASURY) - treasuryBefore;
        
        // Whitelisted addresses should not pay fees
        assertEq(feeCollected, 0, "Whitelisted transfer charged fee");
    }

    /// @notice Fuzz test: Zero fee when treasury is not set
    function testFuzz_NoFeeWithoutTreasury(uint256 amount) public {
        amount = bound(amount, 1 ether, 50_000 ether);
        
        // Deploy fresh token without treasury
        MyToken freshToken = new MyToken("Fresh", "FRS", INITIAL_SUPPLY_WHOLE, CLAIM_AMOUNT);
        freshToken.transfer(ALICE, 100_000 ether);
        freshToken.setFeeBps(100);
        // Note: treasury not set

        uint256 bobBefore = freshToken.balanceOf(BOB);

        vm.prank(ALICE);
        freshToken.transfer(BOB, amount);

        uint256 bobAfter = freshToken.balanceOf(BOB);

        // Without treasury, Bob should receive full amount
        assertEq(bobAfter - bobBefore, amount, "Should receive full amount without treasury");
    }
}
