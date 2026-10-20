import React, { useMemo, useState } from "react";
import { validate, needMatrix, safetyTrace, checkRequest } from "./bankerAlgorithms.js";

const EXAMPLE_1 = {
  id: "example1",
  title: "Lecture Example 1 · Safe sequence",
  processes: ["P0", "P1", "P2", "P3", "P4"],
  resources: ["A", "B", "C", "D"],
  allocation: [[0,0,1,2],[1,0,0,0],[1,3,5,4],[0,6,3,2],[0,0,1,4]],
  outstandingRequest: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
  max: [[0,0,1,2],[1,7,5,0],[2,3,5,6],[0,6,5,2],[0,6,5,6]],
  available: [1,5,2,0],
  note: "Transcribed from the lecture slide. This example is internally consistent and can be evaluated directly."
};
const EXAMPLE_2 = {
  id: "example2",
  title: "Lecture Example 2 · Request decisions",
  processes: ["P0", "P1", "P2", "P3", "P4"],
  resources: ["A", "B", "C", "D"],
  allocation: [[2,0,0,1],[3,1,2,1],[2,1,0,3],[1,3,1,2],[1,4,3,2]],
  outstandingRequest: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
  max: [[4,2,1,2],[5,2,5,2],[2,3,1,6],[1,4,2,1],[3,6,6,5]],
  available: [3,3,2,1],
  note: "Exact transcription of the supplied slide. Check the validation warning: P3's listed maximum for D is 1 while its allocation is 2. Banker’s Algorithm requires Max ≥ Allocation, so confirm this cell with your faculty or correct it from the original source before solving this example."
};
const copy = value => JSON.parse(JSON.stringify(value));
const sumColumn = (matrix, j) => matrix.reduce((sum, row) => sum + row[j], 0);
const vector = values => `(${values.join(", ")})`;

function NumberCell({ value, label, onChange, disabled = false }) {
  const [draft, setDraft] = useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft.trim() === "") { setDraft(String(value)); return; }
    const parsed = Number(draft);
    if (!Number.isSafeInteger(parsed) || parsed < 0) { setDraft(String(value)); return; }
    if (parsed !== value) onChange(parsed);
  };
  return <input aria-label={label} type="number" min="0" step="1" inputMode="numeric" value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setDraft(String(value)); }} />;
}

function EditableMatrix({ title, rows, processes, resources, onChange, disabled = false }) {
  return <div className="banker-matrix-card"><h3>{title}</h3><div className="banker-table-scroll"><table><thead><tr><th>Process</th>{resources.map(r => <th key={r}>{r}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={processes[i]}><th>{processes[i]}</th>{row.map((value, j) => <td key={resources[j]}><NumberCell value={value} label={`${title} ${processes[i]} ${resources[j]}`} disabled={disabled} onChange={v => onChange(i, j, v)} /></td>)}</tr>)}</tbody></table></div></div>;
}

export default function BankerLab({ onVisualizeModel }) {
  const [model, setModel] = useState(() => copy(EXAMPLE_1));
  const [preset, setPreset] = useState("example1");
  const [selectedProcess, setSelectedProcess] = useState(1);
  const [request, setRequest] = useState([0,0,0,0]);
  const [requestResult, setRequestResult] = useState(null);
  const [trace, setTrace] = useState(null);
  const [traceIndex, setTraceIndex] = useState(0);
  const [testReport, setTestReport] = useState(null);
  const [notice, setNotice] = useState("");
  const errors = useMemo(() => validate(model), [model]);
  const need = useMemo(() => model.max.map((row, i) => row.map((v, j) => v - model.allocation[i][j])), [model]);
  const totals = useMemo(() => model.resources.map((_, j) => model.available[j] + sumColumn(model.allocation, j)), [model]);
  const result = useMemo(() => errors.length ? null : safetyTrace(model), [model, errors.length]);
  const currentStep = trace?.steps?.[traceIndex] || null;

  function loadPreset(id) {
    const next = id === "example2" ? EXAMPLE_2 : EXAMPLE_1;
    setModel(copy(next)); setPreset(id); setSelectedProcess(1); setRequest(next.resources.map(() => 0)); setRequestResult(null); setTrace(null); setTraceIndex(0); setTestReport(null); setNotice(`Loaded ${next.title}.`);
  }
  function editMatrix(key, i, j, raw) {
    const value = Number(raw);
    setModel(prev => {
      const next = copy(prev); next[key][i][j] = Number.isSafeInteger(value) && value >= 0 ? value : 0;
      return next;
    });
    setPreset("custom"); setRequestResult(null); setTrace(null); setTestReport(null);
  }
  function editAvailable(j, raw) {
    const value = Number(raw);
    setModel(prev => { const next = copy(prev); next.available[j] = Number.isSafeInteger(value) && value >= 0 ? value : 0; return next; });
    setPreset("custom"); setRequestResult(null); setTrace(null); setTestReport(null);
  }
  function renameEntity(kind, i, name) {
    setModel(prev => { const next = copy(prev); const key = kind === "process" ? "processes" : "resources"; next[key][i] = name; return next; });
    setPreset("custom"); setRequestResult(null); setTrace(null);
  }
  function addProcess() {
    if (model.processes.length >= 8) return;
    let i = model.processes.length; let name = `P${i}`; while (model.processes.includes(name)) name = `P${i++ + 1}`;
    setModel(prev => ({ ...copy(prev), processes: [...prev.processes, name], allocation: [...prev.allocation, prev.resources.map(() => 0)], outstandingRequest: [...(prev.outstandingRequest || prev.processes.map(() => prev.resources.map(() => 0))), prev.resources.map(() => 0)], max: [...prev.max, prev.resources.map(() => 0)] }));
    setPreset("custom"); setRequestResult(null); setTrace(null);
  }
  function removeProcess(i) {
    if (model.processes.length <= 1) return;
    setModel(prev => {
      const next = copy(prev);
      next.available = next.available.map((value, j) => value + next.allocation[i][j]);
      next.processes.splice(i,1); next.allocation.splice(i,1); next.outstandingRequest?.splice(i,1); next.max.splice(i,1);
      return next;
    });
    setSelectedProcess(0); setPreset("custom"); setRequestResult(null); setTrace(null); setTestReport(null);
  }
  function addResource() {
    if (model.resources.length >= 6) return;
    let i = model.resources.length; let name = String.fromCharCode(65 + i); while (model.resources.includes(name)) name = `R${i++ + 1}`;
    setModel(prev => ({ ...copy(prev), resources: [...prev.resources, name], available: [...prev.available, 0], allocation: prev.allocation.map(row => [...row, 0]), outstandingRequest: (prev.outstandingRequest || prev.processes.map(() => prev.resources.map(() => 0))).map(row => [...row, 0]), max: prev.max.map(row => [...row, 0]) }));
    setRequest(prev => [...prev, 0]); setPreset("custom"); setRequestResult(null); setTrace(null);
  }
  function canRemoveResource(j) {
    return model.resources.length > 1 && model.available[j] === 0 && model.allocation.every(row => row[j] === 0) && (model.outstandingRequest || []).every(row => row[j] === 0) && model.max.every(row => row[j] === 0);
  }
  function removeResource(j) {
    if (!canRemoveResource(j)) return;
    setModel(prev => { const next = copy(prev); next.resources.splice(j,1); next.available.splice(j,1); next.allocation.forEach(row => row.splice(j,1)); next.outstandingRequest?.forEach(row => row.splice(j,1)); next.max.forEach(row => row.splice(j,1)); return next; });
    setRequest(prev => prev.filter((_, i) => i !== j)); setPreset("custom"); setRequestResult(null); setTrace(null); setTestReport(null);
  }
  function runSafety() {
    if (errors.length) { setNotice("Fix the model validation errors before running Banker’s Algorithm."); return; }
    const next = safetyTrace(model); setTrace(next); setTraceIndex(0); setNotice(next.safe ? `Safe state confirmed. One sequence: ${next.sequence.join(" → ")}.` : `Unsafe state. Unable to finish: ${next.unfinished.join(", ")}.`);
  }
  function submitRequest() {
    if (errors.length) { setRequestResult({ granted: false, stage: "invalid-model", title: "Fix the model first", detail: "The request cannot be evaluated while the system model is invalid." }); return; }
    const outcome = checkRequest(model, selectedProcess, request);
    setRequestResult(outcome);
    if (outcome.granted) setNotice("Request evaluated as safe. It has not been applied to the live model; choose Apply granted request to commit it.");
  }
  function applyRequest() {
    if (!requestResult?.granted || !requestResult.tentative) return;
    setModel(copy(requestResult.tentative)); setPreset("custom"); setRequest(model.resources.map(() => 0)); setRequestResult(null); setTrace(null); setTestReport(null); setNotice("Granted request applied to the Banker’s Lab model. The request vector was cleared; run the safety check again to inspect the updated state.");
  }
  function runTests() {
    const valid = copy(EXAMPLE_1);
    const safe = safetyTrace(valid);
    const safeRequest = checkRequest(valid, 1, [0,0,1,0]);
    const needReject = checkRequest(valid, 1, [0,8,0,0]);
    const availableReject = checkRequest(valid, 1, [0,6,0,0]);
    const invalidSlide = validate(copy(EXAMPLE_2));
    const cases = [
      { name: "Lecture Example 1 validates", pass: validate(valid).length === 0, expected: "No validation errors", actual: validate(valid).join(" ") || "Valid" },
      { name: "Need matrix is Max − Allocation", pass: JSON.stringify(safe.need) === JSON.stringify([[0,0,0,0],[0,7,5,0],[1,0,0,2],[0,0,2,0],[0,6,4,2]]), expected: "Expected Need values", actual: JSON.stringify(safe.need) },
      { name: "Lecture Example 1 is safe", pass: safe.safe && safe.sequence[0] === "P0" && safe.sequence.length === 5, expected: "All 5 processes finish", actual: safe.sequence.join(" → ") },
      { name: "Safe request is approved tentatively", pass: safeRequest.granted === true, expected: "Granted if resulting state remains safe", actual: safeRequest.title },
      { name: "Request above Need is rejected", pass: needReject.stage === "need", expected: "Request rejected at Need check", actual: needReject.title },
      { name: "Request above Available waits", pass: availableReject.stage === "available", expected: "Request waits at Available check", actual: availableReject.title },
      { name: "Lecture Example 2 inconsistency is detected", pass: invalidSlide.some(issue => issue.includes("P3") && issue.includes("D") && issue.includes("less than Allocation")), expected: "Warn that slide P3 Max D < Allocation D", actual: invalidSlide.find(issue => issue.includes("P3") && issue.includes("D")) || "No warning" }
    ];
    setTestReport({ passed: cases.filter(c => c.pass).length, failed: cases.filter(c => !c.pass).length, cases });
  }

  return <section className="panel banker-lab" id="banker-lab">
    <div className="panel-head"><div><div className="eyebrow">DEADLOCK AVOIDANCE · INTERACTIVE LAB</div><h2>Banker’s Algorithm Lab</h2><p>Work through lecture questions, calculate Need, step through a safe sequence, and preview this model in the Resource Allocation Graph when you choose.</p></div><span className="pill">Isolated until visualized</span></div>
    <div className="banker-intro"><div className="banker-intro-mark">B</div><div><strong>Maximum claim · Current allocation · Available resources</strong><p>Need is computed automatically. The RAG request matrix below is separate from the one-off request test; visualization loads a copy into the main workspace and keeps a restore point.</p></div></div>

    <div className="banker-toolbar"><label>Lecture preset<select value={preset === "custom" ? "custom" : preset} onChange={e => e.target.value !== "custom" && loadPreset(e.target.value)}><option value="example1">Example 1 — Safe sequence</option><option value="example2">Example 2 — Resource requests (slide transcription)</option><option value="custom" disabled>Custom model</option></select></label><button className="secondary" onClick={() => loadPreset(preset === "example2" ? "example2" : "example1")}>Reset preset</button><button className="primary" onClick={runSafety} disabled={errors.length > 0}>Check safe state ↗</button></div>
    {notice && <div className="banker-notice" role="status" aria-live="polite"><span>i</span><p>{notice}</p><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
    {errors.length > 0 && <div className="banker-validation" role="alert"><strong>Model validation — {errors.length} issue{errors.length === 1 ? "" : "s"}</strong><p>Banker’s Algorithm is disabled until the model is internally consistent.</p><ul>{errors.map((e, i) => <li key={`${e}-${i}`}>{e}</li>)}</ul>{preset === "example2" && <p className="banker-validation-tip">This is a data inconsistency in the slide transcription, not an algorithm result. Confirm the P3 / D Maximum value from the original lecture material before proceeding.</p>}</div>}

    <div className="banker-entity-editors">
      <div className="banker-editor-group"><div className="banker-editor-head"><div><h3>Processes</h3><small>Rename or remove rows</small></div><button className="secondary" onClick={addProcess} disabled={model.processes.length >= 8}>＋ Add process</button></div><div className="banker-entity-list">{model.processes.map((p, i) => <div className="banker-entity-row" key={`p-${i}`}><input aria-label={`Process label ${i+1}`} value={p} onChange={e => renameEntity("process", i, e.target.value)} maxLength={12}/><button className="banker-remove" onClick={() => removeProcess(i)} disabled={model.processes.length <= 1} aria-label={`Remove process ${p}`}>Remove</button></div>)}</div></div>
      <div className="banker-editor-group"><div className="banker-editor-head"><div><h3>Resource types</h3><small>Rename or remove columns</small></div><button className="secondary" onClick={addResource} disabled={model.resources.length >= 6}>＋ Add resource</button></div><div className="banker-entity-list">{model.resources.map((r, i) => <div className="banker-entity-row" key={`r-${i}`}><input aria-label={`Resource label ${i+1}`} value={r} onChange={e => renameEntity("resource", i, e.target.value)} maxLength={12}/><button className="banker-remove" onClick={() => removeResource(i)} disabled={!canRemoveResource(i)} title={canRemoveResource(i) ? "Remove empty resource type" : "Set Available, Allocation, and Maximum Claim values in this column to zero first"} aria-label={`Remove resource ${r}`}>Remove</button></div>)}</div></div>
    </div>

    <div className="banker-matrix-grid">
      <EditableMatrix title="Allocation" rows={model.allocation} processes={model.processes} resources={model.resources} onChange={(i,j,v) => editMatrix("allocation",i,j,v)} />
      <EditableMatrix title="Outstanding Request (RAG projection)" rows={model.outstandingRequest || model.processes.map(() => model.resources.map(() => 0))} processes={model.processes} resources={model.resources} onChange={(i,j,v) => editMatrix("outstandingRequest",i,j,v)} />
      <EditableMatrix title="Maximum Claim" rows={model.max} processes={model.processes} resources={model.resources} onChange={(i,j,v) => editMatrix("max",i,j,v)} />
      <div className="banker-matrix-card"><h3>Available</h3><div className="banker-table-scroll"><table><thead><tr>{model.resources.map(r => <th key={r}>{r}</th>)}</tr></thead><tbody><tr>{model.available.map((v,j)=><td key={model.resources[j]}><NumberCell value={v} label={`Available ${model.resources[j]}`} onChange={raw=>editAvailable(j,raw)} /></td>)}</tr></tbody></table></div><div className="banker-total-row"><strong>Total instances</strong>{totals.map((v,j)=><span key={model.resources[j]}>{model.resources[j]} <b>{v}</b></span>)}</div></div>
      <EditableMatrix title="Need = Max − Allocation" rows={need} processes={model.processes} resources={model.resources} onChange={() => {}} disabled />
    </div>

    <div className="banker-visualize-panel"><div><strong>See this scenario in the Resource Allocation Graph</strong><p>Projects process names, resource types, Allocation, Available, and the separate outstanding-request matrix. This does not confuse Banker’s Need checks with current deadlock detection.</p></div><button className="primary" onClick={() => onVisualizeModel?.({ ...copy(model), outstandingRequest: copy(model.outstandingRequest || model.processes.map(() => model.resources.map(() => 0))) })} disabled={errors.length > 0}>Visualize in Resource Graph ↗</button></div>

    <div className="banker-results-row"><div className={`banker-result-banner ${result?.safe ? "safe" : result ? "unsafe" : "invalid"}`}><span>{result?.safe ? "✓" : result ? "!" : "…"}</span><div><strong>{result ? (result.safe ? "Live result · Safe state" : "Live result · Unsafe state") : errors.length ? "Fix validation errors" : "Safety result unavailable"}</strong><p>{result ? result.safe ? `One safe sequence: ${result.sequence.join(" → ")}` : `Unable to finish: ${result.unfinished.join(", ")}` : "Correct the model to calculate a safe sequence."}</p></div></div><button className="secondary" onClick={runSafety} disabled={errors.length > 0}>Generate step trace</button></div>

    <div className="banker-trace-panel"><div className="banker-subhead"><div><div className="eyebrow">STEP-BY-STEP EXPLAINABILITY</div><h3>Safety algorithm trace</h3><p>Inspect Work, Finish, Need comparisons, and each resource release.</p></div>{trace && <span className="pill">Step {traceIndex + 1} / {trace.steps.length}</span>}</div>
      {!trace ? <div className="banker-empty">Run the safety check to generate an explainable trace.</div> : <><div className="banker-trace-progress"><span style={{ width: `${((traceIndex + 1) / trace.steps.length) * 100}%` }}/></div><div className="banker-trace-current"><small>CURRENT STEP {String(traceIndex + 1).padStart(2,"0")}</small><h4>{currentStep?.title}</h4><p>{currentStep?.detail}</p><div className="banker-vector-pair"><span><small>Work</small><b>{vector(currentStep?.work || [])}</b></span><span><small>Finish</small><b>[{(currentStep?.finish || []).map(v => v ? "T" : "F").join(", ")}]</b></span></div></div><div className="banker-trace-actions"><button className="secondary" onClick={() => setTraceIndex(0)} disabled={traceIndex === 0}>↺ Restart</button><button className="secondary" onClick={() => setTraceIndex(v => Math.max(0,v-1))} disabled={traceIndex === 0}>← Previous</button><button className="primary" onClick={() => setTraceIndex(v => Math.min(trace.steps.length-1,v+1))} disabled={traceIndex >= trace.steps.length-1}>Next step →</button><button className="secondary" onClick={() => setTraceIndex(trace.steps.length-1)} disabled={traceIndex >= trace.steps.length-1}>Run to end</button></div><div className="banker-finish-grid">{model.processes.map((p,i)=><div key={p} className={currentStep?.finish?.[i] ? "finished" : currentStep?.process === i ? "checking" : "pending"}><b>{p}</b><span>{currentStep?.finish?.[i] ? "Finished" : currentStep?.process === i ? "Being checked" : "Waiting"}</span><small>Need {vector(need[i])}</small></div>)}</div></>}
    </div>

    <div className="banker-request-panel"><div className="banker-subhead"><div><div className="eyebrow">RESOURCE-REQUEST ALGORITHM</div><h3>Can this request be granted?</h3><p>Each request is evaluated independently against the current model. No state changes until you apply a safe grant.</p></div><span className="pill">Tentative allocation</span></div>
      <div className="banker-request-controls"><label>Process<select value={selectedProcess} onChange={e => {setSelectedProcess(Number(e.target.value));setRequestResult(null);}}>{model.processes.map((p,i)=><option value={i} key={`${p}-${i}`}>{p}</option>)}</select></label>{model.resources.map((r,j)=><label key={r}>{r} requested<NumberCell value={request[j] ?? 0} label={`${r} requested`} onChange={raw => {const v=Number(raw);setRequest(prev=>model.resources.map((_,k)=>k===j?(Number.isSafeInteger(v)&&v>=0?v:0):(prev[k]??0)));setRequestResult(null);}} /></label>)}<button className="primary" onClick={submitRequest} disabled={errors.length > 0}>Evaluate request ↗</button></div>
      {requestResult && <div className={`banker-request-result ${requestResult.granted ? "safe" : "rejected"}`} role="status" aria-live="polite"><div className="banker-request-result-head"><strong>{requestResult.title}</strong><span>{requestResult.granted ? "SAFE GRANT" : "NOT GRANTED"}</span></div><p>{requestResult.detail}</p>{requestResult.safety && <div className="banker-request-sequence"><small>Safe sequence after tentative grant</small><b>{requestResult.safety.sequence.join(" → ") || "No sequence"}</b></div>}{requestResult.granted && <button className="primary" onClick={applyRequest}>Apply granted request to this lab model</button>}</div>}
    </div>

    <div className="banker-tests-panel"><div className="banker-subhead"><div><div className="eyebrow">REGRESSION CHECKS</div><h3>Banker’s Lab self-tests</h3><p>Checks the example data, Need calculation, safe sequence, request bounds, and lecture-slide inconsistency detection.</p></div><button className="secondary" onClick={runTests}>▶ Run lab tests</button></div>{testReport && <><div className="banker-test-summary"><strong>{testReport.passed} passed</strong><strong className={testReport.failed ? "failed" : "passed"}>{testReport.failed} failed</strong></div><div className="banker-test-list">{testReport.cases.map((test,i)=><div key={test.name} className="banker-test-row"><span className={test.pass ? "pass" : "fail"}>{test.pass ? "PASS" : "FAIL"}</span><div><b>{test.name}</b><small>Expected: {test.expected}</small><small>Actual: {test.actual}</small></div></div>)}</div></>}</div>
    <p className="banker-disclaimer">Educational simulation only. Banker’s Algorithm is deadlock avoidance; the main DAGLock detection and recovery tools remain separate. A safe sequence may not be unique.</p>
  </section>;
}
