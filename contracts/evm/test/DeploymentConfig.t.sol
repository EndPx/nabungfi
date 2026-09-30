// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {NabungFiDeploymentConfig} from "../script/NabungFiDeploymentConfig.sol";
import {NabungVaultFactory} from "../src/NabungVaultFactory.sol";
import {MockUSDC, MockAToken, MockAavePool} from "./mocks/MockAavePool.sol";
import {MockLayerZeroEndpoint} from "./mocks/MockLayerZeroEndpoint.sol";
import {DeployNabungFi} from "../script/DeployNabungFi.s.sol";
import {NabungLzRouter} from "../src/NabungLzRouter.sol";

contract ConfigHarness is NabungFiDeploymentConfig {}

contract DeploymentHarness is DeployNabungFi {
    Config private selected;

    function select(Config memory value) external {
        selected = value;
    }

    function loadConfig() internal view override returns (Config memory) {
        validate(selected);
        return selected;
    }
}

contract DeploymentConfigTest is Test {
    ConfigHarness internal config;
    NabungFiDeploymentConfig.Config internal valid;

    function setUp() public {
        config = new ConfigHarness();
        MockUSDC deployed = new MockUSDC();
        address canonical = config.circleUsdc(84532);
        vm.etch(canonical, address(deployed).code);
        MockUSDC usdc = MockUSDC(canonical);
        MockAavePool pool = new MockAavePool(usdc);
        MockLayerZeroEndpoint endpoint = new MockLayerZeroEndpoint();
        vm.chainId(84532);
        vm.mockCall(address(endpoint), abi.encodeWithSignature("eid()"), abi.encode(uint32(40245)));
        bytes32 sentinel = 0x1b33c4559a2affe7d69e3aa38e66394675c1b3ea388c057e202cfb7946bf0ee5;
        valid = NabungFiDeploymentConfig.Config({
            chainId: 84532,
            eid: 40245,
            administrator: address(this),
            expectedNonce: 1,
            endpoint: address(endpoint),
            asset: address(usdc),
            pool: address(pool),
            receipt: address(pool.receipt()),
            cashOnly: false,
            solanaEid: 40168,
            solanaOApp: 0x454257dcb2f8449ec59059f823c55d3cc76f8aa49e6d9777e9545bbbfb30d382,
            solana: NabungVaultFactory.SolanaDeployment({
                    program: 0x2ae188a7b7cc530e87ee0df25e73fb9056462df6ebd65334555a9ef98f8829e3,
                    usdcMint: 0x3b442cb3912157f13a933d0134282d032b5ffecd01a2dbf1b7790608df002ea7,
                    kaminoMarket: sentinel,
                    kaminoReserve: sentinel,
                    collateralMint: sentinel,
                    liquiditySupply: sentinel,
                    transportProgram: 0xd9beb19dc5388856fe3b69f65d61dcb5965b3ed5c21a54e54ab54dda717813c5
                })
        });
    }

    function testWrongChainAndEndpointRejected() public {
        vm.chainId(1);
        vm.expectRevert(NabungFiDeploymentConfig.InvalidNetwork.selector);
        config.validate(valid);
        vm.chainId(84532);
        valid.chainId = 1;
        vm.expectRevert(NabungFiDeploymentConfig.UnsupportedChain.selector);
        config.validate(valid);
        valid.chainId = 84532;
        valid.eid = 40161;
        vm.expectRevert(NabungFiDeploymentConfig.InvalidNetwork.selector);
        config.validate(valid);
    }

    function testReceiptForDifferentAssetRejected() public {
        valid.receipt = address(new MockAToken(address(0xBAD), valid.pool));
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
    }

    function testReceiptForDifferentPoolRejected() public {
        valid.receipt = address(new MockAToken(valid.asset, address(0xBAD)));
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
    }

    function testWrongDecimalsRejected() public {
        vm.mockCall(valid.asset, abi.encodeWithSignature("decimals()"), abi.encode(uint8(18)));
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
    }

    function testNoncanonicalUsdcRejected() public {
        valid.asset = address(new MockUSDC());
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
    }

    function testExplicitCashOnlyRequiresBothStrategyAddressesZero() public {
        valid.cashOnly = true;
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
        valid.pool = address(0);
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
        valid.receipt = address(0);
        config.validate(valid);
        valid.cashOnly = false;
        vm.expectRevert(NabungFiDeploymentConfig.InvalidAsset.selector);
        config.validate(valid);
    }

    function testDeployEntrypointLeavesRouterUnsealedAndZeroGoals() public {
        DeploymentHarness deploy = new DeploymentHarness();
        valid.administrator = address(0xBEEF);
        valid.expectedNonce = vm.getNonce(valid.administrator);
        deploy.select(valid);
        NabungLzRouter router = deploy.run();
        assertEq(router.owner(), valid.administrator);
        assertFalse(router.routeSealed());
        assertEq(router.peers(40168), valid.solanaOApp);
        assertEq(router.factory().creationNonce(), 1);
        assertEq(router.factory().asset(), valid.asset);
    }

    function testDeployEntrypointRejectsStaleNonce() public {
        DeploymentHarness deploy = new DeploymentHarness();
        valid.administrator = address(0xBEEF);
        valid.expectedNonce = vm.getNonce(valid.administrator) + 1;
        deploy.select(valid);
        vm.expectRevert(DeployNabungFi.UnexpectedNonce.selector);
        deploy.run();
    }

    function testDeployEntrypointCashOnlyDisablesStrategy() public {
        DeploymentHarness deploy = new DeploymentHarness();
        valid.administrator = address(0xBEEF);
        valid.expectedNonce = vm.getNonce(valid.administrator);
        valid.cashOnly = true;
        valid.pool = address(0);
        valid.receipt = address(0);
        deploy.select(valid);
        NabungLzRouter router = deploy.run();
        assertFalse(router.routeSealed());
        assertEq(router.factory().pool(), address(0));
        assertEq(router.factory().receipt(), address(0));
        assertEq(router.factory().creationNonce(), 1);
    }

    function testEndpointActualEidMismatchRejected() public {
        vm.mockCall(valid.endpoint, abi.encodeWithSignature("eid()"), abi.encode(uint32(40161)));
        vm.expectRevert(NabungFiDeploymentConfig.InvalidNetwork.selector);
        config.validate(valid);
    }

    function testTransportProgramCannotReplaceStorePeer() public {
        valid.solanaOApp = valid.solana.transportProgram;
        vm.expectRevert(NabungFiDeploymentConfig.InvalidSolanaProfile.selector);
        config.validate(valid);
    }

    function testMainnetStrategyCannotEnterCashOnlyProfile() public {
        valid.solana.kaminoReserve = bytes32(uint256(1));
        vm.expectRevert(NabungFiDeploymentConfig.InvalidSolanaProfile.selector);
        config.validate(valid);
    }
}
