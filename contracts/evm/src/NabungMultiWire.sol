// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Fixed-width big-endian encoding shared with the Solana transport.
library NabungMultiWire {
    uint256 internal constant LENGTH = 222;
    bytes4 internal constant MAGIC = 0x4e424647; // NBFG
    uint8 internal constant VERSION = 2;
    uint8 internal constant PREPARE = 1;
    uint8 internal constant COMMIT = 2;
    uint8 internal constant ABORT = 3;
    uint8 internal constant READY = 4;
    uint8 internal constant ABORT_ACK = 5;
    uint8 internal constant PROGRESS = 6;
    uint8 internal constant REGISTER = 7;
    uint8 internal constant REGISTERED = 8;

    struct Packet {
        uint8 kind;
        uint32 sourceDomain;
        uint32 destinationDomain;
        bytes32 goalId;
        bytes32 configHash;
        bytes32 source;
        bytes32 destination;
        bytes32 evmOwner;
        uint64 round;
        uint64 sequence;
        uint64 amount;
        uint64 aggregate;
        uint64 observation;
        uint64 observedAt;
    }

    error InvalidPacket();

    function encode(Packet memory p) internal pure returns (bytes memory) {
        validate(p);
        return bytes.concat(
            abi.encodePacked(MAGIC, VERSION, p.kind, p.sourceDomain, p.destinationDomain),
            abi.encodePacked(p.goalId, p.configHash, p.source, p.destination, p.evmOwner),
            abi.encodePacked(p.round, p.sequence, p.amount, p.aggregate, p.observation, p.observedAt)
        );
    }

    function decode(bytes calldata raw) internal pure returns (Packet memory p) {
        if (raw.length != LENGTH || bytes4(raw[0:4]) != MAGIC || uint8(raw[4]) != VERSION) {
            revert InvalidPacket();
        }
        p.kind = uint8(raw[5]);
        p.sourceDomain = uint32(bytes4(raw[6:10]));
        p.destinationDomain = uint32(bytes4(raw[10:14]));
        p.goalId = bytes32(raw[14:46]);
        p.configHash = bytes32(raw[46:78]);
        p.source = bytes32(raw[78:110]);
        p.destination = bytes32(raw[110:142]);
        p.evmOwner = bytes32(raw[142:174]);
        p.round = uint64(bytes8(raw[174:182]));
        p.sequence = uint64(bytes8(raw[182:190]));
        p.amount = uint64(bytes8(raw[190:198]));
        p.aggregate = uint64(bytes8(raw[198:206]));
        p.observation = uint64(bytes8(raw[206:214]));
        p.observedAt = uint64(bytes8(raw[214:222]));
        validate(p);
    }

    function addressId(address account) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    function isEvmAddress(bytes32 account) internal pure returns (bool) {
        return account != 0 && uint256(account) >> 160 == 0;
    }

    function narrow(uint256 value) internal pure returns (uint64) {
        if (value > type(uint64).max) revert InvalidPacket();
        return uint64(value);
    }

    function validate(Packet memory p) internal pure {
        bool fromSolana = p.sourceDomain == 1 && p.destinationDomain >= 2 && p.destinationDomain <= 4;
        bool fromEvm = p.sourceDomain >= 2 && p.sourceDomain <= 4 && p.destinationDomain == 1;
        if (
            (!fromSolana && !fromEvm) || p.goalId == 0 || p.configHash == 0 || p.source == 0
                || p.destination == 0 || !isEvmAddress(p.evmOwner)
                || !isEvmAddress(fromEvm ? p.source : p.destination)
        ) revert InvalidPacket();
        bool command = p.kind == PREPARE || p.kind == COMMIT || p.kind == ABORT || p.kind == REGISTER;
        bool report = p.kind == READY || p.kind == ABORT_ACK || p.kind == PROGRESS || p.kind == REGISTERED;
        if (!(fromSolana && command) && !(fromEvm && report)) revert InvalidPacket();
        if (p.kind == REGISTER || p.kind == REGISTERED) {
            if (p.round != 0 || p.sequence != 0 || p.amount == 0 || p.aggregate != 0) revert InvalidPacket();
        } else if (p.kind == PROGRESS) {
            if (p.round != 0 || p.sequence == 0 || p.aggregate != 0) revert InvalidPacket();
        } else {
            if (p.round == 0 || p.sequence == 0) revert InvalidPacket();
            if (p.kind == COMMIT) {
                if (p.aggregate == 0 || p.aggregate < p.amount) revert InvalidPacket();
            } else if (p.aggregate != 0) {
                revert InvalidPacket();
            }
            if ((p.kind == PREPARE || p.kind == ABORT || p.kind == ABORT_ACK) && p.amount != 0) {
                revert InvalidPacket();
            }
        }
        if (p.observation == 0 || p.observedAt == 0) revert InvalidPacket();
    }
}

