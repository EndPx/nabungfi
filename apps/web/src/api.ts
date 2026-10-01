import type { AppState, Chain, Goal } from "@nabungfi/shared";
export type {
  AppState,
  Chain,
  ChainPosition,
  Goal,
  GoalStatus,
  Transaction,
} from "@nabungfi/shared";

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly rejected = false,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export interface PendingAction {
  action: string;
  fields: Record<string, unknown>;
  requestId: string;
  goalId: string | null;
  signature: string;
}

const PENDING_KEY = "nabungfi:unresolved-action:v1";
function parsePendingAction(raw: string | null): PendingAction | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const parsed = value as Partial<PendingAction>;
    if (
      typeof parsed.action !== "string" ||
      typeof parsed.requestId !== "string" ||
      typeof parsed.signature !== "string" ||
      !(parsed.goalId === null || typeof parsed.goalId === "string") ||
      !parsed.fields ||
      typeof parsed.fields !== "object" ||
      Array.isArray(parsed.fields)
    )
      return null;
    return parsed as PendingAction;
  } catch {
    return null;
  }
}
export function readPendingAction(): PendingAction | null {
  try {
    // Every request owns its record, so a second tab cannot overwrite recovery.
    const keys = Object.keys(localStorage)
      .filter((key) => key === PENDING_KEY || key.startsWith(`${PENDING_KEY}:`))
      .sort();
    for (const key of keys) {
      const parsed = parsePendingAction(localStorage.getItem(key));
      if (parsed) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistPendingAction(action: PendingAction) {
  // Do not send a financial action if its recovery identity cannot be persisted.
  localStorage.setItem(
    `${PENDING_KEY}:${action.requestId}`,
    JSON.stringify(action),
  );
}

export function clearPendingAction(requestId: string) {
  localStorage.removeItem(`${PENDING_KEY}:${requestId}`);
  const legacy = parsePendingAction(localStorage.getItem(PENDING_KEY));
  if (legacy?.requestId === requestId) localStorage.removeItem(PENDING_KEY);
}

export async function requestState(
  path = "/api/state",
  body?: Record<string, unknown>,
): Promise<AppState> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new RequestError(
      body
        ? "The response was interrupted. This action may already have been recorded. Recover the same request before starting another action."
        : "The local savings service is not reachable. Start the API and try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new RequestError(
      "The service returned an unreadable response. Recover the same request to verify its outcome.",
    );
  }
  if (!response.ok)
    throw new RequestError(
      typeof data.error === "string"
        ? data.error
        : "This action could not be completed. Please refresh and try again.",
      response.status >= 400 && response.status < 500,
    );
  if (data.mode !== "local-demo")
    throw new Error("The savings service returned an unsupported environment.");
  return data as AppState;
}

export function progressLabel(goal: Goal): string {
  if (goal.achieved || goal.progress >= 100) return "100";
  if (goal.progress > 0 && goal.progress < 0.1) return "<0.1";
  return (Math.floor(goal.progress * 10) / 10).toFixed(1);
}

export function remainingLabel(goal: Goal): string {
  const value = remaining(goal.target, goal.balance);
  return money(value, {
    decimals: Number(value) > 0 && Number(value) < 0.01 ? 6 : 2,
  });
}

export function money(
  value: string,
  options: { decimals?: number; sign?: boolean } = {},
): string {
  // Presentation only: financial arithmetic and whole-piece thresholds belong to the API.
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options.decimals ?? 2,
    maximumFractionDigits: options.decimals ?? 2,
    signDisplay: options.sign ? "exceptZero" : "auto",
  }).format(Number(value));
}

export function remaining(target: string, balance: string): string {
  const units = (s: string) => {
    const [whole, fraction = ""] = s.split(".");
    return (
      BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0").slice(0, 6))
    );
  };
  const delta = units(target) - units(balance);
  if (delta <= 0n) return "0";
  return `${delta / 1000000n}.${(delta % 1000000n).toString().padStart(6, "0")}`;
}

export function validAmount(value: string, signed = false): boolean {
  const pattern = signed ? /^-?\d+(?:\.\d{1,6})?$/ : /^\d+(?:\.\d{1,6})?$/;
  return pattern.test(value) && (signed || Number(value) > 0);
}

export const chainNames: Record<Chain, string> = {
  solana: "Solana",
  base: "Base",
};
