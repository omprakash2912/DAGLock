# DAGLock Strict OS Faculty & UI/UX Audit

## Scope of this audit
This review covers the algorithm source, server validation/recovery transitions, scenario expectations, JSX/CSS syntax, interaction state handling, accessibility affordances and project documentation. It does not claim that software can be guaranteed to contain zero bugs.

## OS faculty rubric

| Criterion | Result | Evidence |
|---|---|---|
| Deadlock detection | Pass | Work/Finish matrix algorithm, including zero-allocation initialization and terminated-row exclusion |
| Banker’s safety | Pass | Need = Max − Allocation; active-only completion sequence |
| Distinction between detection and safety | Pass | Independent results plus explicit comparison explanation |
| Resource conservation | Pass | Server validates Total = Available + Allocated; recovery tests check invariant |
| Multiple-instance reasoning | Pass | Multi-instance preset and a multi-instance deadlock preset; graph notes cycle caveat |
| Model validation | Pass | Dimensions, integer/nonnegative values, unique names, claim bounds, request bounds and conservation |
| Recovery correctness | Pass | Validates victim, rejects repeat termination, clears victim row, releases held instances, revalidates state |
| Recovery candidate comparison | Pass by implementation review | Candidate states are copied, evaluated independently and ranked by a documented heuristic |
| Reproducibility and tests | Pass | Preset expected outcomes plus recovery invariant and invalid-model rejection in UI test suite |
| Educational transparency | Pass | Diagnosis is explicitly rule-based; recovery is explicitly simulation-only |

## UI/UX rubric

| Criterion | Result | Evidence |
|---|---|---|
| Visual hierarchy and distinctive palette | Pass by source review | Graphite/moss palette, mint allocations, copper requests, restrained status colors |
| Graph readability | Pass by source review | Labels/counts, unique SVG definition IDs, adaptive graph height for up to 8 processes / 6 resource types |
| Graph interaction | Pass by source review | Click and keyboard selection, visible focus ring, node inspector and connected-edge highlighting |
| Algorithm explainability | Pass by source review | Step trace with Work/Finish, evaluation text and matrix highlighting |
| Recovery feedback | Pass by source review | Explicit operation stages, before/after graph and candidate comparison |
| Accessibility and motion | Pass by source review | Keyboard focus, aria labels/live status, reduced-motion CSS |
| Responsive layout | Pass by source review | Existing breakpoints plus responsive graph inspector, recovery cards and guided walkthrough |
| Export | Pass by source review | JSON report and printable HTML report suitable for browser Print → Save as PDF |
| Guided demonstration | Pass by source review | Optional five-stage faculty walkthrough |
| Error states | Pass by source review | Client/server validation, disabled conflicting actions and visible API errors |

## Verification performed in the build environment

- Backend unit tests: **16 passed, 0 failed** using `node --test`.
- Built-in scenario algorithm expectations: **6 of 6 passed** in direct Node checks (deadlock, clear, safe, unsafe, multiple instances, multi-instance deadlock).
- JSX transpilation/parser diagnostics: **0**.
- CSS parser: **passed**.
- Node syntax checks for server modules: **passed**.
- ZIP integrity: verified after packaging (see final build handoff).

## Environment limitation
A full Vite production build and browser-driven end-to-end test could not be run in this environment because npm registry access failed with `EAI_AGAIN` while trying to install dependencies. The project includes reproducible commands so the build and interaction smoke test can be run on the target computer after `npm install` and `npm run install-all`. Therefore this document does not falsely certify an end-to-end browser test that was not performed.

## Required local smoke test before faculty presentation

1. Run `npm install`, then `npm run install-all`, then `npm run dev`.
2. Confirm the API status changes to **API connected**.
3. Load Circular wait; run detection and confirm the two waiting processes are unfinished.
4. Run Banker’s safety independently; confirm the comparison panel explains the result distinction.
5. Use Algorithm Studio Next/Previous/Play/Restart and check Work/Finish vectors.
6. Click/keyboard-select process and resource nodes; confirm the inspector and connected-edge highlight update.
7. Load Multi-instance deadlock; confirm the matrix algorithm detects unfinished processes and the graph note warns that a cycle alone is not proof for multiple instances.
8. Edit a matrix value, try Request > remaining Need, and confirm algorithms are blocked until validation is fixed.
9. Add/delete a process; confirm rows and Available/Total remain consistent. Add/delete an unallocated resource; confirm columns disappear from all matrices.
10. Compare recovery candidates; verify comparison does not change the live model. Apply one candidate and confirm allocations return to Available.
11. Re-run detection and Banker’s safety after recovery; confirm terminated processes are excluded from sequences.
12. Run all UI tests; expect all scenario and invariant tests to pass.
13. Export JSON and HTML reports; open the HTML report and use Print → Save as PDF.
14. Run the guided demo from its first step and close it midway to ensure the workspace remains usable.

## Strict conclusion

- Backend algorithm tests: 16 passed.
- Banker’s Lab regression tests: 11 passed.
- JSX/JS syntax diagnostics: 0 for the checked React components.
- The lab explicitly blocks invalid lecture data and request decisions rather than silently changing values.
- A full Vite production build and browser end-to-end run remain unverified because npm dependency installation could not complete in this environment. No claim of absolute zero bugs or verified 10/10 release readiness should be made until the project is built and smoke-tested locally.


## v3.2.0 — status messaging and graph animation patch

- Centralized banner tone classification in `client/src/noticeTone.js`.
- “Deadlock remains” and “Deadlock detected” now use a high-contrast red danger banner; safe outcomes use green, unsafe/validation states use amber, and neutral progress uses blue.
- Danger and warning banners use `role=alert` with assertive live announcements.
- Resource-request edges retain their moving dashed-line animation even when they are highlighted as deadlocked/cyclic; a small animated particle travels from process to resource to clarify request direction.
- Respect `prefers-reduced-motion` by disabling moving particles and request-line motion.
- Added 8 notification-tone regression tests.

Verification for this patch: `npm test` passed 16 server tests and 19 client tests (35 total). The Vite production build could not run in this environment because frontend dependencies are not installed (`vite: not found`); run `npm install`, `npm run install-all`, `npm test`, and `npm run build` locally before final presentation.
