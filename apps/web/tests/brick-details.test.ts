import { test } from "node:test";
import assert from "node:assert/strict";
import { brickBevel, studLayout, STUD_PITCH, STUD_RADIUS } from "../src/brick-details";
import { WORKSHOP_MODELS } from "../src/goal-models";

test("small square bricks and laptop plates retain centered, symmetric studs", () => {
  assert.deepEqual(studLayout(0.34, 0.34), [[0, 0]]);
  const plate = studLayout(0.49, 0.43);
  assert.equal(plate.length, 4);
  assert.ok(plate.some(([x]) => x < 0) && plate.some(([x]) => x > 0));
  assert.ok(plate.some(([, z]) => z < 0) && plate.some(([, z]) => z > 0));
  assert.deepEqual(studLayout(0.1, 0.1), []);
});

test("every model's stud grid fits its brick footprint and keeps a uniform pitch", () => {
  for (const pieces of Object.values(WORKSHOP_MODELS)) {
    for (const piece of pieces.filter((part) => part.studs)) {
      const points = studLayout(piece.size[0], piece.size[2]);
      assert.ok(points.length > 0, `${piece.label} should have visible studs`);
      for (const [x, z] of points) {
        assert.ok(Math.abs(x) + STUD_RADIUS < piece.size[0] / 2);
        assert.ok(Math.abs(z) + STUD_RADIUS < piece.size[2] / 2);
        assert.ok(points.some(([otherX, otherZ]) => Math.abs(otherX + x) < 1e-9 && Math.abs(otherZ + z) < 1e-9));
      }
      for (const axis of [0, 1]) {
        const coordinates = [...new Set(points.map((point) => point[axis]))].sort((a, b) => a - b);
        for (let i = 1; i < coordinates.length; i++) {
          assert.ok(Math.abs(coordinates[i] - coordinates[i - 1] - STUD_PITCH) < 1e-9);
        }
      }
    }
  }
});

test("thin windows, keys and trim keep a flat face after beveling", () => {
  for (const pieces of Object.values(WORKSHOP_MODELS)) {
    for (const piece of pieces) {
      const smallestDimension = Math.min(...piece.size);
      assert.ok(brickBevel(piece.size) > 0);
      assert.ok(brickBevel(piece.size) < smallestDimension / 4);
    }
  }
});

test("custom sculpture builds upward with support beneath every elevated piece", () => {
  const pieces = WORKSHOP_MODELS.custom;
  const base = Math.min(...pieces.map((piece) => piece.position[1]));
  for (const piece of pieces.filter((part) => part.position[1] > base)) {
    const supportingArea = pieces.filter((lower) => lower.id < piece.id &&
      Math.abs((piece.position[1] - piece.size[1] / 2) - (lower.position[1] + lower.size[1] / 2)) < 0.02)
      .reduce((area, lower) => {
        const overlap = (axis: 0 | 2) => Math.max(0,
          Math.min(piece.position[axis] + piece.size[axis] / 2, lower.position[axis] + lower.size[axis] / 2) -
          Math.max(piece.position[axis] - piece.size[axis] / 2, lower.position[axis] - lower.size[axis] / 2));
        return area + overlap(0) * overlap(2);
      }, 0);
    assert.ok(supportingArea > piece.size[0] * piece.size[2] * 0.8,
      `piece ${piece.id} needs a previously built support`);
  }
});

test("house back walls meet the side walls at each corner", () => {
  const pieces = WORKSHOP_MODELS.house;
  const backs = pieces.filter((piece) => piece.label === "Back walls");
  for (const side of pieces.filter((piece) => piece.label === "Side walls" && piece.position[2] < 0)) {
    const back = backs
      .filter((piece) => piece.position[1] === side.position[1] && Math.sign(piece.position[0]) === Math.sign(side.position[0]))
      .sort((a, b) => Math.abs(b.position[0]) - Math.abs(a.position[0]))[0];
    assert.ok(back);
    const sideInsideX = Math.abs(side.position[0]) - side.size[0] / 2;
    const backOutsideX = Math.abs(back.position[0]) + back.size[0] / 2;
    const sideBackZ = side.position[2] - side.size[2] / 2;
    const backInsideZ = back.position[2] + back.size[2] / 2;
    assert.ok(backOutsideX >= sideInsideX - 0.02);
    assert.ok(Math.abs(sideBackZ - backInsideZ) < 0.02);
  }
});
