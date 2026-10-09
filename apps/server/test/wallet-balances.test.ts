import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PublicKey } from '@solana/web3.js';
import type { VerifiedWallet } from '@nabungfi/shared/application';
import { EVM_DEPLOYMENTS, SOLANA_DEPLOYMENT } from '@nabungfi/shared/chain';
import { readWalletBalances } from '../src/chain/wallet-balances.js';
import type { RpcTransport } from '../src/chain/rpc.js';
import { TOKEN } from '../src/chain/codec.js';
import { applicationServer, type ChainServices } from '../src/application-server.js';
import type { ApplicationRepository } from '../src/repository.js';
import { loadAppConfig } from '../src/config.js';
import { ApiError } from '../src/errors.js';
const wallets: VerifiedWallet[] = [
  { chainType: 'solana', address: 'AMoZFFdhUaNq8qyVRE4RrdW7rBc5Jssc6b7MyERMB7s8' },
  { chainType: 'ethereum', address: '0xc82f469aa95a2f7792300c8d11230e9023a98600' },
];
function rpc({ fail = '', missing = false, wrongMint = false } = {}): RpcTransport {
  const data = Buffer.alloc(165);
  new PublicKey(wrongMint ? '11111111111111111111111111111111' : SOLANA_DEPLOYMENT.mint).toBuffer().copy(data);
  new PublicKey(wallets[0].address).toBuffer().copy(data,32);
  data.writeBigUInt64LE(2000001n,64);
  return {
    solana: {
      getGenesisHash: async () => SOLANA_DEPLOYMENT.genesis,
      getAccountInfo: async () => missing ? null : { owner: TOKEN, data },
      getBalance: async () => 180951200,
    },
    call: async (network: keyof typeof EVM_DEPLOYMENTS, method: string, params: unknown[]) => {
      if (network === fail) throw new Error('RPC unavailable');
      if (method === 'eth_chainId') return '0x'+EVM_DEPLOYMENTS[network].chainId.toString(16);
      if (method === 'eth_blockNumber') return '0x1234';
      assert.equal(params[1], '0x1234');
      if (method === 'eth_call') {
        assert.equal((params[0] as {to: string}).to, EVM_DEPLOYMENTS[network].asset);
        return '0x'+({base:5250000n,arbitrum:7500000n,ethereum:0n}[network]).toString(16).padStart(64,'0');
      }
      assert.equal(method,'eth_getBalance');
      assert.equal(params[0],wallets[1].address);
      return '0x'+9007199254740993n.toString(16);
    },
  } as unknown as RpcTransport;
}
test('wallet balances are independent per network without a goal and preserve atomic values',async()=>{
  const rows=await readWalletBalances(rpc(),wallets);
  assert.deepEqual(rows.map(row=>[row.network,row.usdcRaw,row.nativeRaw]),[
    ['solana','2000001','180951200'],['base','5250000','9007199254740993'],['arbitrum','7500000','9007199254740993'],['ethereum','0','9007199254740993'],
  ]);
  assert.ok(rows.every(row=>row.status==='available'));
});
test('missing USDC accounts mean zero, invalid mint or failed networks mean unavailable independently',async()=>{
  const rows=await readWalletBalances(rpc({fail:'base',missing:true}),wallets);
  assert.equal(rows[0].usdcRaw,'0');
  assert.equal(rows[1].status,'unavailable');assert.equal(rows[1].usdcRaw,null);assert.equal(rows[1].nativeRaw,null);
  assert.equal(rows[2].usdcRaw,'7500000');
  assert.equal((await readWalletBalances(rpc({wrongMint:true}),[wallets[0]]))[0].status,'unavailable');
});
test('HTTP wallet balances require authentication and ignore caller-supplied wallet identities',async()=>{
  const config=loadAppConfig({PRIVY_APP_ID:'test-app',PRIVY_APP_SECRET:'test-secret',DATABASE_URL:'postgresql://test:test@ep-test.neon.tech/test?sslmode=require'});
  const repo={user:async()=>({id:'verified-user'})} as unknown as ApplicationRepository;
  let reads=0;
  const chain={readWalletBalances:async(selected:VerifiedWallet[])=>{reads++;assert.deepEqual(selected,wallets);return readWalletBalances(rpc(),selected);}} as unknown as ChainServices;
  const server=applicationServer(config,repo,{authenticate:async header=>{if(header!=='Bearer fixture')throw new ApiError('UNAUTHENTICATED',401,'Sign in.');return{subject:'did:privy:fixture',wallets};}},chain);
  server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
  try {
    const origin=`http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(origin+'/api/wallet-balances')).status,401);assert.equal(reads,0);
    const response=await fetch(origin+'/api/wallet-balances?address=attacker',{headers:{Authorization:'Bearer fixture'}});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const body=await response.json() as {balances:{address:string}[]};
    assert.equal(body.balances.length,4);assert.ok(body.balances.every(row=>wallets.some(wallet=>wallet.address===row.address)));
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
