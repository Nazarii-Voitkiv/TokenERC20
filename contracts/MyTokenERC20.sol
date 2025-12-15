// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MyToken is ERC20, ERC20Burnable, Ownable, Pausable {
    uint256 public constant MAX_FEE_BPS = 500;
    uint256 public immutable CLAIM_AMOUNT;

    event TreasuryUpdated(address indexed newTreasury);
    event FeeBpsUpdated(uint256 newFeeBps);
    event Claimed(address indexed account, uint256 amount);
    event WhitelistUpdated(address indexed account, bool allowed);
    event MaxTransferUpdated(uint256 newMaxTransfer);

    constructor(
        string memory name_, 
        string memory symbol_, 
        uint256 initialSupplyWhole,
        uint256 claimAmount_
    )
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupplyWhole * 10 ** decimals());
        CLAIM_AMOUNT = claimAmount_ * 10 ** decimals();
    }

    address public treasury;
    uint256 public feeBps = 100;
    uint256 public maxTransferAmount;
    mapping (address => bool) public hasClaimed;
    mapping (address => bool) public isWhitelisted;

    function setMaxTransferAmount(uint _maxTransferAmount) external onlyOwner {
        maxTransferAmount = _maxTransferAmount;
        emit MaxTransferUpdated(_maxTransferAmount);
    }

    function claimFreeTokens() external {
        require(!hasClaimed[msg.sender], "already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    function setTreasury(address _treasuryAddress) external onlyOwner {
        require(_treasuryAddress != address(0), "treasury zero");
        treasury = _treasuryAddress;
        emit TreasuryUpdated(_treasuryAddress);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, 'fee too high');
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setWhitelisted(address[] calldata addrs, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            isWhitelisted[addrs[i]] = allowed;
            emit WhitelistUpdated(addrs[i], allowed);
        }
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero to");
        IERC20(token).transfer(to, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _update(address from, address to, uint256 value) internal override {
        // mint/burn
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // whitelist
        if (isWhitelisted[from] || isWhitelisted[to]) {
            super._update(from, to, value);
            return;
        }

        // pause
        require(!paused(), "Token is paused");

        // fee + limit
        if (from != address(0) && to != address(0) && to != treasury && from != treasury 
        && treasury != address(0) && feeBps > 0) {
            if (maxTransferAmount != 0) {
                require(value <= maxTransferAmount, "too big transfer");
            }

            uint256 fee = (value * feeBps) / 10_000;
            uint256 sendAmount = value - fee;

            super._update(from, treasury, fee);
            super._update(from, to, sendAmount);
            return;
        }
        
        // default
        super._update(from, to, value);
    }
}