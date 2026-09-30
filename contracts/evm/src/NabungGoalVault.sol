// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AaveSupplyAdapter} from "./AaveSupplyAdapter.sol";

interface IGoalRegistration {
    function isGoalRegistered(address vault) external view returns (bool);
}

/// @notice Non-upgradeable, single-owner, single-goal USDC vault for the Base prototype.
/// @dev The LayerZero OApp is separate in NabungLzRouter. The immutable messenger
///      authenticates registration, coordinator and destination before receiveCommand.
contract NabungGoalVault is AaveSupplyAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Application domains, NOT EVM chain IDs or LayerZero endpoint IDs.
    uint32 public constant SOLANA_DOMAIN = 1;
    uint32 public constant BASE_DOMAIN = 2;

    enum Phase {
        Locked,
        Preparing,
        Ready,
        Achieved
    }

    enum MessageKind {
        Invalid,
        Prepare,
        Commit,
        Abort
    }

    enum RoundOutcome {
        None,
        Aborted,
        Committed
    }

    struct GoalConfig {
        address owner;
        bytes32 goalId;
        bytes32 configHash;
        uint256 target;
        address messenger;
        bytes32 sourceCoordinator;
        // Absolute USDC floor retained when the owner explicitly allocates to Aave.
        // A per-goal choice; this prototype does not invent a keeper allocation policy.
        uint256 minimumIdle;
    }

    struct Command {
        bytes32 goalId;
        bytes32 configHash;
        uint32 destinationChain;
        bytes32 destinationVault;
        uint64 round;
        uint64 sequence;
        MessageKind messageKind;
        // Used by Commit only. Must match this vault's emitted Ready amount.
        uint256 preparedAssets;
        // Remote coordinator certifies that all registered Ready amounts sum to this value.
        uint256 aggregateReserved;
    }

    struct Report {
        uint8 kind;
        uint64 round;
        uint64 sequence;
        uint256 amount;
        uint256 observationBlock;
        uint256 observedAt;
    }

    address public immutable owner;
    bytes32 public immutable goalId;
    bytes32 public immutable configHash;
    uint256 public immutable target;
    address public immutable messenger;
    bytes32 public immutable sourceCoordinator;
    uint256 public immutable minimumIdle;

    Phase public phase;
    uint64 public currentRound;
    uint64 public commandSequence;
    uint64 public reportSequence;
    uint64 public progressSequence;
    uint256 public depositedAssets;
    uint256 public preparedAssets;
    uint256 public claimedAssets;
    mapping(uint64 round => RoundOutcome) public roundOutcome;
    mapping(uint64 sequence => Report) private reports;

    error InvalidConfiguration();
    error Unauthorized();
    error WrongPeer();
    error WrongGoal();
    error WrongDestination();
    error WrongSequence(uint64 expected, uint64 actual);
    error WrongRound();
    error WrongPhase();
    error InvalidAmount();
    error IdleFloorViolated();
    error PositionNotRedeemed();
    error ReserveMismatch();
    error TargetNotMet();
    error InvalidMessageKind();
    error GoalNotRegistered();
    error UnknownReport();

    event Deposited(address indexed owner, uint256 assets, uint256 cumulativeDeposits);
    event Supplied(uint256 assets);
    event Redeemed(uint256 assets);
    event PreparationStarted(bytes32 indexed goalId, uint64 indexed round);
    event ProgressReported(
        bytes32 indexed goalId,
        bytes32 indexed configHash,
        uint32 sourceChain,
        bytes32 sourceVault,
        uint64 sequence,
        uint256 assets,
        uint256 observationBlock
    );
    event ReadyReported(
        bytes32 indexed goalId,
        bytes32 indexed configHash,
        uint32 sourceChain,
        bytes32 sourceVault,
        uint64 round,
        uint64 sequence,
        uint256 reservedAssets,
        uint256 observationBlock
    );
    event AbortAcknowledged(
        bytes32 indexed goalId,
        bytes32 indexed configHash,
        uint32 sourceChain,
        bytes32 sourceVault,
        uint64 round,
        uint64 sequence,
        uint256 observationBlock
    );
    event AchievementCommitted(bytes32 indexed goalId, uint64 indexed round, uint256 reservedAssets);
    event Claimed(address indexed owner, uint256 assets, uint256 cumulativeClaims);

    constructor(GoalConfig memory config, address asset_, address pool_, address aToken_)
        AaveSupplyAdapter(asset_, pool_, aToken_)
    {
        if (
            config.owner == address(0) || config.goalId == bytes32(0) || config.configHash == bytes32(0)
                || config.target == 0 || config.target > type(uint64).max || config.messenger.code.length == 0
                || config.sourceCoordinator == bytes32(0)
        ) revert InvalidConfiguration();

        owner = config.owner;
        goalId = config.goalId;
        configHash = config.configHash;
        target = config.target;
        messenger = config.messenger;
        sourceCoordinator = config.sourceCoordinator;
        minimumIdle = config.minimumIdle;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function vaultId() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    /// @notice Owner deposits are permitted while earning or while a round is preparing.
    /// @dev Preparing top-ups stay idle. Ready reserves cannot change through this method.
    function deposit(uint256 amount) external onlyOwner nonReentrant {
        _requireRegistration();
        if (phase != Phase.Locked && phase != Phase.Preparing) revert WrongPhase();
        if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) != beforeBalance + amount) revert UnexpectedAssetDelta();
        depositedAssets += amount;
        emit Deposited(owner, amount, depositedAssets);
    }

    /// @notice Explicit owner-directed allocation. No keeper may choose arbitrary exposure.
    function invest(uint256 amount) external onlyOwner nonReentrant {
        _requireRegistration();
        if (phase != Phase.Locked) revert WrongPhase();
        uint256 idle = asset.balanceOf(address(this));
        if (amount == 0 || amount > idle) revert InvalidAmount();
        if (idle - amount < minimumIdle) revert IdleFloorViolated();
        _supply(amount);
        emit Supplied(amount);
    }

    /// @notice Redeems only into this locked vault. type(uint256).max requests the whole position.
    /// @dev While Locked only the owner can recall; after preparation anybody can help redeem.
    ///      Calls remain retryable when Aave lacks liquidity. No cash is paid to the caller.
    ///      Later receipt donations may also be redeemed, without reducing a Ready reserve.
    function redeem(uint256 amount, uint256 minimumReceived) external nonReentrant returns (uint256) {
        if (phase == Phase.Locked && msg.sender != owner) revert Unauthorized();
        if (amount == 0) revert InvalidAmount();
        uint256 received = _redeem(amount, minimumReceived);
        emit Redeemed(received);
        return received;
    }

    /// @notice Permissionless reporting reads owned balances, never a keeper-supplied NAV.
    function reportProgress() external nonReentrant returns (Report memory report) {
        _requireRegistration();
        report = Report(6, 0, ++progressSequence, totalAssets(), block.number, block.timestamp);
        emit ProgressReported(
            goalId, configHash, BASE_DOMAIN, vaultId(), report.sequence, report.amount, block.number
        );
    }

    /// @notice Complete preparation only after every existing strategy receipt is redeemed.
    /// @dev The reserved amount is actual USDC, including any explicitly attributed top-ups.
    function markReady() external nonReentrant {
        if (phase != Phase.Preparing) revert WrongPhase();
        if (strategyReceiptBalance() != 0) revert PositionNotRedeemed();
        preparedAssets = asset.balanceOf(address(this));
        phase = Phase.Ready;
        ++reportSequence;
        reports[reportSequence] =
            Report(4, currentRound, reportSequence, preparedAssets, block.number, block.timestamp);
        emit ReadyReported(
            goalId,
            configHash,
            BASE_DOMAIN,
            vaultId(),
            currentRound,
            reportSequence,
            preparedAssets,
            block.number
        );
    }

    /// @notice Callable only by an immutable authenticating transport adapter.
    /// @dev Exact next sequence makes reordered messages retryable without replay credit.
    ///      The coordinator is trusted to prove remote reserves and complete/abort exclusivity.
    ///      Its signed aggregate cannot be independently recomputed by this local vault.
    function receiveCommand(uint32 sourceChain, bytes32 sender, Command calldata command)
        external
        nonReentrant
    {
        if (msg.sender != messenger) revert Unauthorized();
        _requireRegistration();
        if (sourceChain != SOLANA_DOMAIN || sender != sourceCoordinator) revert WrongPeer();
        if (command.goalId != goalId || command.configHash != configHash) revert WrongGoal();
        if (command.destinationChain != BASE_DOMAIN || command.destinationVault != vaultId()) {
            revert WrongDestination();
        }
        if (command.sequence != commandSequence + 1) {
            revert WrongSequence(commandSequence + 1, command.sequence);
        }
        if (command.messageKind == MessageKind.Invalid) revert InvalidMessageKind();

        if (command.messageKind == MessageKind.Prepare) {
            if (phase != Phase.Locked) revert WrongPhase();
            if (command.round != currentRound + 1) revert WrongRound();
            if (command.preparedAssets != 0 || command.aggregateReserved != 0) revert InvalidAmount();
            currentRound = command.round;
            phase = Phase.Preparing;
            emit PreparationStarted(goalId, currentRound);
        } else {
            if (command.round != currentRound || roundOutcome[currentRound] != RoundOutcome.None) {
                revert WrongRound();
            }
            if (command.messageKind == MessageKind.Commit) {
                if (phase != Phase.Ready) revert WrongPhase();
                if (
                    command.preparedAssets != preparedAssets
                        || asset.balanceOf(address(this)) < preparedAssets
                ) revert ReserveMismatch();
                if (command.aggregateReserved < target || command.aggregateReserved < preparedAssets) {
                    revert TargetNotMet();
                }
                roundOutcome[currentRound] = RoundOutcome.Committed;
                phase = Phase.Achieved;
                emit AchievementCommitted(goalId, currentRound, preparedAssets);
            } else {
                if (phase != Phase.Preparing && phase != Phase.Ready) revert WrongPhase();
                if (command.preparedAssets != 0 || command.aggregateReserved != 0) revert InvalidAmount();
                roundOutcome[currentRound] = RoundOutcome.Aborted;
                preparedAssets = 0;
                phase = Phase.Locked;
                ++reportSequence;
                reports[reportSequence] =
                    Report(5, currentRound, reportSequence, 0, block.number, block.timestamp);
                emit AbortAcknowledged(
                    goalId, configHash, BASE_DOMAIN, vaultId(), currentRound, reportSequence, block.number
                );
            }
        }
        commandSequence = command.sequence;
    }

    /// @notice Durable outbox: READY remains relayable even after an abort.
    function reportAt(uint64 sequence) external view returns (Report memory report) {
        report = reports[sequence];
        if (sequence == 0 || report.sequence != sequence) revert UnknownReport();
    }

    function _requireRegistration() internal view {
        if (!IGoalRegistration(messenger).isGoalRegistered(address(this))) revert GoalNotRegistered();
    }

    function claimableAssets() public view returns (uint256) {
        return phase == Phase.Achieved ? asset.balanceOf(address(this)) : 0;
    }

    /// @notice Claims never change achievement, even after this chain's last USDC is paid.
    /// @dev Only this immutable owner receives funds. Direct donations are also locked until achievement.
    function claim(uint256 amount) external onlyOwner nonReentrant {
        if (phase != Phase.Achieved) revert WrongPhase();
        if (amount == 0 || amount > claimableAssets()) revert InvalidAmount();
        claimedAssets += amount;
        asset.safeTransfer(owner, amount);
        emit Claimed(owner, amount, claimedAssets);
    }
}
