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
  GoalCard,
  GoalDetail,
  CreateGoalModal,
  DepositModal,
  WalletStepModal,
} from "../../src/live-components";
import { Button } from "../../src/ui";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/work-sans/latin-400.css";
import "../../src/styles.css";
import "../../src/live.css";

const params = new URLSearchParams(location.search);
const phase = params.get("phase") ?? "saving";
const amount = params.get("amount") ?? "250000";
const targetRaw = "10000000";
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
  chainStatus: phase === "unavailable" ? "unavailable" : "available",
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
  const [destination, setDestination] = useState<Destination>("goals");
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
      pending={false}
      account={<span>QA fixture</span>}
    >
      <p role="status">
        Component acceptance fixture. All balances are examples; no API or
        wallet is connected.
      </p>
      {destination === "goals" &&
        (detail ? (
          <GoalDetail
            goal={goal}
            history={[]}
            reducedMotion={params.get("motion") !== "on"}
            back={() => setDetail(false)}
            refresh={() => setAction("refresh")}
            busy={false}
            deposit={() => setModal("deposit")}
            step={recordStep}
          />
        ) : (
          <>
            <div className="page-heading">
              <h1>Your next big things.</h1>
              <Button onClick={() => setModal("create")}>New goal</Button>
            </div>
            <div className="goal-grid">
              {(["car", "laptop", "house"] as const).map((model) => (
                <GoalCard
                  key={model}
                  goal={{ ...goal, id: model, name: `My ${model}`, model }}
                  onOpen={() => setDetail(true)}
                />
              ))}
            </div>
          </>
        ))}
      {destination !== "goals" && <h1>{destination}</h1>}
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
          goal={goal}
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
