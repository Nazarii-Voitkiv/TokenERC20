// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MyToken is ERC20, ERC20Burnable, Ownable, Pausable {
    uint256 public constant MAX_FEE_BPS = 500;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 public immutable CLAIM_AMOUNT;

    error AlreadyClaimed();
    error TreasuryZero();
    error FeeTooHigh();
    error ZeroRecipient();
    error TransferTooLarge();
    error TokenPaused();

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
        uint256 scale = 10 ** decimals();
        _mint(msg.sender, initialSupplyWhole * scale);
        CLAIM_AMOUNT = claimAmount_ * scale;
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
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        hasClaimed[msg.sender] = true;
        uint256 claimAmount = CLAIM_AMOUNT;
        _mint(msg.sender, claimAmount);
        emit Claimed(msg.sender, claimAmount);
    }

    function setTreasury(address _treasuryAddress) external onlyOwner {
        if (_treasuryAddress == address(0)) revert TreasuryZero();
        treasury = _treasuryAddress;
        emit TreasuryUpdated(_treasuryAddress);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setWhitelisted(address[] calldata addrs, bool allowed) external onlyOwner {
        uint256 len = addrs.length;
        for (uint256 i = 0; i < len; ) {
            address account = addrs[i];
            isWhitelisted[account] = allowed;
            emit WhitelistUpdated(account, allowed);
            unchecked {
                ++i;
            }
        }
    }

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroRecipient();
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
        if (paused()) revert TokenPaused();

        address treas = treasury;
        uint256 currentFee = feeBps;

        // fee + limit
        if (treas != address(0) && currentFee != 0 && to != treas && from != treas) {
            uint256 limit = maxTransferAmount;
            if (limit != 0 && value > limit) revert TransferTooLarge();

            uint256 fee = (value * currentFee) / BPS_DENOMINATOR;
            if (fee != 0) {
                super._update(from, treas, fee);
                value -= fee;
            }
        }

        // default
        super._update(from, to, value);
    }
}
