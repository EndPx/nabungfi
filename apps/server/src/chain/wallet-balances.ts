import { PublicKey } from '@solana/web3.js';
import type { VerifiedWallet, WalletBalanceDTO, AppNetwork } from '@nabungfi/shared/application';
import { EVM_DEPLOYMENTS, SOLANA_DEPLOYMENT } from '@nabungfi/shared/chain';
import { ABI, addressWord, ownerAta } from './codec.js';
import { tokenBalance } from './state.js';
import type { RpcTransport } from './rpc.js';

const quantity = (value: string) => {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(value)) throw new Error('Invalid balance');
  return BigInt(value).toString();
};

/** Wallet cash only: no goal, vault, strategy or portfolio aggregation. */
export async function readWalletBalances(rpc: RpcTransport, wallets: readonly VerifiedWallet[]): Promise<WalletBalanceDTO[]> {
  const results: WalletBalanceDTO[] = [];
  for (const wallet of wallets) {
    const networks: AppNetwork[] = wallet.chainType === 'solana' ? ['solana'] : ['base', 'arbitrum', 'ethereum'];
    results.push(...await Promise.all(networks.map(async network => {
      try {
        let usdcRaw: string, nativeRaw: string;
        if (network === 'solana') {
          if (await rpc.solana.getGenesisHash() !== SOLANA_DEPLOYMENT.genesis) throw new Error('Wrong chain');
          const [account, balance] = await Promise.all([
            rpc.solana.getAccountInfo(new PublicKey(ownerAta(wallet.address)), 'confirmed'),
            rpc.solana.getBalance(new PublicKey(wallet.address), 'confirmed'),
          ]);
          if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid SOL balance');
          usdcRaw = tokenBalance(account, wallet.address);
          nativeRaw = String(balance);
        } else {
          const chainId = await rpc.call<string>(network, 'eth_chainId', []);
          if (quantity(chainId) !== String(EVM_DEPLOYMENTS[network].chainId)) throw new Error('Wrong chain');
          const block = await rpc.call<string>(network, 'eth_blockNumber', []);
          quantity(block);
          const [token, native] = await Promise.all([
            rpc.call<string>(network, 'eth_call', [{ to: EVM_DEPLOYMENTS[network].asset, data: '0x' + ABI.balanceOf + addressWord(wallet.address) }, block]),
            rpc.call<string>(network, 'eth_getBalance', [wallet.address, block]),
          ]);
          if (!/^0x[0-9a-f]{64}$/i.test(token)) throw new Error('Invalid USDC balance');
          usdcRaw = quantity(token); nativeRaw = quantity(native);
        }
        return { network, address: wallet.address, status: 'available' as const, usdcRaw, nativeRaw, observedAt: new Date().toISOString() };
      } catch {
        return { network, address: wallet.address, status: 'unavailable' as const, usdcRaw: null, nativeRaw: null, observedAt: new Date().toISOString() };
      }
    })));
  }
  return results;
}
