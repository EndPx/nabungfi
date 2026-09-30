// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAaveSupplyPool} from "../../src/AaveSupplyAdapter.sol";

/// @dev Test assets only; freely mintable and burnable. Never used by the mainnet-fork strategy.
contract MockUSDC is ERC20 {
    constructor() ERC20("TEST USDC", "TEST-USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}

contract MockAToken is ERC20 {
    address public immutable UNDERLYING_ASSET_ADDRESS;
    address public immutable POOL;

    constructor(address asset, address pool) ERC20("TEST aUSDC", "TEST-aUSDC") {
        UNDERLYING_ASSET_ADDRESS = asset;
        POOL = pool;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        require(msg.sender == POOL, "pool only");
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        require(msg.sender == POOL, "pool only");
        _burn(account, amount);
    }
}

/// @dev Adversarial test strategy: controllable interest, losses, liquidity and exit shortfalls.
///      The exit shortfall is NOT claimed to be an ordinary Aave withdrawal fee.
contract MockAavePool is IAaveSupplyPool {
    MockUSDC public immutable asset;
    MockAToken public immutable receipt;
    uint256 public availableLiquidity = type(uint256).max;
    uint256 public exitShortfall;
    bool public paused;

    error Illiquid();
    error Paused();

    constructor(MockUSDC asset_) {
        asset = asset_;
        receipt = new MockAToken(address(asset_), address(this));
    }

    function supply(address asset_, uint256 amount, address onBehalfOf, uint16) external {
        if (paused) revert Paused();
        require(asset_ == address(asset), "wrong asset");
        asset.transferFrom(msg.sender, address(this), amount);
        receipt.mint(onBehalfOf, amount);
    }

    function withdraw(address asset_, uint256 amount, address to) external returns (uint256 received) {
        if (paused) revert Paused();
        require(asset_ == address(asset), "wrong asset");
        if (amount == type(uint256).max) amount = receipt.balanceOf(msg.sender);
        if (amount > availableLiquidity) revert Illiquid();
        if (availableLiquidity != type(uint256).max) availableLiquidity -= amount;
        receipt.burn(msg.sender, amount);
        received = amount > exitShortfall ? amount - exitShortfall : 0;
        asset.transfer(to, received);
    }

    function accrue(address account, uint256 amount) external {
        receipt.mint(account, amount);
        asset.mint(address(this), amount);
    }

    function recognizeLoss(address account, uint256 amount) external {
        receipt.burn(account, amount);
    }

    function setAvailableLiquidity(uint256 amount) external {
        availableLiquidity = amount;
    }

    function setExitShortfall(uint256 amount) external {
        exitShortfall = amount;
    }

    function setPaused(bool value) external {
        paused = value;
    }
}
