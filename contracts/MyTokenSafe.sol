// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MyTokenSafe {
    error NotOwner();
    error OnlySelfCall();
    error OwnerDoesNotExist(address owner);
    error InvalidThreshold();
    error DuplicateOwner(address owner);
    error ZeroAddressOwner();
    error ZeroAddressTarget();
    error OwnerRequired();
    error TxDoesNotExist(uint256 txId);
    error TxAlreadyExecuted(uint256 txId);
    error TxAlreadyConfirmed(uint256 txId);
    error TxNotConfirmed(uint256 txId);
    error TxNotConfirmedBySender(uint256 txId);
    error ExecutionFailed(bytes reason);

    event Deposit(address indexed sender, uint256 amount);
    event OwnerAdded(address indexed newOwner);
    event OwnerRemoved(address indexed removedOwner);
    event ThresholdChanged(uint256 newThreshold);
    event TransactionSubmitted(uint256 indexed txId, address indexed to, uint256 value, bytes data);
    event TransactionConfirmed(uint256 indexed txId, address indexed owner);
    event TransactionRevoked(uint256 indexed txId, address indexed owner);
    event TransactionExecuted(uint256 indexed txId, address indexed executor);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    mapping(address => bool) public isOwner;
    address[] public owners;
    uint256 public threshold;

    Transaction[] private transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelfCall();
        _;
    }

    constructor(address[] memory _owners, uint256 _threshold) {
        uint256 ownersLength = _owners.length;
        if (_threshold == 0 || _threshold > ownersLength) revert InvalidThreshold();
        if (ownersLength == 0) revert InvalidThreshold();

        for (uint256 i = 0; i < ownersLength; i++) {
            address owner = _owners[i];
            if (owner == address(0)) revert ZeroAddressOwner();
            if (isOwner[owner]) revert DuplicateOwner(owner);

            isOwner[owner] = true;
            owners.push(owner);
            emit OwnerAdded(owner);
        }

        threshold = _threshold;
        emit ThresholdChanged(_threshold);
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submitTransaction(address to, uint256 value, bytes calldata data) external onlyOwner returns (uint256) {
        if (to == address(0)) revert ZeroAddressTarget();

        uint256 txId = transactions.length;
        transactions.push(Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            numConfirmations: 0
        }));

        emit TransactionSubmitted(txId, to, value, data);
        _confirmTransaction(txId, transactions[txId]);
        return txId;
    }

    function confirmTransaction(uint256 txId) public onlyOwner {
        Transaction storage transaction = _getTransaction(txId);
        _confirmTransaction(txId, transaction);
    }

    function revokeConfirmation(uint256 txId) external onlyOwner {
        Transaction storage transaction = _getTransaction(txId);
        if (transaction.executed) revert TxAlreadyExecuted(txId);
        if (!isConfirmed[txId][msg.sender]) revert TxNotConfirmedBySender(txId);

        isConfirmed[txId][msg.sender] = false;
        transaction.numConfirmations -= 1;
        emit TransactionRevoked(txId, msg.sender);
    }

    function executeTransaction(uint256 txId) external onlyOwner {
        Transaction storage transaction = _getTransaction(txId);
        if (transaction.executed) revert TxAlreadyExecuted(txId);
        if (transaction.numConfirmations < threshold) revert TxNotConfirmed(txId);

        transaction.executed = true;

        (bool success, bytes memory res) = transaction.to.call{value: transaction.value}(transaction.data);
        if (!success) {
            transaction.executed = false;
            revert ExecutionFailed(res);
        }

        emit TransactionExecuted(txId, msg.sender);
    }

    function addOwner(address newOwner) external onlySelf {
        if (newOwner == address(0)) revert ZeroAddressOwner();
        if (isOwner[newOwner]) revert DuplicateOwner(newOwner);

        isOwner[newOwner] = true;
        owners.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address ownerToRemove) external onlySelf {
        if (!isOwner[ownerToRemove]) revert OwnerDoesNotExist(ownerToRemove);
        if (owners.length <= 1) revert OwnerRequired();

        isOwner[ownerToRemove] = false;

        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == ownerToRemove) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        if (threshold > owners.length) {
            _changeThreshold(owners.length);
        }

        emit OwnerRemoved(ownerToRemove);
    }

    function changeThreshold(uint256 newThreshold) external onlySelf {
        _changeThreshold(newThreshold);
    }

    function _changeThreshold(uint256 newThreshold) internal {
        if (newThreshold == 0 || newThreshold > owners.length) revert InvalidThreshold();
        threshold = newThreshold;
        emit ThresholdChanged(newThreshold);
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 txId)
        external
        view
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)
    {
        Transaction storage transaction = _getTransaction(txId);
        return (transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations);
    }

    function _getTransaction(uint256 txId) internal view returns (Transaction storage) {
        if (txId >= transactions.length) revert TxDoesNotExist(txId);
        return transactions[txId];
    }

    function _confirmTransaction(uint256 txId, Transaction storage transaction) internal {
        if (transaction.executed) revert TxAlreadyExecuted(txId);
        if (isConfirmed[txId][msg.sender]) revert TxAlreadyConfirmed(txId);

        isConfirmed[txId][msg.sender] = true;
        unchecked {
            transaction.numConfirmations += 1;
        }
        emit TransactionConfirmed(txId, msg.sender);
    }
}
