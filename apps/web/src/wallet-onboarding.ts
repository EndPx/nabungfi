import type { SessionDTO } from "@nabungfi/shared/application";
import { validateSessionIdentity } from "./live-api";

type WalletFamily = "ethereum" | "solana";
export interface WalletProfile {
  id: string;
  linkedAccounts: readonly { type: string; chainType?: string; address?: string }[];
}

export function hasOwnerWallets(wallets: readonly { chainType: string; address: string }[]) {
  return ["ethereum", "solana"].every(family =>
    wallets.some(wallet => wallet.chainType === family && Boolean(wallet.address)),
  );
}

export interface WalletOnboardingOptions {
  userId: string;
  appId: string;
  isCurrent: () => boolean;
  isOnline: () => boolean;
  refreshUser: () => Promise<WalletProfile>;
  createEthereumWallet: () => Promise<unknown>;
  createSolanaWallet: () => Promise<unknown>;
  readSession: () => Promise<SessionDTO>;
  wait?: () => Promise<void>;
}

async function prepareWallets(options: WalletOnboardingOptions) {
  const active = () => {
    if (!options.isCurrent()) throw new Error("Account changed while preparing wallets.");
    if (!options.isOnline()) throw new Error("Reconnect to finish preparing your wallets.");
  };
  const refresh = async () => {
    active();
    const profile = await options.refreshUser();
    active();
    if (profile.id !== options.userId) throw new Error("Wallet setup returned a different account.");
    return profile;
  };
  const hasFamily = (profile: WalletProfile, family: WalletFamily) => profile.linkedAccounts.some(
    account => account.type === "wallet" && account.chainType === family && Boolean(account.address),
  );
  let profile = await refresh();
  for (const family of ["ethereum", "solana"] as const) {
    if (hasFamily(profile, family)) continue;
    active();
    try {
      // Default SDK creation never requests an additional wallet or a server signer.
      await (family === "ethereum" ? options.createEthereumWallet() : options.createSolanaWallet());
    } catch (failure) {
      // Another login/modal/tab may have finished creation. Read ownership before retrying.
      profile = await refresh();
      if (!hasFamily(profile, family)) throw failure;
    }
    profile = await refresh();
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    active();
    const session = await options.readSession();
    active();
    validateSessionIdentity(session, options.userId, options.appId);
    if (hasOwnerWallets(session.user.wallets)) return session;
    if (attempt < 7) await (options.wait?.() ?? new Promise<void>(resolve => setTimeout(resolve, 500)));
  }
  throw new Error("Your wallet ownership is still syncing. Retry verification to finish setup.");
}

/** Repeated renders/StrictMode share the original creation flight for this identity. */
export function createWalletOnboarding() {
  let flight: { userId: string; promise: Promise<SessionDTO> } | undefined;
  return (options: WalletOnboardingOptions) => {
    if (flight?.userId === options.userId) return flight.promise;
    const promise = prepareWallets(options).finally(() => {
      if (flight?.promise === promise) flight = undefined;
    });
    flight = { userId: options.userId, promise };
    return promise;
  };
}
