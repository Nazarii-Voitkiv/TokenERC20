// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleAirdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    bytes32 public merkleRoot;

    mapping(uint256 => uint256) private claimedBitMap;

    event MerkleRootUpdated(bytes32 indexed newMerkleRoot);
    event Claimed(uint256 indexed index, address indexed account, uint256 amount);
    event FundsRecovered(address indexed to, uint256 amount);

    error AlreadyClaimed(uint256 index);
    error InvalidProof();
    error ZeroAddress();

    constructor(address tokenAddress, bytes32 initialMerkleRoot, address initialOwner) Ownable(initialOwner) {
        if (tokenAddress == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(tokenAddress);
        merkleRoot = initialMerkleRoot;
    }

    function claim(
        uint256 index,
        uint256 amount,
        bytes32[] calldata merkleProof
    )
        external
        nonReentrant
    {
        if (isClaimed(index)) {
            revert AlreadyClaimed(index);
        }

        bytes32 node = keccak256(abi.encodePacked(index, msg.sender, amount));
        bool isValid = MerkleProof.verifyCalldata(merkleProof, merkleRoot, node);
        if (!isValid) revert InvalidProof();

        _setClaimed(index);
        token.safeTransfer(msg.sender, amount);

        emit Claimed(index, msg.sender, amount);
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = 1 << claimedBitIndex;
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index) internal {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[claimedWordIndex] |= 1 << claimedBitIndex;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
        emit MerkleRootUpdated(newMerkleRoot);
    }

    function recover(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit FundsRecovered(to, amount);
    }
}
