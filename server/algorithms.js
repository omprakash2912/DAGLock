const isTerminated = name => typeof name === "string" && /\(terminated\)$/i.test(name.trim());

export function detectDeadlock(available, allocation, request, processes = []) {
  const n = allocation.length;
  const m = available.length;
  const work = [...available];
  // The textbook detection algorithm initializes Finish[i] to true when
  // Allocation[i] is all zero. Terminated simulation rows are also excluded.
  const finish = allocation.map((row, i) => isTerminated(processes[i]) || row.every(v => v === 0));
  const sequence = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;
      if (request[i].every((need, j) => need <= work[j])) {
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        finish[i] = true;
        sequence.push(i);
        changed = true;
      }
    }
  }
  const deadlocked = finish.map((ok, i) => ok ? -1 : i).filter(i => i >= 0);
  return { deadlocked, sequence, safe: deadlocked.length === 0, work, finish };
}

export function bankersSafety(available, allocation, max, processes = []) {
  const n = allocation.length;
  const m = available.length;
  const need = allocation.map((row, i) => row.map((v, j) => max[i][j] - v));
  const work = [...available];
  const finish = Array.from({ length: n }, (_, i) => isTerminated(processes[i]));
  const sequence = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (!finish[i] && need[i].every((v, j) => v <= work[j])) {
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        finish[i] = true;
        sequence.push(i);
        changed = true;
      }
    }
  }
  return { safe: finish.every(Boolean), sequence, need, unfinished: finish.map((v, i) => v ? -1 : i).filter(i => i >= 0), work, finish };
}

export function validateState(state) {
  if (!state || typeof state !== "object") throw new Error("A model object is required.");
  const { processes, resources, available, total, allocation, request, max } = state;
  if (!Array.isArray(processes) || !Array.isArray(resources) || !Array.isArray(available) || !Array.isArray(total) ||
      !Array.isArray(allocation) || !Array.isArray(request) || !Array.isArray(max)) {
    throw new Error("State is missing required arrays.");
  }
  const n = processes.length, m = resources.length;
  if (n < 1 || m < 1) throw new Error("At least one process and one resource type are required.");
  if (n > 8 || m > 6) throw new Error("This simulator supports at most 8 processes and 6 resource types.");
  if (processes.some(p => typeof p !== "string" || !p.trim()) || new Set(processes).size !== n) {
    throw new Error("Process names must be non-empty and unique.");
  }
  if (resources.some(r => typeof r !== "string" || !r.trim()) || new Set(resources).size !== m) {
    throw new Error("Resource names must be non-empty and unique.");
  }
  if (available.length !== m || allocation.length !== n || request.length !== n || max.length !== n) {
    throw new Error("Matrix dimensions do not match process/resource counts.");
  }
  for (const [name, matrix] of [["Allocation", allocation], ["Request", request], ["Maximum claim", max]]) {
    if (matrix.some(row => !Array.isArray(row) || row.length !== m || row.some(v => !Number.isSafeInteger(v) || v < 0))) {
      throw new Error(`${name} matrix must contain non-negative integers with matching dimensions.`);
    }
  }
  if (available.some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error("Available values must be non-negative integers.");
  if (max.some((row, i) => row.some((v, j) => v < allocation[i][j]))) {
    throw new Error("Maximum claim cannot be smaller than current allocation.");
  }
  for (let i = 0; i < n; i++) {
    if (isTerminated(processes[i])) {
      if (allocation[i].some(v => v !== 0) || request[i].some(v => v !== 0) || max[i].some(v => v !== 0)) {
        throw new Error(`Terminated process ${processes[i]} must have zero Allocation, Request and Maximum Claim values.`);
      }
      continue;
    }
    for (let j = 0; j < m; j++) {
      if (request[i][j] > max[i][j] - allocation[i][j]) {
        throw new Error(`Request for ${processes[i]} exceeds its remaining Need for ${resources[j]} (Maximum − Allocation).`);
      }
    }
  }
  if (total.length !== m || total.some(v => !Number.isSafeInteger(v) || v < 0)) {
    throw new Error("Total vector must contain one non-negative integer per resource type.");
  }
  for (let j = 0; j < m; j++) {
    const allocated = allocation.reduce((sum, row) => sum + row[j], 0);
    if (total[j] !== available[j] + allocated) {
      throw new Error(`${resources[j]} conservation mismatch: Total ${total[j]} must equal Available ${available[j]} + Allocated ${allocated}.`);
    }
    if (max.some(row => row[j] > total[j])) {
      throw new Error(`Maximum claim for ${resources[j]} cannot exceed the system total of ${total[j]} instance(s).`);
    }
  }
  return true;
}

export function simulateRecovery(state, processIndex) {
  validateState(state);
  if (!Number.isInteger(processIndex) || processIndex < 0 || processIndex >= state.processes.length) {
    throw new Error("Choose a valid process to terminate.");
  }
  const name = state.processes[processIndex];
  if (isTerminated(name)) throw new Error(`${name} is already terminated in this simulation.`);
  const next = structuredClone(state);
  const released = [...next.allocation[processIndex]];
  next.available = next.available.map((v, j) => v + next.allocation[processIndex][j]);
  next.allocation[processIndex] = next.allocation[processIndex].map(() => 0);
  next.request[processIndex] = next.request[processIndex].map(() => 0);
  next.max[processIndex] = next.max[processIndex].map(() => 0);
  next.processes[processIndex] = `${name} (terminated)`;
  validateState(next);
  return { state: next, released, terminatedProcess: name, message: `${name} was terminated in the simulation. Released resources: [${released.join(", ")}].` };
}


export function compareRecoveryCandidates(state) {
  validateState(state);
  const options = [];
  for (let i = 0; i < state.processes.length; i++) {
    if (isTerminated(state.processes[i])) continue;
    const recovered = simulateRecovery(state, i);
    const detection = detectDeadlock(recovered.state.available, recovered.state.allocation, recovered.state.request, recovered.state.processes);
    const safety = bankersSafety(recovered.state.available, recovered.state.allocation, recovered.state.max, recovered.state.processes);
    const allocatedCost = recovered.released.reduce((sum, value) => sum + value, 0);
    options.push({
      process: recovered.terminatedProcess,
      processIndex: i,
      released: recovered.released,
      allocatedCost,
      state: recovered.state,
      detection: { safe: detection.safe, sequence: detection.sequence.map(index => recovered.state.processes[index]), deadlockedProcesses: detection.deadlocked.map(index => recovered.state.processes[index]) },
      safety: { safe: safety.safe, sequence: safety.sequence.map(index => recovered.state.processes[index]), unfinished: safety.unfinished.map(index => recovered.state.processes[index]) }
    });
  }
  options.sort((a, b) => Number(b.detection.safe) - Number(a.detection.safe) || Number(b.safety.safe) - Number(a.safety.safe) || a.allocatedCost - b.allocatedCost || a.processIndex - b.processIndex);
  return { options, note: "Ranked by detection outcome, Banker’s safety outcome, then number of currently held instances released. This is an educational heuristic, not a universal optimal recovery policy." };
}
