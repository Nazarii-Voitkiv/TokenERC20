// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../../contracts/MyTokenERC20.sol";
import "../../contracts/MyTokenSafe.sol";

contract MyTokenSafeTest is Test {
    MyToken private token;
    MyTokenSafe private safe;

    address private ownerA = address(0xA11CE);
    address private ownerB = address(0xB0B);
    address private ownerC = address(0xC0DE);
    address private treasury = address(0x7EA5);
    address private outsider = address(0xDEAD);

    uint256 private constant INITIAL_SUPPLY = 1_000_000;
    uint256 private constant CLAIM_AMOUNT = 100;

    function setUp() public {
        token = new MyToken("MyToken", "MTK", INITIAL_SUPPLY, CLAIM_AMOUNT);

        address[] memory owners = new address[](3);
        owners[0] = ownerA;
        owners[1] = ownerB;
        owners[2] = ownerC;

        safe = new MyTokenSafe(owners, 2);
        token.transferOwnership(address(safe));
    }

    function _submit(bytes memory data) internal returns (uint256 txId) {
        vm.prank(ownerA);
        txId = safe.submitTransaction(address(token), 0, data);
    }

    function testPauseFlowThroughMultisig() public {
        uint256 txId = _submit(abi.encodeWithSelector(token.pause.selector));

        vm.prank(ownerB);
        safe.confirmTransaction(txId);

        vm.prank(ownerB);
        safe.executeTransaction(txId);

        assertTrue(token.paused(), "token should be paused");
        (,, , bool executed,) = safe.getTransaction(txId);
        assertTrue(executed, "transaction should be marked executed");
    }

    function testThresholdRequiredBeforeExecute() public {
        uint256 txId = _submit(abi.encodeWithSelector(token.setTreasury.selector, treasury));

        vm.expectRevert(abi.encodeWithSelector(MyTokenSafe.TxNotConfirmed.selector, txId));
        vm.prank(ownerA);
        safe.executeTransaction(txId);

        vm.prank(ownerB);
        safe.confirmTransaction(txId);

        vm.prank(ownerB);
        safe.executeTransaction(txId);

        assertEq(token.treasury(), treasury, "treasury should update once quorum met");
    }

    function testRevokeAndReconfirm() public {
        uint256 txId = _submit(abi.encodeWithSelector(token.setFeeBps.selector, 250));

        vm.prank(ownerB);
        safe.confirmTransaction(txId);
        (,,,, uint256 confirmationsBefore) = safe.getTransaction(txId);
        assertEq(confirmationsBefore, 2, "confirmation should count submitter + ownerB");

        vm.prank(ownerB);
        safe.revokeConfirmation(txId);
        (,,,, uint256 confirmationsAfterRevoke) = safe.getTransaction(txId);
        assertEq(confirmationsAfterRevoke, 1, "revocation should decrease confirmations");

        vm.prank(ownerB);
        safe.confirmTransaction(txId);
        vm.prank(ownerC);
        safe.confirmTransaction(txId);
        (,,,, uint256 confirmationsAfter) = safe.getTransaction(txId);
        assertEq(confirmationsAfter, 3, "all owners can confirm once");
    }

    function testExecutionFailureBubblesAndStateResets() public {
        uint256 txId =
            _submit(abi.encodeWithSelector(token.setFeeBps.selector, token.MAX_FEE_BPS() + 1));

        vm.prank(ownerB);
        safe.confirmTransaction(txId);

        vm.expectRevert(); // ExecutionFailed propagates revert data
        vm.prank(ownerB);
        safe.executeTransaction(txId);

        (,,,, uint256 confirmations) = safe.getTransaction(txId);
        assertEq(confirmations, 2, "confirmations remain after failed execution");
        (,, , bool executed,) = safe.getTransaction(txId);
        assertFalse(executed, "failed execution must reset executed flag");
    }

    function testNonOwnerCannotInteract() public {
        uint256 txId = _submit(abi.encodeWithSelector(token.pause.selector));

        vm.prank(outsider);
        vm.expectRevert(MyTokenSafe.NotOwner.selector);
        safe.confirmTransaction(txId);

        vm.prank(outsider);
        vm.expectRevert(MyTokenSafe.NotOwner.selector);
        safe.submitTransaction(address(token), 0, "");

        vm.prank(outsider);
        vm.expectRevert(MyTokenSafe.NotOwner.selector);
        safe.executeTransaction(txId);
    }
}
