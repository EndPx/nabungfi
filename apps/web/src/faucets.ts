import type { AppNetwork } from "@nabungfi/shared/application";

export const FAUCETS: ReadonlyArray<{
  network: AppNetwork;
  gasSymbol: "SOL" | "ETH";
  walletFamily: "solana" | "ethereum";
  gasUrl: string;
}> = [
  { network: "solana", gasSymbol: "SOL", walletFamily: "solana", gasUrl: "https://faucet.solana.com/" },
  { network: "base", gasSymbol: "ETH", walletFamily: "ethereum", gasUrl: "https://portal.cdp.coinbase.com/products/faucet" },
  { network: "arbitrum", gasSymbol: "ETH", walletFamily: "ethereum", gasUrl: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
  { network: "ethereum", gasSymbol: "ETH", walletFamily: "ethereum", gasUrl: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
];
export const USDC_FAUCET = "https://faucet.circle.com/";
