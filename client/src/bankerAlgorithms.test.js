import test from "node:test";
import assert from "node:assert/strict";
import { validate, needMatrix, safetyTrace, checkRequest } from "./bankerAlgorithms.js";

const example1 = {
  processes: ["P0", "P1", "P2", "P3", "P4"],
  resources: ["A", "B", "C", "D"],
  allocation: [[0,0,1,2],[1,0,0,0],[1,3,5,4],[0,6,3,2],[0,0,1,4]],
  max: [[0,0,1,2],[1,7,5,0],[2,3,5,6],[0,6,5,2],[0,6,5,6]],
  available: [1,5,2,0]
};
const example2 = {
  processes: ["P0", "P1", "P2", "P3", "P4"],
  resources: ["A", "B", "C", "D"],
  allocation: [[2,0,0,1],[3,1,2,1],[2,1,0,3],[1,3,1,2],[1,4,3,2]],
  max: [[4,2,1,2],[5,2,5,2],[2,3,1,6],[1,4,2,1],[3,6,6,5]],
  available: [3,3,2,1]
};

test("lecture example 1 is internally valid", () => assert.deepEqual(validate(example1), []));
test("Need matrix is Max minus Allocation", () => assert.deepEqual(needMatrix(example1), [[0,0,0,0],[0,7,5,0],[1,0,0,2],[0,0,2,0],[0,6,4,2]]));
test("lecture example 1 has a safe sequence", () => {
  const result = safetyTrace(example1);
  assert.equal(result.safe, true);
  assert.equal(result.sequence[0], "P0");
  assert.equal(result.sequence.length, 5);
  assert.deepEqual([...result.sequence].sort(), ["P0", "P1", "P2", "P3", "P4"]);
});
test("request within Need and Available is granted only if tentative state remains safe", () => {
  const result = checkRequest(example1, 1, [0,0,1,0]);
  assert.equal(result.granted, true);
  assert.equal(result.tentative.available[2], 1);
  assert.equal(example1.available[2], 2, "request evaluation must not mutate the original model");
});
test("request exceeding Need is rejected", () => assert.equal(checkRequest(example1, 1, [0,8,0,0]).stage, "need"));
test("request exceeding Available but within Need must wait", () => assert.equal(checkRequest(example1, 1, [0,6,0,0]).stage, "available"));
test("negative and fractional requests are rejected", () => {
  assert.equal(checkRequest(example1, 1, [-1,0,0,0]).stage, "input");
  assert.equal(checkRequest(example1, 1, [0,0.5,0,0]).stage, "input");
});
test("lecture example 2 source inconsistency is surfaced, not silently repaired", () => {
  const issues = validate(example2);
  assert.ok(issues.some(issue => issue.includes("P3") && issue.includes("D") && issue.includes("less than Allocation")));
});
test("invalid model blocks resource request evaluation", () => {
  assert.equal(checkRequest(example2, 1, [1,1,0,0]).stage, "invalid-model");
});
test("lecture example 2 request decisions work after its source inconsistency is corrected", () => {
  const corrected = structuredClone(example2);
  corrected.max[3][3] = 2; // Only a test fixture: source slide value must be confirmed by faculty.
  assert.deepEqual(validate(corrected), []);
  const p1 = checkRequest(corrected, 1, [1,1,0,0]);
  const p4 = checkRequest(corrected, 4, [0,0,2,0]);
  assert.equal(p1.granted, true);
  assert.equal(p4.granted, false);
  assert.equal(p4.stage, "unsafe");
});
test("duplicate labels and mismatched dimensions are rejected", () => {
  const duplicate = structuredClone(example1); duplicate.processes[1] = duplicate.processes[0];
  assert.ok(validate(duplicate).some(issue => issue.includes("unique")));
  const malformed = structuredClone(example1); malformed.allocation[0].pop();
  assert.ok(validate(malformed).some(issue => issue.includes("dimensions")));
});

test("RAG projection request matrix validates against remaining Need", () => {
  const model = structuredClone(example1);
  model.outstandingRequest = model.processes.map(() => model.resources.map(() => 0));
  model.outstandingRequest[1][1] = 8;
  assert.ok(validate(model).some(issue => issue.includes("P1") && issue.includes("outstanding request") && issue.includes("Need")));
  model.outstandingRequest[1][1] = 1;
  assert.deepEqual(validate(model), []);
});

test("RAG projection request matrix rejects malformed dimensions", () => {
  const model = structuredClone(example1);
  model.outstandingRequest = [[0, 0]];
  assert.ok(validate(model).some(issue => issue.includes("Outstanding Request matrix dimensions")));
});
