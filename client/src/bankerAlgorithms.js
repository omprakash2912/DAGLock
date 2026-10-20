const copy = value => JSON.parse(JSON.stringify(value));
export const vector = values => `(${values.join(", ")})`;
const sumColumn = (matrix, j) => matrix.reduce((sum, row) => sum + row[j], 0);
export const needMatrix = model => model.max.map((row, i) => row.map((v, j) => v - model.allocation[i][j]));

export function validate(model) {
  const issues = [];
  if (!model || !Array.isArray(model.processes) || !Array.isArray(model.resources) || !Array.isArray(model.available) || !Array.isArray(model.allocation) || !Array.isArray(model.max)) return ["Model is missing required arrays."];
  const n = model.processes.length, m = model.resources.length;
  if (!n || !m) issues.push("Keep at least one process and one resource type.");
  if (n > 8) issues.push("The lab supports up to 8 processes.");
  if (m > 6) issues.push("The lab supports up to 6 resource types.");
  if (new Set(model.processes).size !== n || model.processes.some(p => typeof p !== "string" || !p.trim())) issues.push("Process labels must be non-empty and unique.");
  if (new Set(model.resources).size !== m || model.resources.some(r => typeof r !== "string" || !r.trim())) issues.push("Resource labels must be non-empty and unique.");
  if (model.available.length !== m || model.allocation.length !== n || model.max.length !== n || model.allocation.some(r => !Array.isArray(r) || r.length !== m) || model.max.some(r => !Array.isArray(r) || r.length !== m)) issues.push("Matrix dimensions do not match the selected process/resource counts.");
  if (model.available.some(v => !Number.isSafeInteger(v) || v < 0) || [...model.allocation.flat(), ...model.max.flat()].some(v => !Number.isSafeInteger(v) || v < 0)) issues.push("All matrix/vector entries must be non-negative integers.");
  if (model.allocation.length === n && model.max.length === n && model.allocation.every(r => r.length === m) && model.max.every(r => r.length === m) && model.available.length === m) {
    model.processes.forEach((p, i) => model.resources.forEach((r, j) => {
      if (model.max[i][j] < model.allocation[i][j]) issues.push(`${p}: Max(${r}) = ${model.max[i][j]} is less than Allocation(${r}) = ${model.allocation[i][j]}.`);
    }));
    model.resources.forEach((r, j) => {
      const total = model.available[j] + sumColumn(model.allocation, j);
      model.max.forEach((row, i) => { if (row[j] > total) issues.push(`${model.processes[i]} claims ${row[j]} instance(s) of ${r}, but only ${total} exist in total.`); });
    });
  }
  if (model.outstandingRequest !== undefined) {
    if (!Array.isArray(model.outstandingRequest) || model.outstandingRequest.length !== n || model.outstandingRequest.some(row => !Array.isArray(row) || row.length !== m)) {
      issues.push("Outstanding Request matrix dimensions do not match the process/resource counts.");
    } else if (model.outstandingRequest.some(row => row.some(v => !Number.isSafeInteger(v) || v < 0))) {
      issues.push("Outstanding Request values must be non-negative integers.");
    } else if (model.allocation.length === n && model.max.length === n && model.allocation.every(r => r.length === m) && model.max.every(r => r.length === m)) {
      const need = needMatrix(model);
      model.outstandingRequest.forEach((row, i) => row.forEach((value, j) => {
        if (value > need[i][j]) issues.push(`${model.processes[i]}: outstanding request for ${model.resources[j]} exceeds remaining Need.`);
      }));
    }
  }
  return [...new Set(issues)];
}

export function safetyTrace(model) {
  const need = needMatrix(model);
  let work = [...model.available];
  const finish = model.processes.map(() => false);
  const sequence = [];
  const steps = [{ title: "Initialize Work", process: null, work: [...work], finish: [...finish], detail: `Start with Work = Available = ${vector(work)}. Need is calculated as Max − Allocation.` }];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < model.processes.length; i++) {
      if (finish[i]) continue;
      const canFinish = need[i].every((v, j) => v <= work[j]);
      steps.push({ title: `Check ${model.processes[i]}`, process: i, work: [...work], finish: [...finish], detail: `Need ${model.processes[i]} = ${vector(need[i])}; Work = ${vector(work)}. ${canFinish ? "Every Need entry is ≤ Work, so this process can finish." : "At least one Need entry exceeds Work, so this process must wait for now."}` });
      if (!canFinish) continue;
      const before = [...work];
      work = work.map((v, j) => v + model.allocation[i][j]);
      finish[i] = true;
      sequence.push(i);
      progress = true;
      steps.push({ title: `${model.processes[i]} finishes`, process: i, work: [...work], before, finish: [...finish], detail: `${model.processes[i]} completes and releases Allocation ${vector(model.allocation[i])}. Work changes from ${vector(before)} to ${vector(work)}.` });
    }
  }
  const unfinished = finish.map((done, i) => done ? -1 : i).filter(i => i >= 0);
  steps.push({ title: unfinished.length ? "Unsafe state" : "Safe state confirmed", process: null, work: [...work], finish: [...finish], detail: unfinished.length ? `No unfinished process can satisfy Need ≤ Work. Unfinished: ${unfinished.map(i => model.processes[i]).join(", ")}.` : `All processes can finish. One valid safe sequence is ${sequence.map(i => model.processes[i]).join(" → ")}.` });
  return { safe: unfinished.length === 0, sequence: sequence.map(i => model.processes[i]), sequenceIndexes: sequence, unfinished: unfinished.map(i => model.processes[i]), need, work, steps };
}

export function checkRequest(model, processIndex, request) {
  if (!Array.isArray(request) || !Number.isInteger(processIndex) || processIndex < 0 || processIndex >= model.processes.length) return { granted: false, stage: "input", title: "Choose a valid process", detail: "Select a process row before submitting a request." };
  if (request.length !== model.resources.length || request.some(v => !Number.isSafeInteger(v) || v < 0)) return { granted: false, stage: "input", title: "Invalid request vector", detail: "Every request entry must be a non-negative integer matching the resource count." };
  const errors = validate(model);
  if (errors.length) return { granted: false, stage: "invalid-model", title: "Fix the model first", detail: errors.join(" ") };
  const p = model.processes[processIndex];
  const need = needMatrix(model)[processIndex];
  const tooMuchNeed = request.findIndex((v, j) => v > need[j]);
  if (tooMuchNeed >= 0) return { granted: false, stage: "need", title: "Request rejected: exceeds Need", detail: `${p} requested ${vector(request)}, but remaining Need is ${vector(need)}. A process cannot request more than its declared maximum claim.` };
  const tooMuchAvailable = request.findIndex((v, j) => v > model.available[j]);
  if (tooMuchAvailable >= 0) return { granted: false, stage: "available", title: "Request must wait", detail: `${p} requested ${vector(request)}, but Available is ${vector(model.available)}. At least one resource is not currently available; the request is not granted.` };
  const tentative = copy(model);
  tentative.available = tentative.available.map((v, j) => v - request[j]);
  tentative.allocation[processIndex] = tentative.allocation[processIndex].map((v, j) => v + request[j]);
  const safety = safetyTrace(tentative);
  if (!safety.safe) return { granted: false, stage: "unsafe", title: "Request denied: tentative state is unsafe", detail: `The request passes Request ≤ Need and Request ≤ Available, but after tentative allocation no safe sequence exists. Unfinished: ${safety.unfinished.join(", ")}. The original state has been preserved.`, tentative, safety };
  return { granted: true, stage: "granted", title: "Request can be granted safely", detail: `All checks passed. The tentative state is safe with sequence ${safety.sequence.join(" → ")}.`, tentative, safety };
}
