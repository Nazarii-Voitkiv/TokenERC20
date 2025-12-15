// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../contracts/MyTokenERC20.sol";
import "../../contracts/Staking.sol";

contract StakingTest is Test {
    MyToken private token;
    Staking private staking;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);

    uint256 private constant INITIAL_SUPPLY_WHOLE = 1_000_000;
    uint256 private constant CLAIM_AMOUNT = 100;
    uint256 private constant REWARD_RATE = 1 ether;
    uint256 private constant REWARD_POOL = 10_000 ether;
    uint256 private constant STAKE_BALANCE = 1_000 ether;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY_WHOLE, CLAIM_AMOUNT);
        staking = new Staking(address(token), REWARD_RATE);

        token.transfer(address(staking), REWARD_POOL);
        token.transfer(ALICE, STAKE_BALANCE);
        token.transfer(BOB, STAKE_BALANCE);

        vm.prank(ALICE);
        token.approve(address(staking), type(uint256).max);
        vm.prank(BOB);
        token.approve(address(staking), type(uint256).max);
    }

    function testStakeIncreasesTotals() public {
        uint256 amount = 500 ether;
        vm.prank(ALICE);
        staking.stake(amount);

        assertEq(staking.totalStaked(), amount);
        assertEq(staking.balances(ALICE), amount);
    }

    function testWithdrawReturnsTokens() public {
        uint256 amount = 250 ether;
        vm.startPrank(ALICE);
        staking.stake(amount);
        staking.withdraw(amount);
        vm.stopPrank();

        assertEq(staking.balances(ALICE), 0);
        assertEq(token.balanceOf(ALICE), STAKE_BALANCE);
    }

    function testRewardsAccrueOverTime() public {
        uint256 amount = 400 ether;
        vm.prank(ALICE);
        staking.stake(amount);

        vm.warp(block.timestamp + 20);

        uint256 beforeBalance = token.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.claimReward();
        uint256 afterBalance = token.balanceOf(ALICE);

        uint256 expectedReward = REWARD_RATE * 20;
        assertEq(afterBalance - beforeBalance, expectedReward);
        assertEq(staking.rewards(ALICE), 0);
    }

    function testExitWithdrawsStakeAndRewards() public {
        uint256 amount = 300 ether;
        vm.prank(ALICE);
        staking.stake(amount);
        vm.warp(block.timestamp + 5);

        uint256 beforeBalance = token.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.exit();
        uint256 afterBalance = token.balanceOf(ALICE);

        assertEq(staking.balances(ALICE), 0);
        assertTrue(afterBalance > beforeBalance);
    }

    function testOnlyOwnerCanUpdateRewardRate() public {
        uint256 newRate = REWARD_RATE * 2;
        staking.setRewardRate(newRate);
        assertEq(staking.rewardRate(), newRate);

        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, ALICE)
        );
        staking.setRewardRate(newRate);
    }
}
