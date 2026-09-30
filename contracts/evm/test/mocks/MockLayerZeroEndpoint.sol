// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    MessagingParams,
    MessagingFee,
    MessagingReceipt,
    Origin
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {OApp} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/// @dev Test endpoint only. Does not model DVN verification or claim network delivery.
contract MockLayerZeroEndpoint {
    uint256 public constant FEE = 0.001 ether;
    mapping(address => address) public delegates;
    uint64 public nonce;
    bytes public lastMessage;
    address public lastSender;
    bytes32 public lastReceiver;
    uint32 public lastEid;

    error InsufficientFee();

    function setDelegate(address delegate) external {
        delegates[msg.sender] = delegate;
    }

    function quote(MessagingParams calldata, address) external pure returns (MessagingFee memory) {
        return MessagingFee(FEE, 0);
    }

    function send(MessagingParams calldata params, address refund)
        external
        payable
        returns (MessagingReceipt memory)
    {
        if (msg.value < FEE) revert InsufficientFee();
        lastMessage = params.message;
        lastSender = msg.sender;
        lastReceiver = params.receiver;
        lastEid = params.dstEid;
        ++nonce;
        if (msg.value > FEE) {
            (bool success,) = refund.call{value: msg.value - FEE}("");
            require(success, "refund");
        }
        return MessagingReceipt(
            keccak256(abi.encode(msg.sender, nonce, params.message)), nonce, MessagingFee(FEE, 0)
        );
    }

    function deliver(OApp app, Origin calldata origin, bytes calldata payload) external {
        app.lzReceive(origin, keccak256(abi.encode(origin, payload)), payload, msg.sender, "");
    }
}
