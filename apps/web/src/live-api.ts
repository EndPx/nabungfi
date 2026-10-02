import type {
  GoalDTO,
  GoalStepDTO,
  SessionDTO,
} from "@nabungfi/shared/application";
import { EVM_DEPLOYMENTS, type ChainPlan } from "@nabungfi/shared/chain";

export function validateSessionIdentity(
  session: SessionDTO,
  privySubject: string,
  expectedAppId?: string,
): void {
  if (
    session.user.privySubject !== privySubject ||
    session.profile !== "testnet" ||
    (expectedAppId !== undefined && session.privyAppId !== expectedAppId)
  )
    throw new Error(
      "The verified session does not match this account and testnet deployment.",
    );
}

function canonicalPlan(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalPlan);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalPlan(item)]),
    );
  return value;
}
export async function verifyPlanFingerprint(plan: ChainPlan): Promise<void> {
  const { fingerprint, ...unsigned } = plan;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonicalPlan(unsigned))),
  );
  const actual = `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  if (fingerprint !== actual)
    throw new Error(
      "The unsigned transaction contents do not match the original plan fingerprint.",
    );
}

export function validateWalletPlan(
  goal: Pick<GoalDTO, "goalId" | "binding">,
  step: Pick<
    GoalStepDTO,
    | "id"
    | "status"
    | "transactionHash"
    | "goalId"
    | "plan"
    | "action"
    | "network"
    | "amountRaw"
  >,
): ChainPlan {
  const plan = step.plan;
  if (step.status !== "planned" || step.transactionHash || plan?.id !== step.id)
    throw new Error(
      "Only the original unsigned planned step can open your wallet.",
    );
  if (
    !plan ||
    plan.goalId !== goal.goalId ||
    step.goalId !== goal.goalId ||
    plan.action !== step.action ||
    plan.network !== step.network ||
    plan.amountRaw !== step.amountRaw
  )
    throw new Error(
      "The transaction plan does not match the original goal step.",
    );
  const expectedOwner =
    step.network === "solana"
      ? goal.binding.owner.solana
      : goal.binding.owner.evm;
  if (
    step.network === "solana"
      ? plan.owner !== expectedOwner
      : plan.owner.toLowerCase() !== expectedOwner.toLowerCase()
  )
    throw new Error("The transaction owner does not match this goal.");
  if (plan.transaction.kind === "evm") {
    if (step.network === "solana")
      throw new Error("The transaction family does not match this goal step.");
    const deployment = EVM_DEPLOYMENTS[step.network];
    const participant = goal.binding.participants.find(
      (candidate) => candidate.network === step.network,
    );
    if (!participant)
      throw new Error("This chain is not a participant in the goal.");
    const expectedTo =
      step.action === "create-vault"
        ? deployment.router
        : step.action === "approve"
          ? deployment.asset
          : participant.vault;
    if (
      plan.transaction.chainId !== deployment.chainId ||
      !expectedTo ||
      plan.transaction.to.toLowerCase() !== expectedTo.toLowerCase() ||
      BigInt(plan.transaction.value) !== 0n
    )
      throw new Error(
        "The transaction destination does not match the deployed testnet contract.",
      );
  } else if (
    step.network !== "solana" ||
    plan.transaction.chainId !== "solana-devnet"
  )
    throw new Error("The transaction chain does not match Solana Devnet.");
  return plan;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class WalletSdkFailure extends Error {
  constructor(readonly providerFailure: unknown) {
    super(
      "The wallet request did not finish. Inspect the original wallet request before trying again.",
    );
    this.name = "WalletSdkFailure";
  }
}
export async function callWalletSdk<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (failure) {
    throw new WalletSdkFailure(failure);
  }
}
export function isWalletRejection(failure: unknown): boolean {
  return (
    failure instanceof WalletSdkFailure &&
    failure.providerFailure !== null &&
    typeof failure.providerFailure === "object" &&
    "code" in failure.providerFailure &&
    failure.providerFailure.code === 4001
  );
}

export function apiUrl(
  path: string,
  configuredOrigin: string,
  browserOrigin: string,
): string {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new ApiError(
      "The API request path is not supported.",
      "CONFIGURATION_ERROR",
      500,
    );
  if (!configuredOrigin.trim()) return path;
  let origin: URL;
  let browser: URL;
  try {
    origin = new URL(configuredOrigin);
    browser = new URL(browserOrigin);
  } catch {
    throw new ApiError(
      "The API origin is not a valid URL.",
      "CONFIGURATION_ERROR",
      500,
    );
  }
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(browser.hostname);
  if (
    (origin.protocol !== "https:" && !local) ||
    !["https:", "http:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw new ApiError(
      "Use an HTTPS API origin without credentials, a path, query or fragment.",
      "CONFIGURATION_ERROR",
      500,
    );
  return origin.origin + path;
}
export async function appRequest<T>(
  getToken: () => Promise<string | null>,
  path: string,
  options: { body?: unknown; requestId?: string } = {},
): Promise<T> {
  const url = apiUrl(
    path,
    import.meta.env?.VITE_API_ORIGIN ?? "",
    window.location.origin,
  );
  const token = await getToken();
  if (!token)
    throw new ApiError(
      "Sign in again to access your savings.",
      "AUTH_REQUIRED",
      401,
    );
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.requestId ? { "Idempotency-Key": options.requestId } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ApiError(
      "The connection was interrupted. Check the original request before trying another transaction.",
      "UNKNOWN_OUTCOME",
      0,
    );
  }
  const data = await response.json().catch(() => {
    throw new ApiError(
      "The service response could not be read. Your wallet transaction may still be pending.",
      "UNKNOWN_OUTCOME",
      response.status,
    );
  });
  if (!response.ok)
    throw new ApiError(
      typeof data.error === "string"
        ? data.error
        : (data.error?.message ?? "The request could not be completed."),
      data.code ?? data.error?.code ?? "REQUEST_FAILED",
      response.status,
    );
  return data as T;
}

export async function guardWalletStart<T>(
  request: <R>(path: string, options: { body: unknown }) => Promise<R>,
  goalId: string,
  stepId: string,
  fingerprint: string,
  sign: () => Promise<T>,
): Promise<T> {
  const response = await request<{
    step: {
      id: string;
      status: string;
      transactionHash: string | null;
      plan: { fingerprint: string } | null;
    };
  }>(
    `/api/goals/${encodeURIComponent(goalId)}/steps/${encodeURIComponent(stepId)}/wallet-start`,
    { body: { fingerprint } },
  );
  if (
    response.step.id !== stepId ||
    response.step.status !== "signing" ||
    response.step.transactionHash ||
    response.step.plan?.fingerprint !== fingerprint
  )
    throw new Error(
      "The original wallet request could not be authorized. Reconcile it before continuing.",
    );
  return sign();
}

export function rawAmount(value: string): string {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value))
    throw new Error(
      "Enter a positive USDC amount with up to six decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const raw = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (raw <= 0n || raw > 18_446_744_073_709_551_615n)
    throw new Error("The amount is outside the supported range.");
  return raw.toString();
}
export function decimalAmount(raw: string): string {
  const value = BigInt(raw);
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, "0")}`;
}
export function formatUsdc(raw: string): string {
  const value = BigInt(raw);
  const whole = (value / 1_000_000n).toLocaleString("en-US");
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${value > 0n && value < 10_000n ? fraction.replace(/0+$/, "") : fraction.slice(0, 2)}`;
}
export function fundedPieces(
  totalRaw: string,
  targetRaw: string,
  achieved = false,
): number {
  const target = BigInt(targetRaw);
  if (target <= 0n) return 0;
  const full = Number(
    (BigInt(totalRaw) * 100n) / target > 100n
      ? 100n
      : (BigInt(totalRaw) * 100n) / target,
  );
  return achieved ? Math.min(100, full) : Math.min(99, full);
}

export interface WalletRecovery {
  userId: string;
  goalId: string;
  stepId: string;
  network: string;
  requestId: string;
  action: string;
  amountRaw?: string;
  transactionHash?: string;
  state: "planned" | "awaiting-wallet" | "submitted" | "confirmed" | "failed";
  createdAt: string;
}
export function validateRecoveryStep(
  record: WalletRecovery,
  step: Pick<
    GoalStepDTO,
    "id" | "metadataGoalId" | "action" | "network" | "amountRaw"
  >,
): void {
  if (
    record.stepId !== step.id ||
    record.goalId !== step.metadataGoalId ||
    record.action !== step.action ||
    record.network !== step.network ||
    record.amountRaw !== step.amountRaw
  )
    throw new Error(
      "The wallet step changed from the original saved goal, action, chain or amount.",
    );
}
export function validateReceiptIdentity(
  record: WalletRecovery,
  step: GoalStepDTO,
  hash: string,
): void {
  validateRecoveryStep(record, step);
  const original = record.network === "solana" ? hash : hash.toLowerCase();
  if (step.transactionHash !== original)
    throw new Error(
      "The receipt does not match your original transaction hash.",
    );
}
const recoveryPrefix = "nabungfi:wallet-step:v1:";
export function clearRejectedRecovery(
  storage: Pick<Storage, "getItem" | "removeItem">,
  record: WalletRecovery,
): void {
  const key = `${recoveryPrefix}${record.userId}:${record.stepId}`;
  const raw = storage.getItem(key);
  if (!raw) return;
  const current = JSON.parse(raw) as WalletRecovery;
  if (
    current.userId !== record.userId ||
    current.stepId !== record.stepId ||
    current.goalId !== record.goalId ||
    current.requestId !== record.requestId ||
    current.action !== record.action ||
    current.network !== record.network ||
    current.amountRaw !== record.amountRaw ||
    current.transactionHash !== undefined
  )
    throw new Error("The original hashed request cannot be discarded.");
  storage.removeItem(key);
}
export interface PendingApiRequest {
  userId: string;
  requestId: string;
  path: string;
  body: unknown;
  createdAt: string;
}
export function writeApiRequest(
  storage: Pick<Storage, "getItem" | "setItem">,
  request: PendingApiRequest,
) {
  const key = `nabungfi:api-request:v1:${request.userId}:${request.requestId}`;
  const prior = storage.getItem(key);
  if (prior && prior !== JSON.stringify(request))
    throw new Error("The original API request cannot be replaced.");
  storage.setItem(key, JSON.stringify(request));
}
export function readApiRequests(
  storage: Storage,
  userId: string,
): PendingApiRequest[] {
  const result: PendingApiRequest[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(`nabungfi:api-request:v1:${userId}:`)) continue;
    try {
      const record = JSON.parse(
        storage.getItem(key) ?? "null",
      ) as PendingApiRequest;
      if (
        record.userId === userId &&
        typeof record.path === "string" &&
        typeof record.requestId === "string"
      )
        result.push(record);
      else throw new Error("Invalid saved request");
    } catch {
      throw new Error(
        "A saved request could not be read. Reconcile browser storage before continuing.",
      );
    }
  }
  return result;
}
export function clearApiRequest(
  storage: Pick<Storage, "removeItem">,
  request: PendingApiRequest,
) {
  storage.removeItem(
    `nabungfi:api-request:v1:${request.userId}:${request.requestId}`,
  );
}
export function writeRecovery(
  storage: Pick<Storage, "getItem" | "setItem">,
  record: WalletRecovery,
) {
  const key = `${recoveryPrefix}${record.userId}:${record.stepId}`;
  const prior = storage.getItem(key);
  if (prior) {
    const old = JSON.parse(prior) as WalletRecovery;
    if (
      old.goalId !== record.goalId ||
      old.network !== record.network ||
      old.requestId !== record.requestId ||
      old.action !== record.action ||
      old.amountRaw !== record.amountRaw ||
      (old.transactionHash && old.transactionHash !== record.transactionHash)
    )
      throw new Error("The original transaction identity cannot be replaced.");
  }
  storage.setItem(key, JSON.stringify(record));
}
export function readRecovery(
  storage: Storage,
  userId: string,
): WalletRecovery[] {
  const records: WalletRecovery[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(`${recoveryPrefix}${userId}:`)) continue;
    try {
      const record = JSON.parse(
        storage.getItem(key) ?? "null",
      ) as WalletRecovery | null;
      if (
        record?.userId === userId &&
        typeof record.goalId === "string" &&
        typeof record.stepId === "string" &&
        typeof record.requestId === "string" &&
        typeof record.network === "string" &&
        [
          "planned",
          "awaiting-wallet",
          "submitted",
          "confirmed",
          "failed",
        ].includes(record.state)
      )
        records.push(record);
      else throw new Error("Invalid saved wallet request");
    } catch {
      throw new Error(
        "A saved wallet request is unreadable. Keep this browser storage and reconcile it before sending another transaction.",
      );
    }
  }
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function base58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let result = "";
  while (value > 0n) {
    result = alphabet[Number(value % 58n)] + result;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = "1" + result;
  }
  return result;
}
