import type { AppNetwork } from "@nabungfi/shared/application";
import { ExternalLink } from "./icons";
import { networks, walletExplorer } from "./live-config";
import { NetworkMark } from "./ui";

export function WalletAddress({ address, chains }: { address: string; chains: readonly AppNetwork[] }) {
  return <div className="wallet-address-row">
    <p className="live-address">{address}</p>
    {chains.length === 1 ? <a className="wallet-explorer-trigger" href={walletExplorer(chains[0], address)}
      target="_blank" rel="noopener noreferrer" aria-label={`View wallet on ${networks[chains[0]]}`} title={`View wallet on ${networks[chains[0]]}`}>
      <ExternalLink size={18} />
    </a> : <details className="wallet-explorer-menu">
      <summary className="wallet-explorer-trigger" aria-label="Choose explorer for EVM wallet" title="Choose explorer"><ExternalLink size={18} /></summary>
      <div className="wallet-explorer-links">
        {chains.map(chain => <a key={chain} href={walletExplorer(chain, address)} target="_blank" rel="noopener noreferrer"
          aria-label={`View wallet on ${networks[chain]}`}><NetworkMark network={chain} /><span>{networks[chain]}</span><ExternalLink size={15} /></a>)}
      </div>
    </details>}
  </div>;
}
