import express from "express";
import cors from "cors";
import { detectDeadlock, bankersSafety, validateState, simulateRecovery, compareRecoveryCandidates } from "./algorithms.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const sample = {
  processes: ["P1", "P2", "P3"], resources: ["R1", "R2"], total: [1, 1], available: [0, 0],
  allocation: [[1, 0], [0, 1], [0, 0]], request: [[0, 1], [1, 0], [0, 0]], max: [[1, 1], [1, 1], [1, 0]]
};

app.get("/api/health", (_req, res) => res.json({ status: "ok", name: "DAGLock API", version: "3.0.0" }));
app.get("/api/sample", (_req, res) => res.json(sample));

app.post("/api/validate", (req, res) => {
  try { validateState(req.body); res.json({ valid: true, errors: [] }); }
  catch (e) { res.status(400).json({ valid: false, errors: [e.message], error: e.message }); }
});

app.post("/api/detect", (req, res) => {
  try {
    validateState(req.body);
    const result = detectDeadlock(req.body.available, req.body.allocation, req.body.request, req.body.processes);
    res.json({ ...result, deadlockedProcesses: result.deadlocked.map(i => req.body.processes[i]), sequence: result.sequence.map(i => req.body.processes[i]) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/safety", (req, res) => {
  try {
    validateState(req.body);
    const result = bankersSafety(req.body.available, req.body.allocation, req.body.max, req.body.processes);
    res.json({ ...result, sequence: result.sequence.map(i => req.body.processes[i]), unfinished: result.unfinished.map(i => req.body.processes[i]) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/recover", (req, res) => {
  try {
    const result = simulateRecovery(req.body, req.body?.processIndex);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/recovery-options", (req, res) => {
  try { res.json(compareRecoveryCandidates(req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`DAGLock API running at http://localhost:${port}`));
