// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Staking is Ownable, ReentrancyGuard {
    using Math for uint256;

    IERC20 public immutable stakingToken;
    uint256 public rewardRate; // reward tokens distributed per second

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
        require(token != address(0), "token zero");
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
        require(amount > 0, "amount zero");
        totalStaked += amount;
        balances[msg.sender] += amount;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        _withdraw(msg.sender, amount);
    }

    function _withdraw(address account, uint256 amount) internal {
        require(amount > 0, "amount zero");
        require(balances[account] >= amount, "insufficient stake");
        totalStaked -= amount;
        balances[account] -= amount;
        require(stakingToken.transfer(account, amount), "transfer failed");
        emit Withdrawn(account, amount);
    }

    function claimReward() public nonReentrant updateReward(msg.sender) {
        _claimReward(msg.sender);
    }

    function _claimReward(address account) internal {
        uint256 reward = rewards[account];
        rewards[account] = 0;
        require(reward > 0, "no rewards");
        require(stakingToken.transfer(account, reward), "reward transfer failed");
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
