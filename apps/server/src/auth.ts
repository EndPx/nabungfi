import { PrivyClient } from '@privy-io/node';
import { PublicKey } from '@solana/web3.js';
import type { VerifiedWallet } from '@nabungfi/shared/application';
import { ApiError } from './errors.js';

export interface VerifiedIdentity { subject: string; wallets: VerifiedWallet[] }
export interface Authentication { authenticate(authorization: string | undefined): Promise<VerifiedIdentity> }
interface PrivyUserShape { id: string; linked_accounts: unknown[] }
export function authoritativeWallets(user: PrivyUserShape): VerifiedWallet[] {
  const wallets: VerifiedWallet[]=[];
  for(const item of user.linked_accounts){if(!item||typeof item!=='object')continue;const w=item as Record<string,unknown>;
    if(w.type!=='wallet'||typeof w.address!=='string'||!['ethereum','solana'].includes(String(w.chain_type)))continue;
    let address=w.address;
    if(w.chain_type==='ethereum'){if(!/^0x[0-9a-f]{40}$/i.test(address)||BigInt(address)===0n)continue;address=address.toLowerCase();}
    else {try{if(new PublicKey(address).toBase58()!==address)continue;}catch{continue;}}
    const wallet: VerifiedWallet={chainType:w.chain_type as 'ethereum'|'solana',address};if(typeof w.id==='string')wallet.walletId=w.id;
    if(!wallets.some(x=>x.chainType===wallet.chainType&&x.address===wallet.address))wallets.push(wallet);
  }
  return wallets;
}
export function privyAuthentication(appId: string,appSecret: string): Authentication {
  const client=new PrivyClient({appId,appSecret,timeout:15000,maxRetries:1});
  return {async authenticate(header){
    if(!header||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)||header.length>12000)throw new ApiError('UNAUTHENTICATED',401,'Sign in to continue.');
    try {
      const verified=await client.utils().auth().verifyAccessToken(header.slice(7));
      if(verified.app_id!==appId||verified.issuer!=='privy.io'||verified.expiration<=Date.now()/1000||verified.issued_at>Date.now()/1000+30||!/^did:privy:[a-zA-Z0-9_-]+$/.test(verified.user_id))throw new Error('Invalid identity');
      const user=await client.users()._get(verified.user_id);if(user.id!==verified.user_id)throw new Error('Wrong authoritative user');
      return {subject:verified.user_id,wallets:authoritativeWallets(user)};
    } catch { throw new ApiError('UNAUTHENTICATED',401,'Your session could not be verified. Sign in again.'); }
  }};
}
export function requireGoalWallets(identity: VerifiedIdentity,owners:{solana:string;evm:string}): void {
  if(!identity.wallets.some(w=>w.chainType==='solana'&&w.address===owners.solana)||!identity.wallets.some(w=>w.chainType==='ethereum'&&w.address.toLowerCase()===owners.evm.toLowerCase()))throw new ApiError('WALLET_OWNERSHIP_REQUIRED',403,'Connect both goal-owner wallets to this signed-in account.');
}
