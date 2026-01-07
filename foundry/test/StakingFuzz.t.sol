// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../../contracts/MyTokenERC20.sol";
import "../../contracts/Staking.sol";

/// @title Fuzz tests for Staking contract
/// @notice Tests staking, withdrawals, and reward calculations with random inputs
contract StakingFuzzTest is Test {
    MyToken private token;
    Staking private staking;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    uint256 private constant INITIAL_SUPPLY_WHOLE = 1_000_000;
    uint256 private constant CLAIM_AMOUNT = 100;
    uint256 private constant REWARD_RATE = 1 ether;
    uint256 private constant REWARD_POOL = 100_000 ether;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY_WHOLE, CLAIM_AMOUNT);
        staking = new Staking(address(token), REWARD_RATE);

        // Fund staking pool and users
        token.transfer(address(staking), REWARD_POOL);
        token.transfer(ALICE, 100_000 ether);
        token.transfer(BOB, 100_000 ether);

        // Approve staking contract
        vm.prank(ALICE);
        token.approve(address(staking), type(uint256).max);
        vm.prank(BOB);
        token.approve(address(staking), type(uint256).max);
    }

    /// @notice Fuzz test: Staking increases total staked
    function testFuzz_StakeIncreasesTotalStaked(uint256 amount) public {
        amount = bound(amount, 1 ether, 50_000 ether);

        uint256 totalBefore = staking.totalStaked();

        vm.prank(ALICE);
        staking.stake(amount);

        assertEq(staking.totalStaked(), totalBefore + amount);
        assertEq(staking.balances(ALICE), amount);
    }

    /// @notice Fuzz test: Cannot withdraw more than staked
    function testFuzz_CannotOverWithdraw(uint256 stakeAmount, uint256 withdrawAmount) public {
        stakeAmount = bound(stakeAmount, 1 ether, 50_000 ether);
        withdrawAmount = bound(withdrawAmount, 1 ether, 100_000 ether);

        vm.startPrank(ALICE);
        staking.stake(stakeAmount);

        if (withdrawAmount > stakeAmount) {
            vm.expectRevert(Staking.InsufficientStake.selector);
        }
        staking.withdraw(withdrawAmount);
        vm.stopPrank();
    }

    /// @notice Fuzz test: Rewards accrue proportionally to stake time
    function testFuzz_RewardsAccrueOverTime(uint256 amount, uint256 duration) public {
        amount = bound(amount, 1 ether, 50_000 ether);
        duration = bound(duration, 1, 1000); // limit to avoid pool exhaustion

        vm.prank(ALICE);
        staking.stake(amount);

        vm.warp(block.timestamp + duration);

        uint256 earned = staking.earned(ALICE);
        uint256 expectedReward = REWARD_RATE * duration;

        // With single staker, should earn full rewards (allow rounding error)
        assertApproxEqRel(earned, expectedReward, 1e15);
    }

    /// @notice Fuzz test: Multiple stakers share rewards proportionally
    function testFuzz_MultipleStakersShareRewards(
        uint256 aliceAmount,
        uint256 bobAmount,
        uint256 duration
    ) public {
        aliceAmount = bound(aliceAmount, 1 ether, 40_000 ether);
        bobAmount = bound(bobAmount, 1 ether, 40_000 ether);
        duration = bound(duration, 1, 100); // short duration for precision

        vm.prank(ALICE);
        staking.stake(aliceAmount);
        vm.prank(BOB);
        staking.stake(bobAmount);

        vm.warp(block.timestamp + duration);

        uint256 aliceEarned = staking.earned(ALICE);
        uint256 bobEarned = staking.earned(BOB);
        uint256 totalRewards = REWARD_RATE * duration;

        uint256 expectedAlice = (totalRewards * aliceAmount) / (aliceAmount + bobAmount);
        uint256 expectedBob = (totalRewards * bobAmount) / (aliceAmount + bobAmount);

        // Allow small rounding error
        assertApproxEqRel(aliceEarned, expectedAlice, 1e15);
        assertApproxEqRel(bobEarned, expectedBob, 1e15);
    }

    /// @notice Fuzz test: Exit returns all staked tokens plus rewards
    function testFuzz_ExitReturnsAllFunds(uint256 amount, uint256 duration) public {
        amount = bound(amount, 1 ether, 50_000 ether);
        duration = bound(duration, 1, 500); // limit to avoid pool exhaustion

        uint256 aliceBalanceBefore = token.balanceOf(ALICE);

        vm.prank(ALICE);
        staking.stake(amount);

        vm.warp(block.timestamp + duration);
        uint256 earnedBeforeExit = staking.earned(ALICE);

        vm.prank(ALICE);
        staking.exit();

        uint256 aliceBalanceAfter = token.balanceOf(ALICE);

        assertEq(aliceBalanceAfter, aliceBalanceBefore + earnedBeforeExit);
        assertEq(staking.balances(ALICE), 0);
    }

    /// @notice Fuzz test: Zero amount operations revert
    function testFuzz_ZeroAmountReverts() public {
        vm.startPrank(ALICE);
        
        vm.expectRevert(Staking.ZeroAmount.selector);
        staking.stake(0);

        staking.stake(1 ether);

        vm.expectRevert(Staking.ZeroAmount.selector);
        staking.withdraw(0);

        vm.stopPrank();
    }
}
