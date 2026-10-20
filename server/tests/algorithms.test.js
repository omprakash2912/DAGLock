import test from "node:test";
import assert from "node:assert/strict";
import { detectDeadlock, bankersSafety, validateState, simulateRecovery, compareRecoveryCandidates } from "../algorithms.js";

const deadlock = {
  processes:["P1","P2","P3"], resources:["R1","R2"], total:[1,1], available:[0,0],
  allocation:[[1,0],[0,1],[0,0]], request:[[0,1],[1,0],[0,0]], max:[[1,1],[1,1],[1,0]]
};
const safe = {
  processes:["P0","P1","P2"], resources:["A","B"], total:[4,2], available:[2,1],
  allocation:[[1,0],[0,1],[1,0]], request:[[0,0],[0,0],[0,0]], max:[[2,1],[1,1],[2,0]]
};
const unsafe = {
  processes:["P0","P1","P2"], resources:["A","B"], total:[3,2], available:[0,0],
  allocation:[[2,0],[0,1],[1,1]], request:[[0,0],[0,0],[0,0]], max:[[3,2],[2,2],[3,2]]
};
const multi = {
  processes:["P1","P2","P3"], resources:["R1","R2"], total:[3,2], available:[1,0],
  allocation:[[1,0],[1,1],[0,1]], request:[[0,1],[1,0],[0,0]], max:[[2,1],[2,2],[1,1]]
};

test("detects a two-process circular-wait deadlock", () => {
  validateState(deadlock);
  const result = detectDeadlock(deadlock.available, deadlock.allocation, deadlock.request, deadlock.processes);
  assert.equal(result.safe, false);
  assert.deepEqual(result.deadlocked, [0,1]);
});
test("finds a safe sequence with Banker's algorithm", () => {
  validateState(safe);
  const result = bankersSafety(safe.available, safe.allocation, safe.max, safe.processes);
  assert.equal(result.safe, true);
  assert.equal(result.sequence.length, 3);
});
test("reports unsafe state without incorrectly claiming current deadlock", () => {
  validateState(unsafe);
  assert.equal(bankersSafety(unsafe.available, unsafe.allocation, unsafe.max, unsafe.processes).safe, false);
  assert.equal(detectDeadlock(unsafe.available, unsafe.allocation, unsafe.request, unsafe.processes).safe, true);
});
test("handles multiple instances with matrix-based detection", () => {
  validateState(multi);
  assert.equal(detectDeadlock(multi.available, multi.allocation, multi.request, multi.processes).safe, true);
});
test("rejects inconsistent resource conservation", () => {
  const invalid = structuredClone(safe); invalid.total[0] = 99;
  assert.throws(() => validateState(invalid), /conservation mismatch/);
});
test("rejects maximum claim below current allocation", () => {
  const invalid = structuredClone(safe); invalid.max[0][0] = 0;
  assert.throws(() => validateState(invalid), /Maximum claim/);
});
test("rejects a current request that exceeds remaining maximum claim", () => {
  const invalid = structuredClone(safe); invalid.request[0][1] = 2;
  assert.throws(() => validateState(invalid), /exceeds its remaining Need/);
});
test("rejects duplicate process and resource names", () => {
  const invalid = structuredClone(safe); invalid.processes[1] = invalid.processes[0];
  assert.throws(() => validateState(invalid), /unique/);
});
test("recovery releases held resources and preserves conservation", () => {
  const result = simulateRecovery(deadlock, 0);
  assert.deepEqual(result.released, [1,0]);
  assert.deepEqual(result.state.available, [1,0]);
  assert.deepEqual(result.state.allocation[0], [0,0]);
  assert.deepEqual(result.state.request[0], [0,0]);
  assert.deepEqual(result.state.max[0], [0,0]);
  assert.equal(result.state.processes[0], "P1 (terminated)");
  assert.equal(validateState(result.state), true);
});
test("terminated rows are excluded from both completion sequences", () => {
  const recovered = simulateRecovery(deadlock, 0).state;
  const detection = detectDeadlock(recovered.available, recovered.allocation, recovered.request, recovered.processes);
  const safety = bankersSafety(recovered.available, recovered.allocation, recovered.max, recovered.processes);
  assert.equal(detection.sequence.includes(0), false);
  assert.equal(safety.sequence.includes(0), false);
});
test("rejects terminating the same process twice", () => {
  const recovered = simulateRecovery(deadlock, 0).state;
  assert.throws(() => simulateRecovery(recovered, 0), /already terminated/);
});
test("rejects malformed dimensions and negative values", () => {
  const invalid = structuredClone(safe); invalid.allocation[0][0] = -1;
  assert.throws(() => validateState(invalid), /non-negative integers/);
  const badDimensions = structuredClone(safe); badDimensions.request.pop();
  assert.throws(() => validateState(badDimensions), /dimensions/);
});


test("recovery candidate comparison is isolated and returns all active choices", () => {
  const original = structuredClone(deadlock);
  const result = compareRecoveryCandidates(deadlock);
  assert.equal(result.options.length, 3);
  assert.equal(result.options.every(option => option.state.processes[option.processIndex].includes("(terminated)")), true);
  assert.deepEqual(deadlock, original, "candidate analysis must not mutate the live model");
  assert.match(result.note, /heuristic/);
});
test("requires a Total vector so resource conservation cannot be bypassed", () => {
  const invalid = structuredClone(safe); delete invalid.total;
  assert.throws(() => validateState(invalid), /required arrays/);
});


test("detects a deadlock in a multiple-instance resource model", () => {
  const multiDeadlock = {
    processes:["P1","P2","P3","P4"], resources:["R1","R2"], total:[2,2], available:[0,0],
    allocation:[[1,0],[0,1],[1,0],[0,1]], request:[[0,1],[1,0],[0,1],[1,0]], max:[[1,1],[1,1],[1,1],[1,1]]
  };
  validateState(multiDeadlock);
  const result = detectDeadlock(multiDeadlock.available, multiDeadlock.allocation, multiDeadlock.request, multiDeadlock.processes);
  assert.equal(result.safe, false);
  assert.deepEqual(result.deadlocked, [0,1,2,3]);
});


test("rejects maximum claims greater than the total system instances", () => {
  const invalid = structuredClone(safe); invalid.max[0][0] = 5;
  assert.throws(() => validateState(invalid), /cannot exceed the system total/);
});
