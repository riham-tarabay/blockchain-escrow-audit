// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow
/// @notice Educational escrow state machine with pull-based ETH payouts.
/// @dev Not professionally audited; do not use for real funds.
contract Escrow is ReentrancyGuard {
    enum Status {
        Created,
        Funded,
        Completed,
        Disputed,
        Released,
        Refunded
    }

    struct EscrowRecord {
        address payable buyer;
        address payable seller;
        uint256 amount;
        uint64 deadline;
        Status status;
    }

    uint256 public nextEscrowId;
    address public immutable arbitrator;
    mapping(uint256 escrowId => EscrowRecord record) private escrows;
    mapping(address account => uint256 amount) public withdrawable;

    error InvalidSeller();
    error InvalidDeadline();
    error InvalidEscrow(uint256 escrowId);
    error Unauthorized();
    error InvalidState(Status actual, Status expected);
    error ZeroValue();
    error DeadlineNotReached();
    error DeadlinePassed();
    error NothingToWithdraw();
    error TransferFailed();
    error DirectTransferNotAllowed();

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 deadline
    );
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event WorkCompleted(uint256 indexed escrowId);
    event DisputeOpened(uint256 indexed escrowId, address indexed openedBy);
    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amount
    );
    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount
    );
    event DisputeResolved(uint256 indexed escrowId, bool releasedToSeller);
    event Withdrawal(address indexed account, uint256 amount);

    constructor(address arbitrator_) {
        if (arbitrator_ == address(0)) revert Unauthorized();
        arbitrator = arbitrator_;
    }

    function createEscrow(
        address payable seller,
        uint64 deadline
    ) external returns (uint256 escrowId) {
        if (seller == address(0) || seller == msg.sender) revert InvalidSeller();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        escrowId = nextEscrowId++;
        escrows[escrowId] = EscrowRecord({
            buyer: payable(msg.sender),
            seller: seller,
            amount: 0,
            deadline: deadline,
            status: Status.Created
        });
        emit EscrowCreated(escrowId, msg.sender, seller, deadline);
    }

    function fundEscrow(uint256 escrowId) external payable {
        EscrowRecord storage record = _get(escrowId);
        if (msg.sender != record.buyer) revert Unauthorized();
        if (record.status != Status.Created) {
            revert InvalidState(record.status, Status.Created);
        }
        if (msg.value == 0) revert ZeroValue();
        if (block.timestamp >= record.deadline) revert DeadlinePassed();

        record.amount = msg.value;
        record.status = Status.Funded;
        emit EscrowFunded(escrowId, msg.value);
    }

    function markWorkComplete(uint256 escrowId) external {
        EscrowRecord storage record = _get(escrowId);
        if (msg.sender != record.seller) revert Unauthorized();
        if (record.status != Status.Funded) {
            revert InvalidState(record.status, Status.Funded);
        }

        record.status = Status.Completed;
        emit WorkCompleted(escrowId);
    }

    function release(uint256 escrowId) external {
        EscrowRecord storage record = _get(escrowId);
        if (msg.sender != record.buyer) revert Unauthorized();
        if (record.status != Status.Completed) {
            revert InvalidState(record.status, Status.Completed);
        }

        _settle(escrowId, Status.Released);
        withdrawable[record.seller] += record.amount;
        emit EscrowReleased(escrowId, record.seller, record.amount);
    }

    function openDispute(uint256 escrowId) external {
        EscrowRecord storage record = _get(escrowId);
        if (msg.sender != record.buyer && msg.sender != record.seller) {
            revert Unauthorized();
        }
        if (record.status != Status.Funded && record.status != Status.Completed) {
            revert InvalidState(record.status, Status.Funded);
        }

        record.status = Status.Disputed;
        emit DisputeOpened(escrowId, msg.sender);
    }

    function resolveDispute(uint256 escrowId, bool releaseToSeller) external {
        EscrowRecord storage record = _get(escrowId);
        if (msg.sender != arbitrator) revert Unauthorized();
        if (record.status != Status.Disputed) {
            revert InvalidState(record.status, Status.Disputed);
        }

        if (releaseToSeller) {
            _settle(escrowId, Status.Released);
            withdrawable[record.seller] += record.amount;
            emit EscrowReleased(escrowId, record.seller, record.amount);
        } else {
            _settle(escrowId, Status.Refunded);
            withdrawable[record.buyer] += record.amount;
            emit EscrowRefunded(escrowId, record.buyer, record.amount);
        }
        emit DisputeResolved(escrowId, releaseToSeller);
    }

    function refundExpired(uint256 escrowId) external {
        EscrowRecord storage record = _get(escrowId);
        if (record.status != Status.Funded && record.status != Status.Completed) {
            revert InvalidState(record.status, Status.Funded);
        }
        if (block.timestamp < record.deadline) revert DeadlineNotReached();

        _settle(escrowId, Status.Refunded);
        withdrawable[record.buyer] += record.amount;
        emit EscrowRefunded(escrowId, record.buyer, record.amount);
    }

    function withdraw() external nonReentrant {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        withdrawable[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawal(msg.sender, amount);
    }

    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory) {
        return _get(escrowId);
    }

    receive() external payable {
        revert DirectTransferNotAllowed();
    }

    fallback() external payable {
        revert DirectTransferNotAllowed();
    }

    function _get(uint256 escrowId) private view returns (EscrowRecord storage record) {
        if (escrowId >= nextEscrowId) revert InvalidEscrow(escrowId);
        record = escrows[escrowId];
    }

    function _settle(uint256 escrowId, Status finalStatus) private {
        EscrowRecord storage record = _get(escrowId);
        record.status = finalStatus;
    }
}
