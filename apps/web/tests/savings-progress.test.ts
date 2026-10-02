import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPieceProgress, formatNativeGas } from "../src/savings-progress";

test("small confirmed savings contribute to a fractional piece without rounding up", () => {
  assert.deepEqual(nextPieceProgress("25000000", "10000000000"), {
    fractionBasisPoints: 2500,
    remainingRaw: "75000000",
    targetFunded: false,
  });
  assert.equal(
    nextPieceProgress("100000000", "10000000000").remainingRaw,
    "100000000",
  );
  assert.equal(
    nextPieceProgress("9999999999", "10000000000").remainingRaw,
    "1",
  );
  assert.equal(
    nextPieceProgress("10000000000", "10000000000").targetFunded,
    true,
  );
});
test("next threshold remains attainable for fractional and microscopic goal targets", () => {
  for (const target of [1n, 3n, 99n, 101n, 123457n]) {
    for (const total of [0n, target / 2n, target - 1n]) {
      const remaining = BigInt(
        nextPieceProgress(String(total), String(target)).remainingRaw,
      );
      assert.ok(remaining > 0n && total + remaining <= target);
    }
  }
});
test("native gas display preserves tiny and large balances without floating point", () => {
  assert.equal(formatNativeGas("1", "solana"), "0.000000001 SOL");
  assert.equal(formatNativeGas("1", "base"), "0.000000000000000001 ETH");
  assert.equal(formatNativeGas("100000000000000000", "ethereum"), "0.1 ETH");
});
