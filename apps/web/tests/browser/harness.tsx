// Isolated component fixture, not imported by the application or built into dist.
// No API calls, Privy session, wallet SDK, signatures or chain transactions.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  GoalDTO,
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
} from "../../src/live-components";
import {
  ActivityPage,
  WalletsPage,
  SettingsPage,
} from "../../src/account-pages";
import { GoalsOverview } from "../../src/GoalsOverview";
import { FaucetsPage } from "../../src/FaucetsPage";
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
  assetsRaw: network === "solana" ? amount : "0",
  principalRaw: amount,
  claimedRaw: "0",
  claimableRaw: phase === "achieved" ? "5000000" : "0",
  walletUsdcRaw: "10000000",
  nativeBalanceRaw: "100000000",
  phase: phase === "achieved" ? "achieved" : "locked",
  initialized: true,
  registered: true,
  linked: true,
})) as GoalPositionState[];
const goal = {
  id: "fixture-car",
  goalId: fixtures.binding.goalId,
  name: "My next car",
  model: "car",
  targetRaw,
  binding: { ...fixtures.binding, targetRaw, initialized: true },
  chainStatus: phase === "unavailable" || params.get("read") === "unavailable" ? "unavailable" : "available",
  chainState: {
    goalId: fixtures.binding.goalId,
    phase:
      phase === "achieved"
        ? "achieved"
        : phase === "preparing"
          ? "preparing"
          : "saving",
    observedAt: "2026-10-02T00:00:00Z",
    targetRaw,
    totalAssetsRaw: amount,
    achievedTotalRaw: phase === "achieved" ? targetRaw : "0",
    totalClaimedRaw: "0",
    linked: true,
    claimable: phase === "achieved",
    canPrepare: BigInt(amount) >= BigInt(targetRaw) && phase === "saving",
    positions,
  } as GoalChainState,
} as GoalDTO;

function Harness() {
  const [selectedGoal, setSelectedGoal] = useState(goal);
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
    new Date(Date.now() + 2000).toISOString(),
  );
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
        (detail ? (
          <GoalDetail
            goal={selectedGoal}
            history={[]}
            reducedMotion={params.get("motion") !== "on"}
            back={() => setDetail(false)}
            refresh={() => setAction("refresh")}
            busy={false}
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
            setAction(JSON.stringify(body));
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
          busy={false}
          offline={false}
          onClose={() => setModal(null)}
          confirm={() => setAction("confirm-wallet")}
          refreshPlan={() => setAction("refresh-original")}
        />
      )}
      <output aria-label="Fixture requested action">{action}</output>
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
