import {useState} from "react";
import type {AppNetwork} from "@nabungfi/shared/application";
import {EVM_DEPLOYMENTS} from "@nabungfi/shared/chain";
import {Check,Copy,ExternalLink} from "./icons";
import {IconButton} from "./ui";
import {networks,short} from "./live-config";

export function TransactionReference({hash,network}:{hash:string;network:AppNetwork}) {
  const [copied,setCopied]=useState(false);
  const [copyFailed,setCopyFailed]=useState(false);
  const explorer=network==="solana"?`https://explorer.solana.com/tx/${encodeURIComponent(hash)}?cluster=devnet`
    :EVM_DEPLOYMENTS[network]?.explorer?`${EVM_DEPLOYMENTS[network].explorer}/tx/${encodeURIComponent(hash)}`:null;
  const copy=async()=>{
    try {await navigator.clipboard.writeText(hash);setCopied(true);setCopyFailed(false);}
    catch {setCopyFailed(true);}
  };
  return <div className="transaction-reference">
    <div className="vault-address-row">
      {explorer && <a className="vault-address-link" href={explorer} title={hash} target="_blank" rel="noopener noreferrer"
        aria-label={`View original transaction on ${networks[network]}`}><span>{short(hash)}</span><ExternalLink size={14}/></a>}
      <IconButton className="icon-button vault-copy-button" label="Copy transaction hash" onClick={()=>void copy()}>
        {copied?<Check size={15}/>:<Copy size={15}/>}</IconButton>
      <span className="sr-only" role="status">{copied?"Full transaction hash copied":""}</span>
    </div>
    <details className="live-help" open={copyFailed||undefined}><summary>Full transaction hash</summary><code className="address">{hash}</code></details>
    {copyFailed && <p className="live-error" role="alert">Copy did not finish. Select the full hash above or open the explorer.</p>}
  </div>;
}
