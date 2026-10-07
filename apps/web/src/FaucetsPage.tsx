import { useState } from "react";
import type { SessionDTO } from "@nabungfi/shared/application";
import { Copy, ExternalLink, Wallet } from "./icons";
import { Button, NetworkMark, PageHeading } from "./ui";
import { FAUCETS, USDC_FAUCET } from "./faucets";
import { networks } from "./live-config";
import { WalletAddress } from "./WalletAddress";

export function FaucetsPage({ wallets, openWallets }: {
  wallets: SessionDTO["user"]["wallets"];
  openWallets: () => void;
}) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const copy = async (network: string, address: string) => {
    setError("");
    try { await navigator.clipboard.writeText(address); setCopied(network); }
    catch { setError("Copy could not finish. Select the wallet address to copy it manually."); }
  };
  return <>
    <PageHeading title="Faucets" description="Get USDC for your goals and native tokens for transaction fees.">
      <Button variant="secondary" onClick={openWallets}><Wallet size={19} />Your wallets</Button>
    </PageHeading>
    <div className="faucet-grid">
      {FAUCETS.map(faucet => {
        const address = wallets.find(wallet => wallet.chainType === faucet.walletFamily)?.address;
        return <section className="live-panel faucet-card" key={faucet.network} aria-labelledby={`faucet-${faucet.network}`}>
          <div className="faucet-heading"><NetworkMark network={faucet.network} /><div><h2 id={`faucet-${faucet.network}`}>{networks[faucet.network]}</h2><span className="live-help">USDC for saving · {faucet.gasSymbol} for fees</span></div></div>
          <div className="faucet-wallet"><span className="live-help">Destination wallet</span>{address ? <>
            <WalletAddress address={address} chains={[faucet.network]} /><Button variant="quiet" aria-label={`Copy ${networks[faucet.network]} wallet address`} onClick={() => void copy(faucet.network, address)}><Copy size={17} />{copied === faucet.network ? "Copied" : "Copy address"}</Button>
          </> : <><p className="live-help">Link or create a {faucet.walletFamily === "solana" ? "Solana" : "EVM"} wallet first.</p><Button variant="secondary" onClick={openWallets}>Open Wallets</Button></>}</div>
          <div className="faucet-actions"><a className="button button--build" href={USDC_FAUCET} target="_blank" rel="noopener noreferrer" aria-label={`Get USDC for ${networks[faucet.network]}`}>Get USDC <ExternalLink size={16} /></a><a className="button button--secondary" href={faucet.gasUrl} target="_blank" rel="noopener noreferrer" aria-label={`Get ${faucet.gasSymbol} for ${networks[faucet.network]}`}>Get {faucet.gasSymbol} <ExternalLink size={16} /></a></div>
        </section>;
      })}
    </div>
    <p className="live-help faucet-note">The EVM address is shared across its networks, but each network needs its own ETH balance. Faucet providers set their own request limits.</p>
    <p className="sr-only" role="status">{copied ? `${networks[copied as keyof typeof networks]} wallet address copied` : ""}</p>
    {error && <p className="live-error" role="alert">{error}</p>}
  </>;
}
