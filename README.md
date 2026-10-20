# DAGLock — Deadlock Detection & Recovery Laboratory

DAGLock is a local educational Operating Systems simulator built with React, Vite, Node.js and Express. It lets students construct resource-allocation models, inspect graph relationships, run deadlock detection and Banker’s safety independently, step through algorithms, compare recovery strategies, diagnose deadlocks, run lecture-style Banker’s Algorithm questions, simulate resource requests, and export experiment reports.

## Requirements
- Node.js 18 or newer (Node 20+ recommended)
- npm
- A modern desktop browser

## Run locally
Open the extracted project folder in VS Code. In a terminal at the project root:

```powershell
npm install
npm run install-all
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:5000`.

To run all backend and Banker’s Lab algorithm tests:

```powershell
npm test
```

Or run the suites directly:

```powershell
npm run test:server
npm run test:banker --prefix client
```

The combined `npm test` command runs both the 16 backend tests and the Banker’s Lab algorithm regression tests.

To build the frontend for production:

```powershell
npm run build
```

## The ten major capabilities

1. **Independent algorithm comparison.** Deadlock detection uses `Available`, `Allocation`, and current `Request`. Banker’s safety uses `Need = Max − Allocation`. When both results are available, DAGLock explains why their conclusions differ.
2. **Interactive Resource Allocation Graph.** Click or keyboard-select process/resource nodes to inspect allocations, requests, Need, availability, holders and status. Edges are labeled with instance counts. For multiple-instance resource types, a cycle alone is not sufficient proof of deadlock; matrix-based detection is the authoritative result in this simulator.
3. **Algorithm Studio.** Play, pause, restart, step forward/backward or run to the end. Inspect each Work and Finish vector, process evaluation, and the Request/Need row used by that step.
4. **Recovery strategy comparison.** Simulate terminating each active process independently and compare deadlock-detection and Banker’s-safety outcomes before applying a choice. Ranking is a transparent heuristic: clear detection, safe Banker’s result, then fewer currently held instances released. It is not a universally optimal policy.
5. **Scenarios and automated tests.** Includes circular wait, no deadlock, safe state, unsafe-but-not-currently-deadlocked state, multiple instances and a multi-instance deadlock. The UI test suite checks each preset plus recovery resource conservation and invalid-model rejection. Backend unit tests cover algorithm and validation edge cases.
6. **Distinct visual system.** Graphite and moss surfaces, mint allocation edges, copper request edges, readable status colors, node-selection highlighting, animated transitions, responsive layouts and reduced-motion support.
7. **Diagnosis Desk.** A rule-based, evidence-linked assistant reports unfinished processes, requests that exceed Available, resource holders and a suggested recovery victim. The suggested victim is explicitly described as a heuristic, not an AI claim or guaranteed optimum.
8. **Experiment reports.** Export a JSON report with matrices, algorithm results, trace, comparisons, recovery information and test results. Export a print-ready HTML report and use the browser’s Print → Save as PDF option.
9. **Guided demonstration.** A dismissible walkthrough loads a circular-wait case, runs detection and Banker’s safety, visits diagnosis and opens Recovery Lab. It is optional and does not replace the interactive workspace.
10. **Banker’s Algorithm Lab.** A separate learning workspace includes the lecture Example 1 preset, a literal transcription of Example 2, editable process/resource labels, editable Allocation/Maximum/Available matrices, automatic Need calculation, safe-sequence trace playback, resource-request validation, tentative allocation, and explicit apply-after-safe-grant behavior. It includes regression checks for safe/unsafe request outcomes and malformed input.

## Model editor
- Add or remove processes (maximum 8) and resource types (maximum 6).
- Edit Allocation, current Request, Maximum Claim and Available values.
- Matrix cells support multi-digit editing; commit on blur or Enter, cancel with Escape.
- Structural edits clear stale algorithm and recovery results.
- Removing a process releases its allocated instances to Available and removes its rows from all matrices.
- A resource type cannot be removed while any process holds its instances. Release the allocations first.
- The model must retain at least one process and one resource type.

## Model invariants and validation
- Matrix dimensions match the number of processes and resource types.
- Values are non-negative safe integers.
- `Max[i][j] >= Allocation[i][j]` and `Max[i][j] <= Total[j]`.
- For active processes, `Request[i][j] <= Max[i][j] − Allocation[i][j]`.
- For each resource type `j`, `Total[j] = Available[j] + Σ Allocation[i][j]`.
- A terminated process in the simulated recovery model has zero Allocation, Request and Maximum Claim. It is excluded from subsequent completion sequences.
- Validation is enforced in both client and server code; server-side validation is authoritative.

## Banker’s Algorithm Lab note
The supplied lecture Example 2 image appears internally inconsistent: process P3 has Allocation for resource D = 2 while its displayed Maximum for D = 1. The lab deliberately loads the slide transcription and flags `Max < Allocation` instead of silently changing faculty-provided data. Confirm the value with faculty or the original slide, edit the Maximum cell, and then run the safety/request checks. The regression tests verify this warning.

## Academic distinction
An **unsafe** state is not necessarily currently deadlocked. Detection evaluates outstanding current requests; Banker’s safety checks whether a completion sequence exists under the declared maximum claims. The two results are shown independently and compared only when both have been run.

## Scope and limitations
- This is a local educational simulation, not a production OS resource manager.
- Recovery updates only the model in the browser/API. It does not terminate real Windows or Linux processes.
- Diagnosis is deterministic and rule-based; no external generative AI service is used.
- Custom scenarios are held in page memory for the current session. They are not persisted to a database.
- The victim ranking is a teaching heuristic, not a proof of globally minimal recovery cost.

## Project documents
- `docs/ARCHITECTURE_AND_ALGORITHMS.md` — architecture, algorithms and model invariants.
- `docs/REVIEW_1_DEMO_AND_VIVA.md` — demo sequence and viva preparation.
- `docs/STRICT_AUDIT.md` — verification results, source-review notes and manual smoke-test checklist.
- `docs/BANKERS_ALGORITHM_LAB.md` — how to use the new Banker’s Algorithm Lab, lecture values, request workflow and the Example 2 source-data warning.


### v3.2.0 status + graph motion patch

Deadlock outcomes now have explicit semantic colors: danger/deadlock = red, unsafe/validation = amber, success = green, and neutral progress = blue. Request edges use a moving dashed stroke and a travelling particle; reduced-motion preferences disable these animations. Regression tests cover the notification classification. See `docs/STRICT_AUDIT.md`.

## Banker’s Lab → Resource Allocation Graph

The Banker’s Algorithm Lab now includes an **Outstanding Request (RAG projection)** matrix. This matrix represents current requests for the graph and is intentionally separate from the one-off request vector used by the resource-request algorithm. After editing Allocation, Maximum Claim, Available, and the projection request matrix, choose **Visualize in Resource Graph**. DAGLock loads a copy into the main workspace so the graph, matrices, and analysis controls all describe the same projected model. A visible projection banner explains the mode, and **Restore previous main model** returns to the saved workspace model. Algorithm results are cleared on each switch to avoid showing stale results for a different model.

The projection is only enabled when the Banker’s model is valid, including non-negative integer values, consistent dimensions, `Max ≥ Allocation`, and each current request being no greater than remaining Need. Banker’s safety still uses `Need = Max − Allocation`; deadlock detection still uses the current outstanding-request matrix. These are separate analyses.
