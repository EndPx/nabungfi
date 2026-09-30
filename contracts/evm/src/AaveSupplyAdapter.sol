// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAaveSupplyPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

interface IAaveReceipt is IERC20 {
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
    function POOL() external view returns (address);
}

/// @notice Supply-only Aave V3 integration. The inheriting vault owns its aTokens.
/// @dev No delegatecall, arbitrary call, borrowing, receipt transfer or external position owner.
abstract contract AaveSupplyAdapter {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    IAaveSupplyPool public immutable lendingPool;
    IAaveReceipt public immutable aToken;

    error InvalidStrategy();
    error UnexpectedAssetDelta();
    error MinimumReceivedNotMet(uint256 received, uint256 minimum);

    constructor(address asset_, address pool_, address aToken_) {
        if (asset_.code.length == 0 || pool_.code.length == 0 || aToken_.code.length == 0) {
            revert InvalidStrategy();
        }
        if (
            IERC20Metadata(asset_).decimals() != 6
                || IAaveReceipt(aToken_).UNDERLYING_ASSET_ADDRESS() != asset_
                || IAaveReceipt(aToken_).POOL() != pool_
        ) revert InvalidStrategy();

        asset = IERC20(asset_);
        lendingPool = IAaveSupplyPool(pool_);
        aToken = IAaveReceipt(aToken_);
    }

    /// @notice Current local position value, not a promise that the pool can redeem it now.
    /// @dev The aToken balance already includes accrued interest. Historical deposits are not added.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + aToken.balanceOf(address(this));
    }

    function _supply(uint256 amount) internal {
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.forceApprove(address(lendingPool), amount);
        lendingPool.supply(address(asset), amount, address(this), 0);
        asset.forceApprove(address(lendingPool), 0);
        if (asset.balanceOf(address(this)) + amount != beforeBalance) revert UnexpectedAssetDelta();
    }

    function _redeem(uint256 amount, uint256 minimumReceived) internal returns (uint256 received) {
        uint256 beforeBalance = asset.balanceOf(address(this));
        uint256 reported = lendingPool.withdraw(address(asset), amount, address(this));
        received = asset.balanceOf(address(this)) - beforeBalance;
        if (reported != received) revert UnexpectedAssetDelta();
        if (received < minimumReceived) revert MinimumReceivedNotMet(received, minimumReceived);
    }
}
