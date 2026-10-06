import type { AppNetwork } from "@nabungfi/shared/application";

export const FAUCETS: ReadonlyArray<{
  network: AppNetwork;
  gasSymbol: "SOL" | "ETH";
  walletFamily: "solana" | "ethereum";
  gasProvider: string;
  gasUrl: string;
  gasHelp: string;
  sourceUrl: string;
}> = [
  { network: "solana", gasSymbol: "SOL", walletFamily: "solana", gasProvider: "Solana Foundation", gasUrl: "https://faucet.solana.com/", gasHelp: "Choose Devnet and paste your Solana wallet address.", sourceUrl: "https://solana.com/developers/guides/getstarted/solana-token-airdrop-and-faucets" },
  { network: "base", gasSymbol: "ETH", walletFamily: "ethereum", gasProvider: "Coinbase Developer Platform", gasUrl: "https://portal.cdp.coinbase.com/products/faucet", gasHelp: "Select Base Sepolia. The provider may ask you to sign in.", sourceUrl: "https://docs.base.org/get-started/get-funds" },
  { network: "arbitrum", gasSymbol: "ETH", walletFamily: "ethereum", gasProvider: "Alchemy", gasUrl: "https://www.alchemy.com/faucets/arbitrum-sepolia", gasHelp: "Alchemy requires mainnet balance and activity for eligibility. More providers are listed in the network guide.", sourceUrl: "https://docs.arbitrum.io/chain-info#faucet-list" },
  { network: "ethereum", gasSymbol: "ETH", walletFamily: "ethereum", gasProvider: "Google Cloud", gasUrl: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia", gasHelp: "Use Ethereum Sepolia and paste your EVM wallet address. Google sign-in may be required.", sourceUrl: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
];
export const USDC_FAUCET = "https://faucet.circle.com/";
