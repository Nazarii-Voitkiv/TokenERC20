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

    uint256 public maxTransferAmount;
    uint256 public CLAIM_AMOUNT = 100 * 10 ** 18;
    mapping (address => bool) public hasClaimed;

    function setMaxTransferAmount(uint _maxTransferAmount) external onlyOwner {
        maxTransferAmount = _maxTransferAmount;
    }

    function claimFreeTokens() external {
        require(!hasClaimed[msg.sender], "already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, CLAIM_AMOUNT);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            if (maxTransferAmount != 0) {
                require(value <= maxTransferAmount, "too big transfer");
            }
        }
        require(!paused(), "Token is paused");
        super._update(from, to, value);
    }
}