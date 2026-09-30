// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NabungGoalVault} from "./NabungGoalVault.sol";
import {NabungVaultFactory} from "./NabungVaultFactory.sol";
import {NabungWire} from "./NabungWire.sol";

/// @notice Common Base OApp. Payloads originate only from factory-owned routes and actual vault state.
contract NabungLzRouter is OApp, ReentrancyGuard {
    NabungVaultFactory public immutable factory;
    uint32 public immutable solanaEid;
    bytes32 public immutable solanaOApp;
    bool public routeSealed;
    mapping(address => bool) public isVault;
    mapping(address => bool) public isGoalRegistered;
    mapping(bytes32 => address) public vaultForCoordinator;

    error RouteNotSealed();
    error InvalidRoute();
    error NotRegistered();

    event VaultCreated(
        address indexed owner,
        address indexed vault,
        bytes32 indexed coordinator,
        bytes32 goalId,
        bytes32 configHash
    );
    event GoalRegistered(address indexed vault, bytes32 indexed coordinator);
    event MessageSubmitted(address indexed vault, uint8 kind, uint64 applicationSequence, bytes32 guid);
    event StaleCommandIgnored(address indexed vault, uint64 sequence);
    event RouteSealed();

    constructor(
        address endpoint_,
        address administrator,
        uint32 solanaEid_,
        bytes32 solanaOApp_,
        address asset,
        address pool,
        address receipt,
        NabungVaultFactory.SolanaDeployment memory solana
    ) OApp(endpoint_, administrator) Ownable(administrator) {
        if (endpoint_.code.length == 0 || solanaEid_ == 0 || solanaOApp_ == 0) revert InvalidRoute();
        solanaEid = solanaEid_;
        solanaOApp = solanaOApp_;
        _setPeer(solanaEid_, solanaOApp_);
        factory = new NabungVaultFactory(asset, pool, receipt, solana);
    }

    /// @dev Configure/verify explicit libraries and DVNs before sealing. No goal may fund beforehand.
    function sealRoute() external nonReentrant onlyOwner {
        if (peers[solanaEid] != solanaOApp) revert InvalidRoute();
        routeSealed = true;
        _transferOwnership(address(0));
        endpoint.setDelegate(address(this));
        emit RouteSealed();
    }

    function setPeer(uint32 eid, bytes32 peer) public override onlyOwner {
        if (eid != solanaEid || peer != solanaOApp) revert InvalidRoute();
        _setPeer(eid, peer);
    }

    function createGoal(NabungVaultFactory.GoalRequest calldata request)
        external
        nonReentrant
        returns (address)
    {
        if (!routeSealed) revert RouteNotSealed();
        if (vaultForCoordinator[request.solanaGoal] != address(0)) revert InvalidRoute();
        NabungGoalVault vault = factory.create(msg.sender, request);
        isVault[address(vault)] = true;
        emit VaultCreated(msg.sender, address(vault), request.solanaGoal, request.goalId, vault.configHash());
        return address(vault);
    }

    function quoteReport(address vault, uint64 sequence, bytes calldata options)
        external
        view
        returns (MessagingFee memory)
    {
        return _quote(solanaEid, NabungWire.encode(_report(vault, sequence)), options, false);
    }

    function sendReport(address vault, uint64 sequence, bytes calldata options)
        external
        payable
        nonReentrant
        returns (MessagingReceipt memory)
    {
        return _send(vault, _report(vault, sequence), options);
    }

    function quoteRegistration(address vault, bytes calldata options)
        external
        view
        returns (MessagingFee memory)
    {
        return _quote(solanaEid, NabungWire.encode(_registration(vault)), options, false);
    }

    function sendRegistration(address vault, bytes calldata options)
        external
        payable
        nonReentrant
        returns (MessagingReceipt memory)
    {
        return _send(vault, _registration(vault), options);
    }

    function quoteProgress(address vault, bytes calldata options)
        external
        view
        returns (MessagingFee memory)
    {
        NabungGoalVault goal = _registered(vault);
        NabungWire.Packet memory packet = _basePacket(goal);
        packet.kind = NabungWire.PROGRESS;
        packet.sequence = goal.progressSequence() + 1;
        packet.amount = NabungWire.narrow(goal.totalAssets());
        return _quote(solanaEid, NabungWire.encode(packet), options, false);
    }

    function sendProgress(address vault, bytes calldata options)
        external
        payable
        nonReentrant
        returns (MessagingReceipt memory)
    {
        NabungGoalVault goal = _registered(vault);
        NabungGoalVault.Report memory report = goal.reportProgress();
        NabungWire.Packet memory packet = _basePacket(goal);
        packet.kind = NabungWire.PROGRESS;
        packet.sequence = report.sequence;
        packet.amount = NabungWire.narrow(report.amount);
        return _send(vault, packet, options);
    }

    function _registered(address vault) private view returns (NabungGoalVault) {
        if (!routeSealed || !isVault[vault]) revert InvalidRoute();
        if (!isGoalRegistered[vault]) revert NotRegistered();
        return NabungGoalVault(vault);
    }

    function _basePacket(NabungGoalVault goal) private view returns (NabungWire.Packet memory packet) {
        packet.sourceDomain = 2;
        packet.destinationDomain = 1;
        packet.goalId = goal.goalId();
        packet.configHash = goal.configHash();
        packet.source = goal.vaultId();
        packet.destination = goal.sourceCoordinator();
        packet.baseOwner = NabungWire.addressId(goal.owner());
        packet.observation = NabungWire.narrow(block.number);
        packet.observedAt = NabungWire.narrow(block.timestamp);
    }

    function _report(address vault, uint64 sequence) private view returns (NabungWire.Packet memory packet) {
        NabungGoalVault goal = _registered(vault);
        NabungGoalVault.Report memory report = goal.reportAt(sequence);
        packet = _basePacket(goal);
        packet.kind = report.kind;
        packet.round = report.round;
        packet.sequence = report.sequence;
        packet.amount = NabungWire.narrow(report.amount);
        packet.observation = NabungWire.narrow(report.observationBlock);
        packet.observedAt = NabungWire.narrow(report.observedAt);
    }

    function _registration(address vault) private view returns (NabungWire.Packet memory packet) {
        NabungGoalVault goal = _registered(vault);
        packet = _basePacket(goal);
        packet.kind = NabungWire.REGISTERED;
        packet.amount = NabungWire.narrow(goal.target());
    }

    function _send(address vault, NabungWire.Packet memory packet, bytes calldata options)
        private
        returns (MessagingReceipt memory receipt)
    {
        receipt = _lzSend(
            solanaEid, NabungWire.encode(packet), options, MessagingFee(msg.value, 0), msg.sender
        );
        emit MessageSubmitted(vault, packet.kind, packet.sequence, receipt.guid);
    }

    function _lzReceive(Origin calldata origin, bytes32, bytes calldata message, address, bytes calldata)
        internal
        override
    {
        if (!routeSealed || origin.srcEid != solanaEid || origin.sender != solanaOApp) revert InvalidRoute();
        NabungWire.Packet memory packet = NabungWire.decode(message);
        if (packet.sourceDomain != 1 || packet.destinationDomain != 2) revert InvalidRoute();
        address vaultAddress = address(uint160(uint256(packet.destination)));
        if (!isVault[vaultAddress]) revert InvalidRoute();
        NabungGoalVault vault = NabungGoalVault(vaultAddress);
        if (
            packet.source != vault.sourceCoordinator() || packet.goalId != vault.goalId()
                || packet.configHash != vault.configHash()
                || packet.baseOwner != NabungWire.addressId(vault.owner())
        ) revert InvalidRoute();
        if (packet.kind == NabungWire.REGISTER) {
            if (packet.amount != vault.target()) revert InvalidRoute();
            address registered = vaultForCoordinator[packet.source];
            if (registered != address(0) && registered != vaultAddress) revert InvalidRoute();
            vaultForCoordinator[packet.source] = vaultAddress;
            isGoalRegistered[vaultAddress] = true;
            emit GoalRegistered(vaultAddress, packet.source);
            return;
        }
        if (!isGoalRegistered[vaultAddress]) revert NotRegistered();
        if (packet.sequence <= vault.commandSequence()) {
            emit StaleCommandIgnored(vaultAddress, packet.sequence);
            return;
        }
        vault.receiveCommand(
            1,
            packet.source,
            NabungGoalVault.Command({
                goalId: packet.goalId,
                configHash: packet.configHash,
                destinationChain: 2,
                destinationVault: packet.destination,
                round: packet.round,
                sequence: packet.sequence,
                messageKind: NabungGoalVault.MessageKind(packet.kind),
                preparedAssets: packet.amount,
                aggregateReserved: packet.aggregate
            })
        );
    }
}
