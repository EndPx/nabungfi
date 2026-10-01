import { resolve } from "node:path";
import { DemoStore } from "./store.js";
import { demoServer } from "./server.js";

const port = Number(process.env.NABUNGFI_DEMO_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid demo port");
const file = process.env.NABUNGFI_DEMO_STATE ?? resolve(import.meta.dirname, "../../../.local/demo-state.json");
const store = await DemoStore.open(file);
demoServer(store).listen(port, "127.0.0.1", () => console.log(`NabungFi local-demo API: http://127.0.0.1:${port} (no real funds)`));
