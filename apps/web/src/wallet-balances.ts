import type { AppNetwork, VerifiedWallet, WalletBalanceDTO } from '@nabungfi/shared/application';
import { formatNativeGas } from './savings-progress';
export const walletNetworks = (chainType: VerifiedWallet['chainType']): AppNetwork[] =>
  chainType === 'solana' ? ['solana'] : ['base', 'arbitrum', 'ethereum'];

export function walletGasLabel(raw: string, network: AppNetwork) {
  const exact = formatNativeGas(raw, network);
  const [amount, symbol] = exact.split(' ');
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length <= 8) return {display: exact, exact};
  const shown = fraction.slice(0,8).replace(/0+$/, '');
  return {display: whole === '0' && !shown ? `<0.00000001 ${symbol}` : `≈${whole}${shown ? '.'+shown : ''} ${symbol}`, exact};
}

/** Reject mismatched identities, duplicate networks and non-atomic balance values. */
export function validateWalletBalances(rows: WalletBalanceDTO[], wallets: readonly VerifiedWallet[]): WalletBalanceDTO[] {
  if (!Array.isArray(rows)) throw new Error('Invalid wallet balances');
  const expected = new Set(wallets.flatMap(wallet => walletNetworks(wallet.chainType).map(network => `${network}:${wallet.address}`)));
  if (rows.length !== expected.size) throw new Error('Incomplete wallet balances');
  for (const row of rows) {
    const key = `${row?.network}:${row?.address}`;
    if (!row || !expected.delete(key) || !Number.isFinite(Date.parse(row.observedAt))) throw new Error('Wallet identity mismatch');
    if (row.status === 'available') {
      if (![row.usdcRaw, row.nativeRaw].every(value => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value))) throw new Error('Invalid atomic balance');
    } else if (row.status !== 'unavailable' || row.usdcRaw !== null || row.nativeRaw !== null) throw new Error('Unavailable balance must not be fabricated');
  }
  return rows;
}
