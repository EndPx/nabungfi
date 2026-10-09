import type {SessionDTO,AppNetwork} from '@nabungfi/shared/application';
import type {GoalBinding} from '@nabungfi/shared/chain';

/** Presentation eligibility only. The authenticated server seals the actual plan payment mode. */
export function sponsoredGoalNetworks(binding:GoalBinding,wallets:SessionDTO['user']['wallets'],enabled:boolean):AppNetwork[] {
  if(!enabled)return [];
  const selected:AppNetwork[]=['solana',...binding.participants.map(participant=>participant.network)];
  return selected.filter(network=>wallets.some(wallet=>wallet.walletClientType==='privy'&&Boolean(wallet.walletId)&&wallet.chainType===(network==='solana'?'solana':'ethereum')&&
    (network==='solana'?wallet.address===binding.owner.solana:wallet.address.toLowerCase()===binding.owner.evm.toLowerCase())));
}
