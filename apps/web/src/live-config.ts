import type { AppNetwork, GoalStepAction } from "@nabungfi/shared/application";
import { EVM_DEPLOYMENTS } from "@nabungfi/shared/chain";
export const networks: Record<AppNetwork, string> = {
  solana: "Solana Devnet",
  base: "Base Sepolia",
  arbitrum: "Arbitrum Sepolia",
  ethereum: "Ethereum Sepolia",
};
export const walletExplorer = (network: AppNetwork, address: string) =>
  network === "solana"
    ? `https://explorer.solana.com/address/${encodeURIComponent(address)}?cluster=devnet`
    : `${EVM_DEPLOYMENTS[network].explorer}/address/${encodeURIComponent(address)}`;
export const actions: Record<GoalStepAction, string> = {
  "create-vault": "Create vault",
  initialize: "Initialize goal",
  approve: "Approve USDC",
  deposit: "Deposit USDC",
  prepare: "Prepare completion",
  abort: "Cancel completion",
  claim: "Claim savings",
};
export const phases: Record<string, string> = {
  unprovisioned: "Set up vaults",
  saving: "Saving",
  preparing: "Verifying completion",
  aborting: "Cancelling completion",
  achieved: "Goal achieved",
  claimed: "Collected",
};
export const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export const supportedChains = Object.entries(EVM_DEPLOYMENTS).map(
  ([key, chain]) => ({
    id: chain.chainId,
    name: networks[key as AppNetwork],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: {
        http: [
          key === "base"
            ? "https://sepolia.base.org"
            : key === "arbitrum"
              ? "https://sepolia-rollup.arbitrum.io/rpc"
              : "https://ethereum-sepolia-rpc.publicnode.com",
        ],
      },
    },
    blockExplorers: { default: { name: `${networks[key as AppNetwork]} explorer`, url: chain.explorer } },
    testnet: true,
  }),
);
