// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NabungGoalVault} from "./NabungGoalVault.sol";
import {NabungMultiVaultFactory} from "./NabungMultiVaultFactory.sol";
import {NabungMultiWire} from "./NabungMultiWire.sol";

interface IMultiEndpointIdentity {
    function eid() external view returns (uint32);
}

/// @notice V2 OApp for one EVM domain. Payloads use authentic factory routes and actual vault state.
contract NabungMultiLzRouter is OApp, ReentrancyGuard {
    NabungMultiVaultFactory public immutable factory;
    uint32 public immutable solanaEid;
    bytes32 public immutable solanaOApp;
    uint32 public immutable domain;
    uint32 public immutable eid;
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
        uint32 domain_,
        uint32 eid_,
        address asset,
        address pool,
        address receipt,
        NabungMultiVaultFactory.SolanaDeployment memory solana
    ) OApp(endpoint_, administrator) Ownable(administrator) {
        if (endpoint_.code.length == 0 || solanaEid_ == 0 || solanaOApp_ == 0) revert InvalidRoute();
        if (
            solanaEid_ != 40168 || !validNetwork(block.chainid, domain_, eid_)
                || IMultiEndpointIdentity(endpoint_).eid() != eid_
        ) revert InvalidRoute();
        domain = domain_;
        eid = eid_;
        solanaEid = solanaEid_;
        solanaOApp = solanaOApp_;
        _setPeer(solanaEid_, solanaOApp_);
        factory = new NabungMultiVaultFactory(asset, pool, receipt, domain_, eid_, solana);
    }

    function validNetwork(uint256 chainId, uint32 domain_, uint32 eid_) public pure returns (bool) {
        return (chainId == 84532 && domain_ == 2 && eid_ == 40245)
            || (chainId == 421614 && domain_ == 3 && eid_ == 40231)
            || (chainId == 11155111 && domain_ == 4 && eid_ == 40161);
    }

    /// @dev Configure/verify explicit libraries and DVNs before sealing. No goal may fund beforehand.
    function sealRoute() external nonReentrant onlyOwner {
        if (peers[solanaEid] != solanaOApp) revert InvalidRoute();
        routeSealed = true;
        _transferOwnership(address(0));
        endpoint.setDelegate(address(this));
        emit RouteSealed();
    }

    function setPeer(uint32 remoteEid, bytes32 peer) public override onlyOwner {
        if (remoteEid != solanaEid || peer != solanaOApp) revert InvalidRoute();
        _setPeer(remoteEid, peer);
    }

    function createGoal(NabungMultiVaultFactory.GoalRequest calldata request)
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
        return _quote(solanaEid, NabungMultiWire.encode(_report(vault, sequence)), options, false);
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
        return _quote(solanaEid, NabungMultiWire.encode(_registration(vault)), options, false);
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
        NabungMultiWire.Packet memory packet = _evmPacket(goal);
        packet.kind = NabungMultiWire.PROGRESS;
        packet.sequence = goal.progressSequence() + 1;
        packet.amount = NabungMultiWire.narrow(goal.totalAssets());
        return _quote(solanaEid, NabungMultiWire.encode(packet), options, false);
    }

    function sendProgress(address vault, bytes calldata options)
        external
        payable
        nonReentrant
        returns (MessagingReceipt memory)
    {
        NabungGoalVault goal = _registered(vault);
        NabungGoalVault.Report memory report = goal.reportProgress();
        NabungMultiWire.Packet memory packet = _evmPacket(goal);
        packet.kind = NabungMultiWire.PROGRESS;
        packet.sequence = report.sequence;
        packet.amount = NabungMultiWire.narrow(report.amount);
        return _send(vault, packet, options);
    }

    function _registered(address vault) private view returns (NabungGoalVault) {
        if (!routeSealed || !isVault[vault]) revert InvalidRoute();
        if (!isGoalRegistered[vault]) revert NotRegistered();
        return NabungGoalVault(vault);
    }

    function _evmPacket(NabungGoalVault goal) private view returns (NabungMultiWire.Packet memory packet) {
        packet.sourceDomain = domain;
        packet.destinationDomain = 1;
        packet.goalId = goal.goalId();
        packet.configHash = goal.configHash();
        packet.source = goal.vaultId();
        packet.destination = goal.sourceCoordinator();
        packet.evmOwner = NabungMultiWire.addressId(goal.owner());
        packet.observation = NabungMultiWire.narrow(block.number);
        packet.observedAt = NabungMultiWire.narrow(block.timestamp);
    }

    function _report(address vault, uint64 sequence)
        private
        view
        returns (NabungMultiWire.Packet memory packet)
    {
        NabungGoalVault goal = _registered(vault);
        NabungGoalVault.Report memory report = goal.reportAt(sequence);
        packet = _evmPacket(goal);
        packet.kind = report.kind;
        packet.round = report.round;
        packet.sequence = report.sequence;
        packet.amount = NabungMultiWire.narrow(report.amount);
        packet.observation = NabungMultiWire.narrow(report.observationBlock);
        packet.observedAt = NabungMultiWire.narrow(report.observedAt);
    }

    function _registration(address vault) private view returns (NabungMultiWire.Packet memory packet) {
        NabungGoalVault goal = _registered(vault);
        packet = _evmPacket(goal);
        packet.kind = NabungMultiWire.REGISTERED;
        packet.amount = NabungMultiWire.narrow(goal.target());
    }

    function _send(address vault, NabungMultiWire.Packet memory packet, bytes calldata options)
        private
        returns (MessagingReceipt memory receipt)
    {
        receipt = _lzSend(
            solanaEid, NabungMultiWire.encode(packet), options, MessagingFee(msg.value, 0), msg.sender
        );
        emit MessageSubmitted(vault, packet.kind, packet.sequence, receipt.guid);
    }

    function _lzReceive(Origin calldata origin, bytes32, bytes calldata message, address, bytes calldata)
        internal
        override
    {
        if (!routeSealed || origin.srcEid != solanaEid || origin.sender != solanaOApp) revert InvalidRoute();
        NabungMultiWire.Packet memory packet = NabungMultiWire.decode(message);
        if (packet.sourceDomain != 1 || packet.destinationDomain != domain) revert InvalidRoute();
        address vaultAddress = address(uint160(uint256(packet.destination)));
        if (!isVault[vaultAddress]) revert InvalidRoute();
        NabungGoalVault vault = NabungGoalVault(vaultAddress);
        if (
            packet.source != vault.sourceCoordinator() || packet.goalId != vault.goalId()
                || packet.configHash != vault.configHash()
                || packet.evmOwner != NabungMultiWire.addressId(vault.owner())
        ) revert InvalidRoute();
        if (packet.kind == NabungMultiWire.REGISTER) {
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
                destinationChain: domain,
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
