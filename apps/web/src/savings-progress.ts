/** Presentation only. Whole pieces and unlocking still require verified goal state. */
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
