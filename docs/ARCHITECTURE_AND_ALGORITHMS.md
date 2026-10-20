# DAGLock Architecture and OS Concepts

## Overview
DAGLock is an educational web application for exploring resource allocation, matrix-based deadlock detection, Banker’s safety analysis, explainable diagnosis and simulated process-termination recovery.

## Technology architecture
- **React + Vite:** responsive workspace, editable matrices, SVG graph, scenario library, algorithm playback, diagnosis, recovery comparison and report export.
- **Node.js + Express:** REST API for health, validation, deadlock detection, Banker’s safety, recovery and recovery-candidate comparison.
- **Node built-in test runner:** deterministic tests for algorithms, validation and recovery invariants.
- **SVG:** scalable, keyboard-selectable Resource Allocation Graph and application favicon.

## Request flow
1. A user edits a model or loads a preset scenario.
2. Client validation catches dimensions, integer, claim, request and resource-conservation errors.
3. The client sends a model to Express.
4. Express validates the payload before invoking the selected algorithm.
5. The API returns structured results; the client shows status, sequences, unfinished processes and a reproducible playback trace.
6. Recovery comparison evaluates each active victim in an isolated candidate state. It does not mutate the live state.
7. Applying a recovery marks the chosen process terminated in the simulation, releases its allocations and clears its pending request and claim.

## Deadlock detection algorithm
Inputs: `Available`, `Allocation`, `Request`, and process names for recognizing terminated simulation rows.
- Initialize `Work = Available`.
- Set `Finish[i] = true` when the process holds no resources; terminated simulation rows are also excluded.
- Find an unfinished process whose `Request[i] <= Work`.
- Mark it finished and add its allocated instances to Work.
- Repeat while progress is possible.
- Remaining unfinished processes are reported as deadlock candidates under this detection model. For multi-instance resource types, the graph’s visual cycles are not used as a substitute for the matrix algorithm.

## Banker’s safety algorithm
Inputs: `Available`, `Allocation`, `Max`, and process names.
- Compute `Need = Max − Allocation`.
- Initialize `Work = Available`.
- Active processes begin unfinished; terminated simulation rows are excluded.
- Find an unfinished process whose `Need[i] <= Work[i]` for every resource type.
- Assume it completes and releases its allocation to Work.
- Repeat until all active processes finish or no process can proceed.
- All active processes finishing means safe; otherwise the state is unsafe.

## Why the results may differ
Detection checks current outstanding `Request`. Banker’s safety checks `Need = Max − Allocation`. A model can have no current deadlock while being unsafe under declared maximum claims. An unsafe state is not itself proof of a current deadlock.

## Validation invariants
- Process and resource names are non-empty and unique.
- Matrix dimensions match process/resource counts.
- Values are non-negative safe integers.
- `Max[i][j] >= Allocation[i][j]` and `Max[i][j] <= Total[j]`.
- For active processes, `Request[i][j] <= Max[i][j] − Allocation[i][j]`.
- For each resource type `j`, `Total[j] = Available[j] + Σ Allocation[i][j]`.
- Terminated simulation rows have zero Allocation, Request and Maximum Claim.
- At least one process and one resource type remain; the model limits are 8 processes and 6 resource types.

## Recovery and recovery-candidate comparison
Recovery is simulated only. The selected process’s held instances are added to Available, Allocation/Request/Max are zeroed for that process, and its name is marked terminated. The transition is validated before the server returns it. Recovery-candidate comparison creates isolated copies for each active process and returns detection and Banker’s safety outcomes for each candidate. The ranking prioritizes a clear detection result, then a safe state, then the smallest number of currently held instances released. This heuristic is transparent but not guaranteed to minimize total recovery cost.

## Diagnosis Desk
The Diagnosis Desk reads the detection result and submitted matrices. For each unfinished process, it checks which current requests exceed Available and lists processes holding instances of those resources. It recommends a victim using a simple allocation-cost heuristic. The explanation is evidence-linked and does not pretend to be a generative AI diagnosis.

## Scenario library and reports
Built-in cases cover circular wait, clear detection, a safe state, an unsafe state without current deadlock, a multi-instance case and a multi-instance deadlock. The automated UI suite checks expected outcomes, recovery conservation and rejection of invalid requests. JSON and print-ready HTML reports contain the model, results, trace, comparison, recovery and test summary.

## UI/UX principles
- Graphite/moss surfaces with mint allocation edges and copper request edges.
- Clickable and keyboard-focusable graph nodes with an inspector panel.
- Separate result panels for detection and Banker’s safety.
- Visible progress and operation feedback for recovery.
- Reduced-motion support, responsive layouts and explicit simulation-only language.

## Test commands
```powershell
npm test
npm run build
```

The unit tests use Node’s built-in test runner. Run the client build command after installing dependencies to verify the full Vite production build in the target environment.

## Banker’s Algorithm Lab (v3.1)

`client/src/BankerLab.jsx` implements an isolated educational workspace; `client/src/bankerAlgorithms.js` contains the pure Need, validation, safety-trace, and resource-request functions. The standalone tests in `client/src/bankerAlgorithms.test.js` run with Node’s built-in test runner and do not require a browser.

The request flow validates the model, checks `Request <= Need`, checks `Request <= Available`, creates a copy, tentatively subtracts the request from Available and adds it to the selected process Allocation, and runs the safety algorithm on the tentative state. A safe tentative result is returned to the UI but is not committed until the user explicitly applies it. The original model is never mutated by a denied request.

The lecture Example 2 is intentionally loaded as a literal transcription and flagged as invalid because the visible slide shows P3 Allocation(D)=2 but Max(D)=1. The implementation does not silently correct the supplied source.
