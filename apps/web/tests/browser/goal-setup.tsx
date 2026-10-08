// Example vault/receipt callbacks only; no API, Privy, wallets or financial transactions.
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppNetwork, GoalDTO } from "@nabungfi/shared/application";
import { useGoalSetup } from "../../src/useGoalSetup";
import { GoalSetupPanel } from "../../src/GoalSetupPanel";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/work-sans/latin-400.css";
import "../../src/styles.css";
import "../../src/live.css";
import "../../src/app-refinement.css";

function original(): GoalDTO {
  return { id: "example-goal", goalId: "0x11", name: "Example laptop", targetRaw: "300000", chainStatus: "unprovisioned",
    binding: { initialized: false, participants: [{ network: "base" }, { network: "ethereum" }] },
    chainState: { goalId: "0x11", targetRaw: "300000", linked: false,
      positions: ["solana", "base", "ethereum"].map(network => ({ network, initialized: false, registered: false, linked: false })) },
  } as unknown as GoalDTO;
}
function Fixture() {
  const [goal, setGoal] = useState<GoalDTO>(() => JSON.parse(localStorage.getItem("fixture:setup-goal") ?? "null") ?? original());
  const [pending, setPending] = useState<{ network: AppNetwork; action: string } | null>(null);
  const [requests, setRequests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [offline, setOffline] = useState(false);
  const [planWaiting, setPlanWaiting] = useState(false);
  const releasePlan = useRef<() => void>(() => {});
  const isActive = useRef<() => boolean>(() => false);
  const reference = useRef(goal); reference.current = goal;
  const setup = useGoalSetup({ userId: "did:privy:example", goals: [goal], initialReadSettled: true,
    blocked: Boolean(pending) || unknown || offline || planWaiting,
    plan: async (_goal, action, network) => {
      setRequests(prior => [...prior, network]);
      if (new URLSearchParams(location.search).has("delayed-plan")) {
        setPlanWaiting(true); await new Promise<void>(resolve => { releasePlan.current = resolve; }); setPlanWaiting(false);
      }
      if (isActive.current()) setPending({ action, network });
      return true;
    },
    refresh: async () => {}, ready: () => setFinished(true), error: failure => setError(String(failure)),
  });
  isActive.current = () => setup.isActive(goal.id);
  const update = (next: GoalDTO) => { localStorage.setItem("fixture:setup-goal", JSON.stringify(next)); setGoal(next); };
  const confirm = () => {
    const next = structuredClone(reference.current);
    if (pending?.network === "solana") { next.binding.initialized = true; next.chainStatus = "available"; next.chainState!.positions[0]!.initialized = true; }
    else {
      const participant = next.binding.participants.find(participant => participant.network === pending?.network)!;
      Object.assign(participant, { vault: `example-${participant.network}`, configHash: "example-config", creationHash: "example-receipt" });
      next.chainState!.positions.find(position => position.network === participant.network)!.initialized = true;
    }
    update(next); setPending(null);
  };
  return <main className="live-shell" style={{ padding: 20 }}>
    {finished ? <h1>Example goal ready</h1> : setup.intent ? <GoalSetupPanel goal={goal} name={setup.intent.name}
      paused={setup.intent.paused} blocked={Boolean(pending) || unknown || offline}
      resume={() => setup.start(goal)} pause={setup.pause} refresh={() => {}} />
      : <button onClick={() => setup.start(goal)}>Create example selected-chain goal</button>}
    {error && <p role="alert">{error}</p>}
    <aside aria-label="Example fixture controls">
      <p data-testid="setup-requests">{requests.join(",")}</p>
      {planWaiting && <button onClick={() => releasePlan.current()}>Return example original plan</button>}
      {pending && <><button onClick={confirm}>Confirm example {pending.network} transaction</button>
        <button onClick={() => { setup.pause(); setPending(null); }}>Reject example transaction</button>
        <button onClick={() => { setup.pause(); setPending(null); setUnknown(true); }}>Lose example receipt response</button></>}
      <button onClick={() => setOffline(value => !value)}>Toggle example connectivity</button>
      <button onClick={() => {
        const next = structuredClone(reference.current); next.chainState!.linked = true;
        next.chainState!.positions.forEach(position => Object.assign(position, { registered: true, linked: true })); update(next);
      }}>Deliver example registration</button>
    </aside>
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>);
