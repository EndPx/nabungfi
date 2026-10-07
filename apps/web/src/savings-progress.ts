/** Presentation only. Whole pieces and unlocking still require verified goal state. */
import type { ChainNetwork } from "@nabungfi/shared/chain";

export function chainAllocation(positions: readonly { network: ChainNetwork; assetsRaw: string; claimedRaw: string }[]) {
  const values = positions.map(position => {
    const assets = BigInt(position.assetsRaw), claimed = BigInt(position.claimedRaw);
    if (assets < 0n || claimed < 0n) throw new Error("Invalid chain allocation");
    return { ...position, amount: assets + claimed };
  });
  const total = values.reduce((sum, position) => sum + position.amount, 0n);
  const shares = values.map((position, index) => ({
    network: position.network, assetsRaw: position.assetsRaw, claimedRaw: position.claimedRaw,
    amountRaw: position.amount.toString(),
    basisPoints: total ? Number(position.amount * 10000n / total) : 0,
    remainder: total ? position.amount * 10000n % total : 0n, index,
  }));
  if (total) {
    const missing = 10000 - shares.reduce((sum, share) => sum + share.basisPoints, 0);
    const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
    for (let index = 0; index < missing; index++) ranked[index].basisPoints++;
  }
  return { totalRaw: total.toString(), shares: shares.map(({ remainder: _remainder, index: _index, ...share }) => share) };
}

export function formatExactUsdc(raw: string): string {
  const amount = BigInt(raw);
  const whole = (amount / 1000000n).toLocaleString("en-US");
  const fraction = (amount % 1000000n).toString().padStart(6, "0").replace(/0+$/, "");
  return whole + (fraction ? `.${fraction}` : "");
}

export function formatChainShare(basisPoints: number, amountRaw: string): string {
  if (!basisPoints && BigInt(amountRaw) > 0n) return "<0.01%";
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function nextPieceProgress(totalRaw: string, targetRaw: string) {
  const total = BigInt(totalRaw);
  const target = BigInt(targetRaw);
  if (total < 0n || target <= 0n) throw new Error("Invalid savings progress");
  if (total >= target)
    return {
      fractionBasisPoints: 10000,
      remainingRaw: "0",
      targetFunded: true,
    };
  const scaled = total * 100n;
  const nextThreshold = ((scaled / target + 1n) * target + 99n) / 100n;
  return {
    fractionBasisPoints: Number(((scaled % target) * 10000n) / target),
    remainingRaw: (nextThreshold - total).toString(),
    targetFunded: false,
  };
}

export function formatNativeGas(raw: string, network: string): string {
  const decimals = network === "solana" ? 9 : 18;
  const value = BigInt(raw);
  const scale = 10n ** BigInt(decimals);
  const fraction = (value % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${value / scale}${fraction ? `.${fraction}` : ""} ${network === "solana" ? "SOL" : "ETH"}`;
}
