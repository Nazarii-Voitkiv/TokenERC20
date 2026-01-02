// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Staking Pool Contract
/// @notice Allows users to stake tokens and earn rewards over time
/// @dev Uses a reward-per-token mechanism for fair reward distribution
contract Staking is Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // Custom errors for gas efficiency
    error ZeroAmount();
    error InsufficientStake();
    error NoRewards();
    error ZeroTokenAddress();

    IERC20 public immutable stakingToken;
    uint256 public rewardRate;

    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRewardRate);

    constructor(address token, uint256 initialRewardRate) Ownable(msg.sender) {
        if (token == address(0)) revert ZeroTokenAddress();
        stakingToken = IERC20(token);
        rewardRate = initialRewardRate;
        emit RewardRateUpdated(initialRewardRate);
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        uint256 timeDelta = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (timeDelta * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return
            ((balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        totalStaked += amount;
        balances[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        _withdraw(msg.sender, amount);
    }

    function _withdraw(address account, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (balances[account] < amount) revert InsufficientStake();
        totalStaked -= amount;
        balances[account] -= amount;
        stakingToken.safeTransfer(account, amount);
        emit Withdrawn(account, amount);
    }

    function claimReward() public nonReentrant updateReward(msg.sender) {
        _claimReward(msg.sender);
    }

    function _claimReward(address account) internal {
        uint256 reward = rewards[account];
        if (reward == 0) revert NoRewards();
        rewards[account] = 0;
        stakingToken.safeTransfer(account, reward);
        emit RewardPaid(account, reward);
    }

    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 balance = balances[msg.sender];
        if (balance > 0) {
            _withdraw(msg.sender, balance);
        }
        if (rewards[msg.sender] > 0) {
            _claimReward(msg.sender);
        }
    }
}
