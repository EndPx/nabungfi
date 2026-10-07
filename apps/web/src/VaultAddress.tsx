import {useState} from "react";
import type {AppNetwork} from "@nabungfi/shared/application";
import {Check,Copy,ExternalLink} from "./icons";
import {IconButton} from "./ui";
import {networks,short,walletExplorer} from "./live-config";

export function VaultAddress({address,network}:{address?:string;network:AppNetwork}) {
  const [copied,setCopied]=useState("");
  const [error,setError]=useState("");
  if(!address) return <div className="vault-address-row"><span className="live-help">Vault not created</span></div>;
  const copy=async()=>{
    setError("");
    try {await navigator.clipboard.writeText(address);setCopied(address);}
    catch {setError(address);}
  };
  return <div className="vault-address-row">
    <span className="vault-address-label">Vault</span>
    <a className="vault-address-link" href={walletExplorer(network,address)} target="_blank" rel="noopener noreferrer"
      title={address} aria-label={`View ${networks[network]} vault ${address}`}>
      <span>{short(address)}</span><ExternalLink size={14}/>
    </a>
    <IconButton className="icon-button vault-copy-button" label={`Copy ${networks[network]} vault address`} onClick={()=>void copy()}>
      {copied===address ? <Check size={15}/> : <Copy size={15}/>}
    </IconButton>
    <span className="sr-only" role="status">{copied===address ? `${networks[network]} vault address copied` : ""}</span>
    {error===address && <p className="live-error" role="alert">Copy did not finish. Open the explorer to view the full address.</p>}
  </div>;
}
