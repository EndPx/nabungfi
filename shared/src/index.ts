/** Exact-unit reference model for the local demo. It is not crosschain proof verification. */
export const UNIT = 1_000_000n;
export const CHAINS = ["solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];
export type Status = "saving" | "preparing" | "ready" | "achieved" | "closed";

export class DomainError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export function parseUSDC(value: unknown, signed = false): bigint {
  if (typeof value !== "string" || value.length > 32 ||
      !(signed ? /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/ : /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/).test(value)) {
    throw new DomainError("INVALID_AMOUNT", "Enter a USDC amount with at most six decimal places.");
  }
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace(/^-/, "").split(".");
  const amount = BigInt(whole) * UNIT + BigInt(fraction.padEnd(6, "0"));
  if (amount > 1_000_000_000n * UNIT) throw new DomainError("AMOUNT_LIMIT", "The demo supports amounts up to 1 billion USDC.");
  return negative ? -amount : amount;
}

export function formatUSDC(amount: bigint): string {
  const negative = amount < 0n;
  const n = negative ? -amount : amount;
  return `${negative ? "-" : ""}${n / UNIT}.${String(n % UNIT).padStart(6, "0")}`;
}

export interface Position {
  principal: bigint;
  assets: bigint;
  liquid: bigint;
  reserved: bigint;
  available: bigint;
  claimed: bigint;
}
export interface Entry {
  id: string;
  type: string;
  chain: Chain | null;
  amount: string;
  timestamp: string;
  status: "confirmed" | "pending";
  description: string;
}
export interface Model {
  version: 1;
  goal: { id: string; name: string; target: bigint; status: Status; achieved: boolean; round: number; abortedRounds: number[]; positions: Record<Chain, Position> };
  transactions: Entry[];
  requests: { id: string; fingerprint: string }[];
}
export type Action =
  | { type: "deposit"; chain: Chain; amount: string }
  | { type: "prepare" | "finalize" | "refresh" | "abort" }
  | { type: "claim"; chain: Chain }
  | { type: "create-goal"; name: string; target: string }
  | { type: "demo-yield" | "demo-liquidity"; chain: Chain; amount: string }
  | { type: "demo-reset" };

const emptyPosition = (): Position => ({ principal: 0n, assets: 0n, liquid: 0n, reserved: 0n, available: 1_000_000n * UNIT, claimed: 0n });
export const total = (m: Model, field: keyof Position): bigint => CHAINS.reduce((sum, c) => sum + m.goal.positions[c][field], 0n);
function requireThat(condition: boolean, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
export function emptyModel(name = "My first car", target = 10_000n * UNIT, id = "first-car"): Model {
  requireThat(target > 0n, "INVALID_TARGET", "Your target must be greater than zero.");
  return { version: 1, goal: { id, name, target, status: "saving", achieved: false, round: 0, abortedRounds: [], positions: { solana: emptyPosition(), base: emptyPosition() } }, transactions: [], requests: [] };
}

export function sampleModel(now = new Date().toISOString()): Model {
  const m = emptyModel();
  m.goal.positions.solana = { ...emptyPosition(), principal: 2_000n * UNIT, assets: 2_048n * UNIT };
  m.goal.positions.base = { ...emptyPosition(), principal: 1_600n * UNIT, assets: 1_632n * UNIT };
  m.transactions = [
    { id: "sample-yield-base", type: "demo-yield", chain: "base", amount: "32.000000", timestamp: now, status: "confirmed", description: "Sample earnings · simulated" },
    { id: "sample-yield-solana", type: "demo-yield", chain: "solana", amount: "48.000000", timestamp: now, status: "confirmed", description: "Sample earnings · simulated" },
    { id: "sample-base", type: "deposit", chain: "base", amount: "1600.000000", timestamp: now, status: "confirmed", description: "Sample Base contribution · simulated" },
    { id: "sample-solana", type: "deposit", chain: "solana", amount: "2000.000000", timestamp: now, status: "confirmed", description: "Sample Solana contribution · simulated" }
  ];
  return m;
}

function reserveAvailable(m: Model): "ready" | "preparing" {
  for (const chain of CHAINS) {
    const p = m.goal.positions[chain];
    const required = p.assets - p.liquid;
    const redeem = required < p.available ? required : p.available;
    p.liquid += redeem;
    p.available -= redeem;
    if (p.liquid === p.assets) p.reserved = p.assets;
  }
  const status = CHAINS.every(c => m.goal.positions[c].liquid === m.goal.positions[c].assets) ? "ready" : "preparing";
  m.goal.status = status;
  return status;
}

export function assertInvariants(m: Model): void {
  requireThat(m.version === 1 && typeof m.goal.target === "bigint" && m.goal.target > 0n, "INVALID_STATE", "Invalid goal state.");
  requireThat(["saving", "preparing", "ready", "achieved", "closed"].includes(m.goal.status), "INVALID_STATE", "Unknown goal phase.");
  requireThat(typeof m.goal.id === "string" && typeof m.goal.name === "string" && m.goal.name.length >= 2 && m.goal.name.length <= 80, "INVALID_STATE", "Invalid goal identity.");
  requireThat(Array.isArray(m.requests) && Array.isArray(m.transactions) && Array.isArray(m.goal.abortedRounds), "INVALID_STATE", "Invalid persisted history.");
  requireThat(Number.isSafeInteger(m.goal.round) && m.goal.round >= 0, "INVALID_STATE", "Invalid completion round.");
  for (const chain of CHAINS) {
    const p = m.goal.positions[chain];
    for (const n of Object.values(p)) requireThat(typeof n === "bigint" && n >= 0n, "INVALID_STATE", "Negative or invalid position amount.");
    requireThat(p.reserved <= p.liquid && p.liquid <= p.assets, "INVALID_STATE", "Invalid reserved balance.");
    if (m.goal.status === "saving") requireThat(p.reserved === 0n, "INVALID_STATE", "Saving state cannot have completion reserves.");
    if (["ready", "achieved", "closed"].includes(m.goal.status)) requireThat(p.reserved === p.assets && p.liquid === p.assets, "INVALID_STATE", "Release state requires reserved assets.");
    if (!m.goal.achieved) requireThat(p.claimed === 0n, "INVALID_STATE", "Unachieved goal cannot contain claims.");
  }
  requireThat(m.goal.achieved === ["achieved", "closed"].includes(m.goal.status), "INVALID_STATE", "Achievement status mismatch.");
  if (m.goal.status === "closed") requireThat(total(m, "assets") === 0n, "INVALID_STATE", "Closed goal has funds.");
  if (m.goal.achieved) requireThat(total(m, "assets") + total(m, "claimed") >= m.goal.target, "INVALID_STATE", "Achievement value is below target.");
}

/** Changes are atomic: an error leaves the input untouched. A request key cannot be reused for a different action. */
export function transition(input: Model, action: Action, requestId: string, now = new Date().toISOString(), expectedGoalId = input.goal.id): Model {
  assertInvariants(input);
  requireThat(/^[a-zA-Z0-9-]{8,120}$/.test(requestId), "INVALID_REQUEST_ID", "A valid request ID is required.");
  const fingerprint = JSON.stringify({ goalId: expectedGoalId, action });
  const old = input.requests.find(r => r.id === requestId);
  if (old) {
    requireThat(old.fingerprint === fingerprint, "REQUEST_CONFLICT", "This request ID has already been used for a different action.");
    return input;
  }
  requireThat(expectedGoalId === input.goal.id, "GOAL_CHANGED", "This goal changed in another session. Refresh before submitting a new action.");
  let m = structuredClone(input);
  const g = m.goal;
  let amount = 0n;
  let description = "";
  const chain = "chain" in action ? action.chain : null;
  if (chain !== null) requireThat(CHAINS.includes(chain), "INVALID_CHAIN", "Choose Solana or Base.");
  switch (action.type) {
    case "deposit": {
      requireThat(!g.achieved, "GOAL_COMPLETE", "This goal is complete. Finish claiming it before starting another.");
      requireThat(g.status !== "ready", "RESERVE_FROZEN", "Funds are already reserved. Resume saving before adding another contribution.");
      amount = parseUSDC(action.amount);
      requireThat(amount > 0n, "INVALID_AMOUNT", "Your contribution must be greater than zero.");
      const p = g.positions[action.chain];
      p.principal += amount; p.assets += amount;
      if (g.status === "saving") p.available += amount;
      else { p.liquid += amount; if (p.reserved > 0n || p.liquid === p.assets) p.reserved = p.liquid === p.assets ? p.assets : p.reserved; reserveAvailable(m); }
      description = "Contribution confirmed in local demo";
      break;
    }
    case "prepare":
      requireThat(g.status === "saving", "WRONG_PHASE", "This goal is already preparing or complete.");
      requireThat(total(m, "assets") >= g.target, "TARGET_NOT_REACHED", "Your savings have not reached the target yet.");
      g.round++; g.status = "preparing";
      description = reserveAvailable(m) === "ready" ? "Both local demo reserves are ready" : "Preparing reserves · waiting for demo strategy liquidity";
      break;
    case "refresh":
      requireThat(g.status === "preparing" || g.status === "ready", "WRONG_PHASE", "There is no preparation to refresh.");
      reserveAvailable(m); description = "Preparation refreshed in local demo"; break;
    case "finalize":
      requireThat(g.status === "ready", "NOT_READY", "Both chains must have their funds reserved before completion.");
      requireThat(!g.abortedRounds.includes(g.round), "ABORTED_ROUND", "This completion round was aborted.");
      requireThat(total(m, "reserved") >= g.target, "TARGET_NOT_REACHED", "Net reserved funds are below the target.");
      g.achieved = true; g.status = "achieved"; description = "Goal achieved · local coordination simulation"; break;
    case "claim": {
      requireThat(g.achieved, "GOAL_LOCKED", "Your principal and earnings stay locked until the target is verified as achieved.");
      const p = g.positions[action.chain]; amount = p.reserved;
      requireThat(amount > 0n, "ALREADY_CLAIMED", "This chain has no remaining funds to claim.");
      p.claimed += amount; p.assets = 0n; p.liquid = 0n; p.reserved = 0n;
      if (total(m, "assets") === 0n) g.status = "closed";
      description = "Local demo claim completed · no real transfer"; break;
    }
    case "abort":
      requireThat(g.status === "preparing" || g.status === "ready", "WRONG_PHASE", "Only an unfinished preparation can be resumed.");
      g.abortedRounds.push(g.round); g.status = "saving";
      for (const c of CHAINS) { const p = g.positions[c]; p.available += p.liquid; p.liquid = 0n; p.reserved = 0n; }
      description = "Completion round aborted · savings remain locked"; break;
    case "demo-yield": {
      requireThat(!g.achieved, "GOAL_COMPLETE", "Completed goals no longer earn in this demo.");
      amount = parseUSDC(action.amount, true);
      const p = g.positions[action.chain];
      requireThat(p.assets > p.liquid, "NO_INVESTED_BALANCE", "This chain has no invested demo balance.");
      requireThat(p.assets + amount >= p.liquid && p.reserved === 0n, "RESERVE_PROTECTED", "A demo change cannot reduce reserved funds.");
      p.assets += amount; description = amount >= 0n ? "Simulated net earnings added" : "Simulated strategy loss applied"; break;
    }
    case "demo-liquidity":
      amount = parseUSDC(action.amount); g.positions[action.chain].available = amount;
      description = "Demo strategy liquidity updated"; break;
    case "create-goal": {
      requireThat(total(m, "assets") === 0n && (g.status === "saving" || g.status === "closed"), "GOAL_FUNDED", "A funded goal's target cannot be changed.");
      const name = action.name.trim();
      requireThat(name.length >= 2 && name.length <= 80, "INVALID_NAME", "Use a goal name between 2 and 80 characters.");
      const target = parseUSDC(action.target);
      m = emptyModel(name, target, `goal-${requestId}`);
      m.requests = [...input.requests];
      description = "New local demo goal created"; break;
    }
    case "demo-reset":
      m = sampleModel(now); m.goal.id = `demo-${requestId}`; m.requests = [...input.requests]; description = "Local demo reset · sample funds only"; break;
  }
  m.requests.push({ id: requestId, fingerprint });
  // Preserve idempotency keys for the entire local session, including closed goals.
  m.transactions.unshift({ id: requestId, type: action.type, chain, amount: formatUSDC(amount), timestamp: now, status: m.goal.status === "preparing" && ["prepare", "refresh"].includes(action.type) ? "pending" : "confirmed", description });
  m.transactions = m.transactions.slice(0, 200);
  assertInvariants(m);
  return m;
}

export function publicState(m: Model) {
  const balance = total(m, "assets");
  const principal = total(m, "principal");
  const progress = Number((balance * 10_000n) / m.goal.target) / 100;
  return {
    mode: "local-demo" as const,
    goal: {
      id: m.goal.id, name: m.goal.name, target: formatUSDC(m.goal.target), status: m.goal.status,
      principal: formatUSDC(principal), earnings: formatUSDC(balance + total(m, "claimed") - principal),
      balance: formatUSDC(balance), progress: m.goal.achieved ? 100 : Math.min(100, progress),
      fundedPieces: m.goal.achieved ? 100 : Math.min(99, Number(balance * 100n / m.goal.target)),
      achieved: m.goal.achieved,
      chains: CHAINS.map(chain => {
        const p = m.goal.positions[chain];
        return { chain, label: chain === "solana" ? "Solana" : "Base", strategy: chain === "solana" ? "Kamino Supply" : "Aave V3 Supply", principal: formatUSDC(p.principal), earnings: formatUSDC(p.assets + p.claimed - p.principal), balance: formatUSDC(p.assets), liquid: formatUSDC(p.liquid), reserved: formatUSDC(p.reserved), claimed: formatUSDC(p.claimed), status: m.goal.achieved ? (p.assets === 0n ? "claimed" : "claimable") : m.goal.status === "saving" ? "earning" : p.liquid === p.assets ? "ready" : "preparing" };
      })
    },
    transactions: m.transactions,
    evidence: { solana: "Local ledger simulation; not a Solana transaction.", base: "Local ledger simulation; not a Base transaction.", messaging: "Local coordinator simulation; no LayerZero delivery." }
  };
}

export function serialize(m: Model): string { return JSON.stringify(m, (_, value) => typeof value === "bigint" ? value.toString() : value); }

// Consumers derive their API types from the same projection that the server returns.
export type AppState = ReturnType<typeof publicState>;
export type Goal = AppState["goal"];
export type GoalStatus = Status;
export type ChainPosition = Goal["chains"][number];
export type Transaction = AppState["transactions"][number];

export function deserialize(raw: string): Model {
  const m = JSON.parse(raw) as Model;
  m.goal.target = BigInt(m.goal.target);
  for (const chain of CHAINS) for (const key of ["principal", "assets", "liquid", "reserved", "available", "claimed"] as const) m.goal.positions[chain][key] = BigInt(m.goal.positions[chain][key]);
  assertInvariants(m);
  return m;
}
