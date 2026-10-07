import { useEffect, useId, useState } from "react";
import type { GoalPositionState, ChainNetwork } from "@nabungfi/shared/chain";
import { networks } from "./live-config";
import { chainAllocation, formatChainShare, formatExactUsdc } from "./savings-progress";

const shortNames: Record<ChainNetwork, string> = {solana:"Solana",base:"Base",arbitrum:"Arbitrum",ethereum:"Ethereum"};

export function ChainAllocation({positions}: {positions: readonly Pick<GoalPositionState,"network"|"assetsRaw"|"claimedRaw">[]}) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState<ChainNetwork | null>(null);
  const [selected, setSelected] = useState<ChainNetwork | null>(null);
  const allocation = chainAllocation(positions);
  const active = allocation.shares.find(share => share.network === (hovered ?? selected));
  useEffect(() => {
    if (!active) return;
    const dismiss = (event: KeyboardEvent) => {if(event.key === "Escape") {setHovered(null);setSelected(null);}};
    window.addEventListener("keydown",dismiss);
    return () => window.removeEventListener("keydown",dismiss);
  }, [active?.network]);
  const interactions = (network: ChainNetwork) => ({
    onMouseEnter: () => setHovered(network), onMouseLeave: () => setHovered(null),
    onFocus: () => setSelected(network), onBlur: () => setSelected(null),
    onClick: () => setSelected(network),
    "aria-describedby": active?.network === network ? tooltipId : undefined,
  });
  return <div className="chain-allocation" onKeyDown={event => {if(event.key === "Escape") {setHovered(null);setSelected(null);}}}>
    <div className="chain-allocation-heading"><h3>Savings allocation</h3><span>{formatExactUsdc(allocation.totalRaw)} USDC</span></div>
    {allocation.shares.some(share => BigInt(share.claimedRaw) > 0n) && <p className="chain-allocation-basis">Includes collected savings</p>}
    {allocation.totalRaw === "0" ? <p className="live-help">Your allocation appears after the first deposit.</p> : <>
      <div className="chain-allocation-chart">
        <div className="chain-allocation-track" role="group" aria-label="Savings allocation by chain">
          {allocation.shares.filter(share => share.basisPoints > 0).map(share => <button key={share.network} type="button" tabIndex={-1} data-network={share.network}
            className="chain-allocation-segment" style={{flexBasis:`${share.basisPoints / 100}%`}}
            aria-label={`${networks[share.network]}: ${formatChainShare(share.basisPoints, share.amountRaw)}, ${formatExactUsdc(share.amountRaw)} USDC`}
            {...interactions(share.network)} />)}
        </div>
        {active && <div id={tooltipId} role="tooltip" className="chain-allocation-tooltip" onMouseEnter={() => setHovered(active.network)} onMouseLeave={() => setHovered(null)}>
          <strong>{networks[active.network]}</strong>
          <span>{formatChainShare(active.basisPoints,active.amountRaw)} · {formatExactUsdc(active.amountRaw)} USDC</span>
          <small>Remaining {formatExactUsdc(active.assetsRaw)} · Collected {formatExactUsdc(active.claimedRaw)} USDC</small>
        </div>}
      </div>
      <div className="chain-allocation-legend">
        {allocation.shares.map(share => <button key={share.network} type="button" data-network={share.network}
          className={active?.network === share.network ? "is-active" : undefined}
          aria-label={`${networks[share.network]} allocation details`} {...interactions(share.network)}>
          <i aria-hidden="true" /><span>{shortNames[share.network]}</span><strong>{formatChainShare(share.basisPoints,share.amountRaw)}</strong>
        </button>)}
      </div>
    </>}
  </div>;
}
