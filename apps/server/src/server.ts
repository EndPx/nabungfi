import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DomainError, type Action, type Chain } from "@nabungfi/shared";
import type { DemoStore } from "./store.js";

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.includes("application/json")) throw new DomainError("JSON_REQUIRED", "Send a JSON request.");
  let text = "";
  for await (const chunk of req) {
    text += chunk.toString();
    if (text.length > 8_192) throw new DomainError("REQUEST_TOO_LARGE", "The request is too large.");
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new DomainError("INVALID_JSON", "Send a valid JSON object."); }
}
function string(p: Record<string, unknown>, field: string): string {
  if (typeof p[field] !== "string") throw new DomainError("INVALID_INPUT", `${field} is required.`);
  return p[field];
}
function chain(p: Record<string, unknown>): Chain {
  if (p.chain !== "solana" && p.chain !== "base") throw new DomainError("INVALID_CHAIN", "Choose Solana or Base.");
  return p.chain;
}
function action(path: string, p: Record<string, unknown>): Action {
  switch (path) {
    case "/api/deposit": return { type: "deposit", chain: chain(p), amount: string(p, "amount") };
    case "/api/claim": return { type: "claim", chain: chain(p) };
    case "/api/create-goal": return { type: "create-goal", name: string(p, "name"), target: string(p, "target") };
    case "/api/demo/yield": return { type: "demo-yield", chain: chain(p), amount: string(p, "amount") };
    case "/api/demo/liquidity": return { type: "demo-liquidity", chain: chain(p), amount: string(p, "amount") };
    case "/api/demo/reset": return { type: "demo-reset" };
    case "/api/prepare": return { type: "prepare" };
    case "/api/finalize": return { type: "finalize" };
    case "/api/refresh": return { type: "refresh" };
    case "/api/abort": return { type: "abort" };
    default: throw new DomainError("NOT_FOUND", "This action does not exist.");
  }
}
function respond(res: ServerResponse, code: number, value: unknown) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}
export function demoServer(store: DemoStore) {
  return createServer(async (req, res) => {
    try {
      if (req.headers.origin) {
        let origin: URL;
        try { origin = new URL(req.headers.origin); } catch { throw new DomainError("ORIGIN_REJECTED", "This demo only accepts local requests."); }
        if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new DomainError("ORIGIN_REJECTED", "This demo only accepts local requests.");
      }
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (req.method === "GET" && path === "/api/state") return respond(res, 200, store.view());
      if (req.method === "GET" && path === "/api/health") return respond(res, 200, { ok: true, mode: "local-demo", realFunds: false });
      if (req.method !== "POST") return respond(res, 404, { error: "Not found", code: "NOT_FOUND" });
      const p = await body(req);
      const state = await store.apply(action(path, p), string(p, "requestId"), string(p, "goalId"));
      respond(res, 200, state);
    } catch (error) {
      if (error instanceof DomainError) return respond(res, error.code === "NOT_FOUND" ? 404 : error.code === "ORIGIN_REJECTED" ? 403 : 400, { error: error.message, code: error.code });
      console.error("Demo request failed", error instanceof Error ? error.message : "unknown error");
      respond(res, 500, { error: "The local demo could not save this change. Please retry with the same request.", code: "STORE_ERROR" });
    }
  });
}
