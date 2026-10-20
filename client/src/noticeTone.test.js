import test from "node:test";
import assert from "node:assert/strict";
import { getNoticeTone } from "./noticeTone.js";

test("deadlock remaining is always a danger state", () => {
  assert.equal(getNoticeTone("Deadlock remains. The algorithm could not finish: P1, P2."), "danger");
});

test("deadlock detected is a danger state", () => {
  assert.equal(getNoticeTone("Deadlock detected: P1, P2."), "danger");
});

test("successful detection is green", () => {
  assert.equal(getNoticeTone("No deadlock detected. Completion sequence: P1 → P2."), "success");
});

test("safe Banker state is green", () => {
  assert.equal(getNoticeTone("Safe state. Sequence: P1 → P2."), "success");
});

test("unsafe Banker state is a warning", () => {
  assert.equal(getNoticeTone("Unsafe state. Unable to finish: P1, P2."), "warning");
});

test("operation failures are danger states", () => {
  assert.equal(getNoticeTone("Recovery failed: API unavailable."), "danger");
});

test("routine progress is informational", () => {
  assert.equal(getNoticeTone("Recovery applied. Re-run deadlock detection to verify the resulting state."), "info");
});

test("empty messages safely fall back to informational", () => {
  assert.equal(getNoticeTone(""), "info");
});
