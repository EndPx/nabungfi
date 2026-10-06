import { Buffer } from "buffer";

// Privy's Solana wallet encodes transaction bytes using the browser Buffer global.
// This module loads with the app; marketing does not import the wallet SDK.
const browserGlobals = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
browserGlobals.Buffer ??= Buffer;
