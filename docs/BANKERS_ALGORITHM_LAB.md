# Banker’s Algorithm Lab — User Guide

## What it does

The Banker’s Algorithm Lab is a separate workspace inside DAGLock. It does not modify the main deadlock detection/recovery model. It supports up to 8 processes and 6 resource types.

Features:
- Lecture Example 1 and Example 2 presets.
- Editable process/resource labels.
- Editable Allocation, Maximum Claim and Available values.
- Live `Need = Max − Allocation` calculation.
- Derived total resources: `Total[j] = Available[j] + sum(Allocation[i][j])`.
- Model validation for dimensions, non-negative integers, unique labels, `Max >= Allocation`, and maximum claims not exceeding system totals.
- Safe-sequence trace with Work and Finish snapshots, Need-vs-Work comparisons, and resource-release steps.
- Resource request evaluation in textbook order: `Request <= Need`, `Request <= Available`, tentative allocation, then safety check.
- A safe request is not applied until **Apply granted request to this lab model** is clicked.
- Request denial does not mutate the original model.
- Add/remove process and resource controls. Removing a process returns its allocated instances to Available. A resource type can only be removed after its Available, Allocation, and Maximum Claim column values have all been set to zero.
- A standalone regression suite (`npm run test:banker --prefix client`).

## Run a lecture question

1. Open **Banker’s Algorithm Lab** from the sidebar.
2. Choose a lecture preset.
3. Inspect Allocation, Maximum Claim, Available, and the derived Need matrix.
4. Correct any validation issues before solving. Do not ignore a `Max < Allocation` warning.
5. Click **Check safe state** to generate the result and trace.
6. Use Restart, Previous, Next step, and Run to end to present the algorithm.
7. For a resource-request question, choose the process, enter the request vector, and click **Evaluate request**.
8. Read the check result. If it is safe to grant, optionally click **Apply granted request** to commit the tentative allocation to this lab model. Each request evaluation starts from the current model state.

## Lecture Example 1

Processes: P0–P4. Resource types: A–D.

Available: `(1, 5, 2, 0)`.

One valid safe sequence is `P0 → P2 → P3 → P4 → P1`. Another order can also be valid; safe sequences are not necessarily unique.

Need matrix:

| Process | A | B | C | D |
|---|---:|---:|---:|---:|
| P0 | 0 | 0 | 0 | 0 |
| P1 | 0 | 7 | 5 | 0 |
| P2 | 1 | 0 | 0 | 2 |
| P3 | 0 | 0 | 2 | 0 |
| P4 | 0 | 6 | 4 | 2 |

## Lecture Example 2 — source-data warning

The supplied slide transcription gives P3 Allocation `(1, 3, 1, 2)` and P3 Maximum `(1, 4, 2, 1)`. This makes Maximum(D) = 1 smaller than Allocation(D) = 2. That violates the Banker’s Algorithm model invariant `Max >= Allocation`.

The app intentionally loads the displayed values and blocks the calculation with a validation message rather than silently changing the slide. Confirm the P3/D maximum value with faculty or the original lecture source. If the correct value is 2, edit that cell to 2 and re-run the analysis. This suggested value is a possible correction, not a claim that the screenshot itself says 2.

With that illustrative correction only, the lecture request vectors are:
- P1 request: `(1, 1, 0, 0)` — can be granted if the tentative safety check succeeds.
- P4 request: `(0, 0, 2, 0)` — fails the tentative safety check in this model and must not be granted immediately.

## Algorithm distinction

- **Deadlock detection** checks current outstanding requests and whether currently blocked processes can proceed.
- **Banker’s safety** checks `Need = Max − Allocation` and asks whether every active process can finish in some order.
- **Resource request** checks bounds, checks current availability, then tentatively allocates and runs the safety algorithm. It grants only if the tentative state is safe.

The lab is an educational simulation; it does not allocate or release real operating-system resources.

## Visualize a lab scenario in the RAG

1. Edit Allocation, Maximum Claim, and Available as usual.
2. Optionally enter current outstanding requests in **Outstanding Request (RAG projection)**. This is a matrix for the graph, not the single request vector in the resource-request exercise.
3. Fix all model validation issues; the visualization action stays disabled while the model is invalid.
4. Select **Visualize in Resource Graph**. DAGLock copies the lab model into the main workspace and clears previous algorithm results.
5. Inspect the graph and run deadlock detection and/or Banker’s safety again. The graph shows Allocation and current Request; Banker’s safety uses Need = Max − Allocation.
6. Select **Restore previous main model** in the graph banner to return to the prior workspace model. Results are cleared when switching models to prevent stale output.
