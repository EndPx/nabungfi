// Isolated component fixture, not imported by the application or built into dist.
// No API calls, Privy session, wallet SDK, signatures or chain transactions.
import "../../src/wallet-compat";
import { useState } from "react";
import { LoadingState } from "../../src/LoadingState";
import { createRoot } from "react-dom/client";
import type {
  GoalDTO,
  GoalHistoryEntry,
  GoalStepAction,
  AppNetwork,
} from "@nabungfi/shared/application";
import type { GoalChainState, GoalPositionState } from "@nabungfi/shared/chain";
import fixtures from "../fixtures/unsigned-plans.json";
import { Shell, type Destination } from "../../src/Shell";
import {
  GoalDetail,
  CreateGoalModal,
  DepositModal,
  WalletStepModal,
  RecoveryPanel,
} from "../../src/live-components";
import {
  ActivityPage,
  WalletsPage,
  SettingsPage,
} from "../../src/account-pages";
import { GoalsOverview } from "../../src/GoalsOverview";
import { FaucetsPage } from "../../src/FaucetsPage";
import { ChainAllocation } from "../../src/ChainAllocation";
import { registerPwa } from "../../src/pwa";
import { formatUsdc } from "../../src/live-api";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import "../../src/styles.css";
import "../../src/live.css";
import "../../src/app-refinement.css";

const params = new URLSearchParams(location.search);
registerPwa();
const phase = params.get("phase") ?? "saving";
const amount = params.get("amount") ?? "250000";
const targetRaw = params.get("target") ?? "10000000";
const positions = ["solana", "base"].map((network) => ({
  network,
  assetsRaw: phase === "claimed" ? "0" : network === "solana" ? amount : "0",
  principalRaw: amount,
  claimedRaw: phase === "claimed" ? "5000000" : "0",
  claimableRaw: phase === "achieved" ? "5000000" : "0",
  walletUsdcRaw: "10000000",
  nativeBalanceRaw: "100000000",
  phase: phase === "achieved" || phase === "claimed" ? "achieved" : "locked",
  initialized: true,
  registered: true,
  linked: true,
})) as GoalPositionState[];
const goal = {
  id: "fixture-car",
  goalId: fixtures.binding.goalId,
  name: "My next car",
  model: params.get("model") === "laptop" ? "laptop" : params.get("model") === "house" ? "house" : "car",
  targetRaw,
  binding: { ...fixtures.binding, targetRaw, initialized: !["missing","ready"].includes(params.get("vaults") ?? ""),
    participants: fixtures.binding.participants.map(participant => params.get("vaults") === "missing" ? {...participant,vault:undefined} : params.get("configuration") === "missing" ? {...participant,configHash:undefined} : participant) },
  chainStatus: phase === "unavailable" || params.get("read") === "unavailable" ? "unavailable" : "available",
  chainState: {
    goalId: fixtures.binding.goalId,
    phase:
      phase === "claimed"
        ? "claimed"
        : phase === "achieved"
        ? "achieved"
        : phase === "preparing"
          ? "preparing"
          : "saving",
    observedAt: "2026-10-02T00:00:00Z",
    targetRaw,
    totalAssetsRaw: phase === "claimed" ? "0" : amount,
    achievedTotalRaw: phase === "achieved" || phase === "claimed" ? targetRaw : "0",
    totalClaimedRaw: phase === "claimed" ? "10000000" : "0",
    linked: true,
    claimable: phase === "achieved",
    canPrepare: BigInt(amount) >= BigInt(targetRaw) && phase === "saving",
    positions,
  } as GoalChainState,
} as GoalDTO;

const history: GoalHistoryEntry[] = params.get("history") === "1" ? [
  {id:"example-claim",goalId:goal.id,action:"claim",network:"solana",amountRaw:"250000",status:"confirmed",transactionHash:null,
    createdAt:"2026-10-06T23:15:00.000Z",updatedAt:"2026-10-07T02:30:00.000Z"},
  {id:"example-deposit",goalId:goal.id,action:"deposit",network:"base",amountRaw:"10000",status:"confirmed",transactionHash:null,
    createdAt:"2026-10-06T16:30:00.000Z",updatedAt:"2026-10-06T16:31:00.000Z"},
] : [];

const allocationExample = [
  {network:"solana" as const,amount:"25000000"},
  {network:"base" as const,amount:"62000000"},
  {network:"arbitrum" as const,amount:"8000000"},
  {network:"ethereum" as const,amount:"5000000"},
].map(share=>({network:share.network,assetsRaw:params.get("collected") === "1" ? "0" : share.amount,claimedRaw:params.get("collected") === "1" ? share.amount : "0"}));

function Harness() {
  const [selectedGoal, setSelectedGoal] = useState<GoalDTO>(params.has("waiting-read") ? {...goal,chainStatus:"unavailable",chainState:null} : goal);
  const [pendingRead,setPendingRead]=useState(params.has("waiting-read"));
  const [createCount,setCreateCount]=useState(0);
  const exampleGoals: GoalDTO[] = params.get("empty") === "1" ? [] : (["car", "laptop", "house"] as const).map(model => ({ ...goal, id: model, name: `My ${model}`, model,
    chainState: model === "house" && params.get("mixed") === "1" ? { ...goal.chainState!, phase: "achieved", achievedTotalRaw: targetRaw } : goal.chainState }));
  const [destination, setDestination] = useState<Destination>(
    (params.get("page") as Destination) || "goals",
  );
  const [reducedMotion, setReducedMotion] = useState(true);
  const [detail, setDetail] = useState(params.get("view") === "detail");
  const [modal, setModal] = useState<"create" | "deposit" | "wallet" | null>(
    params.get("view") === "wallet" ? "wallet" : null,
  );
  const [walletExpiry] = useState(() =>
    new Date(Date.now() + (params.get("wallet-handoff") === "1" ? 60000 : 2000)).toISOString(),
  );
  const [walletBusy, setWalletBusy] = useState(false);
  const [action, setAction] = useState("");
  const recordStep = (
    action: GoalStepAction,
    network: AppNetwork,
    amount?: string,
  ) => setAction(`${action}:${network}:${amount ?? ""}`);
  return (
    <Shell
      destination={destination}
      onNavigate={setDestination}
      pending={params.get("pending") === "1"}
      account={<span>{params.get("presentation") === "1" ? "Example account" : "QA fixture"}</span>}
    >
      <p role="status" className="fixture-note">
        {params.get("presentation") === "1" ? "Example savings goals · For illustration" : "Component acceptance fixture. All balances are examples; no API or wallet is connected."}
      </p>
      {destination === "goals" &&
        (params.get("view") === "allocation" ? <section className="live-panel goal-chain-panel"><h2>Where your pieces are</h2><ChainAllocation positions={allocationExample} /></section> : detail && pendingRead && params.has("creating-read") ? (
          <LoadingState message="Creating your goal…" description={`Getting ${selectedGoal.name} ready for you.`} />
        ) : detail ? (
          <GoalDetail
            goal={selectedGoal}
            history={history}
            reducedMotion={params.get("motion") !== "on"}
            back={() => setDetail(false)}
            refresh={() => setAction("refresh")}
            busy={pendingRead}
            refreshing={pendingRead}
            deposit={() => setModal("deposit")}
            step={recordStep}
          />
        ) : (
            <GoalsOverview
              goals={exampleGoals}
              balance={`$${formatUsdc((BigInt(amount) * 3n).toString())}`}
              scope="Across 3 example goals"
              blocked={false}
              create={() => setModal("create")}
              open={id => { setSelectedGoal(exampleGoals.find(item => item.id === id)!); setDetail(true); }}
              activity={() => setDestination("activity")}
              wallets={() => setDestination("wallets")}
            />
        ))}
      {destination === "activity" && (
        <ActivityPage
          goals={[goal]}
          loading={false}
          offline={false}
          refresh={() => setAction("refresh")}
          openGoal={() => {
            setDestination("goals");
            setDetail(true);
          }}
        />
      )}
      {destination === "wallets" && (
        <WalletsPage
          wallets={[
            { chainType: "solana", address: goal.binding.owner.solana },
            { chainType: "ethereum", address: goal.binding.owner.evm },
          ]}
          busy={false}
          blocked={false}
          createWallet={() => setAction("create-wallet")}
          connect={() => setAction("connect")}
          link={() => setAction("link")}
        />
      )}
      {destination === "settings" && (
        <SettingsPage
          reducedMotion={reducedMotion}
          setReducedMotion={setReducedMotion}
        />
      )}
      {destination === "faucets" && <FaucetsPage wallets={params.get("missing-wallets") === "1" ? [] : [{chainType:"solana",address:goal.binding.owner.solana},{chainType:"ethereum",address:goal.binding.owner.evm}]} openWallets={() => setDestination("wallets")} />}
      {modal === "create" && (
        <CreateGoalModal
          wallets={[
            { chainType: "solana", address: goal.binding.owner.solana },
            { chainType: "ethereum", address: goal.binding.owner.evm },
          ]}
          busy={false}
          onClose={() => setModal(null)}
          create={async (body) => {
            setCreateCount(value=>value+1);
            setAction(JSON.stringify(body));
            if(params.has("slow-create")){
              await new Promise(resolve=>setTimeout(resolve,1800));
              setSelectedGoal({...goal,id:"fixture-created",name:body.name,chainStatus:"unavailable",chainState:null,
                binding:{...goal.binding,initialized:false,participants:goal.binding.participants.map(participant=>({...participant,vault:undefined}))}});
              setPendingRead(true);
              setDetail(true);
            }
            setModal(null);
          }}
        />
      )}
      {modal === "deposit" && (
        <DepositModal
          goal={selectedGoal}
          onClose={() => setModal(null)}
          plan={(network, amount, approve) => {
            recordStep(approve ? "approve" : "deposit", network, amount);
            setModal(null);
          }}
        />
      )}
      {modal === "wallet" && (
        <WalletStepModal
          step={
            {
              id: "fixture-step",
              metadataGoalId: goal.id,
              goalId: goal.goalId,
              action: "deposit",
              network: "base",
              amountRaw: "1000000",
              status: "planned",
              transactionHash: null,
              createdAt: walletExpiry,
              updatedAt: walletExpiry,
              plan: {
                ...fixtures.plans["deposit-base"],
                expiresAt: walletExpiry,
              },
            } as import("@nabungfi/shared/application").GoalStepDTO
          }
          recovery={{
            userId: "fixture-user",
            goalId: goal.id,
            stepId: "fixture-step",
            requestId: "fixture-request",
            action: "deposit",
            network: "base",
            amountRaw: "1000000",
            state: "planned",
            createdAt: walletExpiry,
          }}
          busy={walletBusy}
          offline={false}
          onClose={() => setModal(null)}
          confirm={() => {
            setAction("confirm-wallet");
            if (params.get("wallet-handoff") === "1") setWalletBusy(true);
          }}
          refreshPlan={() => setAction("refresh-original")}
        />
      )}
      {walletBusy && <div role="dialog" aria-label="Example wallet confirmation"><p>Synthetic wallet portal. No transaction is signed.</p><button onClick={() => setAction("wallet-portal-approved")}>Example wallet approve</button></div>}
      {params.get("view") === "recovery" && <RecoveryPanel
        recoveries={[{userId:"fixture-user",goalId:goal.id,stepId:"unsent",requestId:"fixture-request",action:"create-vault",network:params.get("expired-solana")==="1"?"solana":"ethereum",state:"awaiting-wallet",createdAt:walletExpiry},
          {userId:"fixture-user",goalId:goal.id,stepId:"submitted",requestId:"submitted-request",action:"deposit",network:"base",state:"submitted",transactionHash:"0x"+"3".repeat(64),createdAt:walletExpiry}]}
        requests={[]} busy={false} offline={false} reconcile={async()=>setAction("reconcile-original")}
        retry={async()=>{}} resume={async()=>setAction("inspect-original")} closeUnsent={async()=>setAction("attest-wallet-not-invoked")} resolveExpired={async()=>setAction("resolve-expired-original")} />}
      <output aria-label="Fixture requested action">{action}</output>
      <output data-testid="example-create-count">{createCount}</output>
      {pendingRead && <div className="fixture-controls">
        <button onClick={()=>{setPendingRead(false);setSelectedGoal(prior=>({...prior,chainStatus:"unprovisioned",binding:{...prior.binding,initialized:false},
          chainState:{...goal.chainState!,phase:"saving",totalAssetsRaw:"0",totalClaimedRaw:"0",achievedTotalRaw:"0",canPrepare:false,claimable:false,positions:[]}}));}}>Complete example goal read</button>
        <button onClick={()=>setPendingRead(false)}>Fail example goal read</button>
      </div>}
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
