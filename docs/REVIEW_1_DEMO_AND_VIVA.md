# DAGLock Review 1 — Demo and Viva Guide

## Suggested 5-minute demonstration
1. Introduce DAGLock as a visual OS learning tool, not a real process manager.
2. Load **Circular wait** and run **Detect deadlock**.
3. Point out P1 holding R1 and requesting R2, while P2 holds R2 and requests R1.
4. Open Algorithm Studio. Step through Work and Finish and explain why neither process can proceed with Available = [0, 0].
5. Load **No deadlock** and run detection. Explain how a process that can finish releases resources and allows another to proceed.
6. Run **Banker's safety** separately. Show Need = Max − Allocation and explain why safe-state analysis is different from detection.
7. Open **Matrices & Model**, edit a value, and show validation if resource conservation is violated.
8. Run all automated tests and explain the expected-vs-actual results.
9. Use **Recovery Lab** to terminate a simulated process, then rerun detection.
10. Compare recovery candidates, apply a simulated recovery, and re-run both analyses.
11. Export JSON and print-ready HTML; the HTML report can be printed or saved as PDF.
12. Use Guided demo if you want a repeatable faculty walkthrough.

## Likely viva questions
### What is a deadlock?
A set of processes is deadlocked when each process in the set waits for an event/resource that can only be caused/released by another process in the same set, so progress cannot occur.

### What are the four necessary Coffman conditions?
Mutual exclusion, hold and wait, no preemption, and circular wait.

### What is a Resource Allocation Graph?
A directed graph with process nodes and resource-type nodes. A resource-to-process edge represents allocation; a process-to-resource edge represents a request.

### Does a cycle always mean deadlock?
For a single instance of each resource type, a cycle is sufficient for deadlock. With multiple instances, a cycle is necessary but not sufficient in the general case.

### Detection vs Banker's safety?
Detection checks outstanding current requests and reports unfinished processes. Banker's safety checks whether a safe sequence exists based on `Need = Max - Allocation`.

### Can an unsafe state be non-deadlocked?
Yes. Unsafe means there is no guaranteed safe sequence under declared maximum claims; it does not necessarily mean a deadlock is happening now.

### How does recovery work here?
The simulator terminates a selected process in the model and releases its allocated resources. It is not terminating a real OS process.

### What validation does the application perform?
Matrix dimensions, non-negative integer values, maximum claims not below allocations, and resource conservation: Total = Available + Allocated.

### What are the limitations?
The app is an educational simulator with a bounded number of process/resource types. It does not inspect or terminate actual OS processes. Custom scenarios are currently kept in browser memory for the active page session.

## Before presenting
- Start the server and client with `npm run dev`.
- Verify the API status says connected.
- Run `npm run test:server`.
- Check all six built-in scenarios, including the multi-instance deadlock case.
- Ensure detection and Banker's safety results are explained separately.
- Do not claim that a UI screenshot or demo proves correctness; point to the automated test output as well.


## Demonstrating the Diagnosis Desk
- Load the circular-wait scenario and run detection.
- Explain the blocked-process evidence shown for each process: requested resource, available count, and current holders.
- Discuss the suggested victim rule. It is a heuristic based on current allocation count, not a claim of global optimality.
- Apply suggested recovery and narrate the four stages: termination in the model, resource release, Available-vector update, and rerun detection.
- Compare the before/after graph and explain that the application does not terminate actual OS processes.


## Additional final-version demonstration points
- Click a process or resource in the graph (or keyboard-focus it and press Enter/Space) to open its inspector.
- Run both algorithms to reveal the explanation panel comparing their independent results.
- Use Compare candidates to inspect recovery outcomes without mutating the live model; apply only after explaining the heuristic.
- Matrix values commit on blur or Enter. Escape cancels an uncommitted edit.
- The UI test suite includes preset outcome checks, recovery conservation and invalid-request rejection.
