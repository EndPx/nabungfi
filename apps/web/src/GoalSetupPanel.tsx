import type { GoalDTO } from "@nabungfi/shared/application";
import { Button, NetworkMark } from "./ui";
import { networks } from "./live-config";
import { LoadingState } from "./LoadingState";
import { goalSetupStage } from "./goal-setup";

export function GoalSetupPanel({ goal, name, paused, blocked, resume, pause, refresh }: {
  goal?: GoalDTO; name: string; paused: boolean; blocked: boolean;
  resume: () => void; pause: () => void; refresh: () => void;
}) {
  const stage = goal ? goalSetupStage(goal) : { kind: "verify" as const };
  const selected = goal ? ["solana" as const, ...goal.binding.participants.map(participant => participant.network)] : [];
  return <section className="live-panel live-form" aria-label="Goal vault setup">
    <h1>{paused ? "Goal setup paused" : "Getting your goal ready"}</h1>
    <p>{name}</p>
    {!paused && <LoadingState message={stage.kind === "link" ? "Connecting your vaults…" : stage.kind === "verify" ? "Checking vault setup…" : "Preparing your selected vaults…"}
      description={stage.kind === "link" ? "Vault creation is confirmed. Waiting for the cross-chain registration messages." : "Confirm each setup transaction in your wallet. We’ll continue through your selected chains."} />}
    {paused && <p>Your confirmed vaults are saved. Resolve any pending wallet request, then continue the remaining setup.</p>}
    {selected.map(network => {
      const participant = goal?.binding.participants.find(participant => participant.network === network);
      const initialized = network === "solana" ? goal?.binding.initialized : Boolean(participant?.vault && participant.configHash && participant.creationHash);
      const linked = initialized && goal?.chainStatus === "available" && goal.chainState?.positions.some(position => position.network === network && position.initialized && position.registered && position.linked);
      return <div className="live-amounts" key={network}>
        <span><NetworkMark network={network} /> {networks[network]}</span>
        <strong>{linked ? "Ready" : initialized ? "Connecting" : stage.kind === "wallet" && stage.network === network ? "Wallet confirmation" : "Waiting"}</strong>
      </div>;
    })}
    <p className="live-help">Each selected chain needs its gas token. Your wallet shows the fee before you confirm.</p>
    {paused ? <Button variant="build" disabled={blocked || !goal} onClick={resume}>Continue setup</Button>
      : <Button variant="secondary" onClick={pause}>Pause setup</Button>}
    <Button variant="quiet" disabled={blocked} onClick={refresh}>Refresh setup</Button>
  </section>;
}
