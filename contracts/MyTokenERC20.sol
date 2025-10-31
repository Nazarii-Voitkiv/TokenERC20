// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract MyToken is ERC20, ERC20Burnable, Ownable, Pausable {
    constructor(string memory name_, string memory symbol_, uint256 initialSupplyWhole)
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        _mint(msg.sender, initialSupplyWhole * 10 ** decimals());
    }

    address public treasury;
    uint256 public feeBps = 100;
    uint256 public maxTransferAmount;
    uint256 public CLAIM_AMOUNT = 100 * 10 ** 18;
    mapping (address => bool) public hasClaimed;
    mapping (address => bool) public isWhitelisted;

    function setMaxTransferAmount(uint _maxTransferAmount) external onlyOwner {
        maxTransferAmount = _maxTransferAmount;
    }

    function claimFreeTokens() external {
        require(!hasClaimed[msg.sender], "already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, CLAIM_AMOUNT);
    }

    function setTreasury(address _treasuryAddress) external onlyOwner {
        treasury = _treasuryAddress;
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, 'fee too high');
        feeBps = _feeBps;
    }

    function setWhitelisted(address _address, bool allowed) external onlyOwner {
        isWhitelisted[_address] = allowed;
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
        if (
            from != address(0) && 
            to != address(0) && 
            (isWhitelisted[from] || isWhitelisted[to])
            ) {
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