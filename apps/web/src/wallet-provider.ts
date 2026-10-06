import type { ConnectedWallet, EIP1193Provider } from "@privy-io/react-auth";

export async function assertEvmProviderIdentity(provider: EIP1193Provider, owner: string, chainId: number): Promise<void> {
  const [accounts, actualChain] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  if (!Array.isArray(accounts) || !accounts.some(account => typeof account === "string" && account.toLowerCase() === owner.toLowerCase()))
    throw new Error("The provider is not connected to this goal's owner wallet. No transaction was requested.");
  if (BigInt(String(actualChain)) !== BigInt(chainId))
    throw new Error(`The wallet reports chain ${String(actualChain)} instead of ${chainId}. No transaction was requested.`);
}

export async function prepareEvmProvider(wallet: Pick<ConnectedWallet, "switchChain" | "getEthereumProvider">, owner: string, chainId: number): Promise<EIP1193Provider> {
  await wallet.switchChain(chainId);
  const provider = await wallet.getEthereumProvider();
  // Privy 3.46's switchChain updates React state; this wallet object's provider
  // closure can still refer to the previous render. Configure the actual instance.
  if (BigInt(String(await provider.request({ method: "eth_chainId" }))) !== BigInt(chainId))
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
  await assertEvmProviderIdentity(provider, owner, chainId);
  return provider;
}
