import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletBalanceDTO, VerifiedWallet } from '@nabungfi/shared/application';
import { validateWalletBalances, walletGasLabel } from '../src/wallet-balances';
import { formatNativeGas, formatExactUsdc } from '../src/savings-progress';
const wallet:VerifiedWallet={chainType:'ethereum',address:'0x'+'1'.repeat(40)};
const rows:WalletBalanceDTO[]=(['base','arbitrum','ethereum'] as const).map(network=>({network,address:wallet.address,status:'available',usdcRaw:'2000001',nativeRaw:'1',observedAt:'2026-10-09T09:00:00Z'}));
test('wallet token formatting preserves USDC precision and tiny nonzero gas balances',()=>{
  assert.equal(formatExactUsdc('2000001'),'2.000001');
  assert.equal(formatNativeGas('1','base'),'0.000000000000000001 ETH');
  assert.equal(formatNativeGas('180951200','solana'),'0.1809512 SOL');
  assert.deepEqual(walletGasLabel('1','base'),{display:'<0.00000001 ETH',exact:'0.000000000000000001 ETH'});
  assert.equal(walletGasLabel('19956134597809116','base').display,'≈0.01995613 ETH');
});
test('wallet balance DTOs reject cross-wallet, duplicate, missing and fabricated unavailable rows',()=>{
  assert.deepEqual(validateWalletBalances(rows,[wallet]),rows);
  for(const invalid of [rows.slice(1),[rows[0],rows[0],rows[2]],rows.map(row=>({...row,address:'other'})),rows.map(row=>({...row,usdcRaw:'1.1'})),rows.map(row=>({...row,status:'unavailable' as const}))])assert.throws(()=>validateWalletBalances(invalid,[wallet]));
  assert.equal(validateWalletBalances(rows.map(row=>({...row,status:'unavailable',usdcRaw:null,nativeRaw:null})),[wallet]).length,3);
});
