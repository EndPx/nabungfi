import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKSHOP_MODELS } from "../src/goal-models";
test("every target model has one stable component per savings percent and distinct geometry", () => {
  for (const [name, pieces] of Object.entries(WORKSHOP_MODELS)) {
    assert.equal(pieces.length, 100, name);
    assert.equal(new Set(pieces.map((piece) => piece.id)).size, 100);
    for (const piece of pieces) {
      assert.ok(piece.position.every(Number.isFinite));
      assert.ok(piece.size.every((size) => Number.isFinite(size) && size > 0));
      assert.ok(piece.id >= 0 && piece.id < 100 && piece.label.length > 0);
    }
  }
  assert.notDeepEqual(WORKSHOP_MODELS.house, WORKSHOP_MODELS.car);
  assert.notDeepEqual(WORKSHOP_MODELS.laptop, WORKSHOP_MODELS.car);
  assert.equal(WORKSHOP_MODELS.house[99].label, "Door handle");
  assert.equal(WORKSHOP_MODELS.laptop[99].label, "Final display mark");
});
