import React, { useEffect, useId, useMemo, useState } from "react";
import BankerLab from "./BankerLab.jsx";
import { getNoticeTone } from "./noticeTone.js";

const API = "http://localhost:5000/api";

const BUILTIN_CASES = [
  {
    id: "deadlock", title: "Circular wait", tag: "Deadlock", expectedDeadlock: true, expectedSafe: false,
    description: "P1 holds R1 and requests R2. P2 holds R2 and requests R1.",
    processes: ["P1", "P2", "P3"], resources: ["R1", "R2"], total: [1, 1], available: [0, 0],
    allocation: [[1, 0], [0, 1], [0, 0]], request: [[0, 1], [1, 0], [0, 0]], max: [[1, 1], [1, 1], [1, 0]]
  },
  {
    id: "clear", title: "No deadlock", tag: "Clear", expectedDeadlock: false, expectedSafe: true,
    description: "A process can finish and release a resource, allowing others to proceed.",
    processes: ["P1", "P2", "P3"], resources: ["R1", "R2"], total: [2, 1], available: [1, 0],
    allocation: [[1, 0], [0, 1], [0, 0]], request: [[0, 0], [1, 0], [0, 0]], max: [[1, 0], [1, 1], [1, 0]]
  },
  {
    id: "safe", title: "Banker's safe state", tag: "Safe", expectedDeadlock: false, expectedSafe: true,
    description: "Available resources permit every process to complete in a safe sequence.",
    processes: ["P0", "P1", "P2"], resources: ["A", "B"], total: [4, 2], available: [2, 1],
    allocation: [[1, 0], [0, 1], [1, 0]], request: [[0, 0], [0, 0], [0, 0]], max: [[2, 1], [1, 1], [2, 0]]
  },
  {
    id: "unsafe", title: "Banker's unsafe state", tag: "Unsafe", expectedDeadlock: false, expectedSafe: false,
    description: "No remaining process can satisfy its declared maximum claim from the current Work vector.",
    processes: ["P0", "P1", "P2"], resources: ["A", "B"], total: [3, 2], available: [0, 0],
    allocation: [[2, 0], [0, 1], [1, 1]], request: [[0, 0], [0, 0], [0, 0]], max: [[3, 2], [2, 2], [3, 2]]
  },
  {
    id: "multi", title: "Multiple instances", tag: "Multi-instance", expectedDeadlock: false, expectedSafe: true,
    description: "A matrix-based example with multiple instances of resource types.",
    processes: ["P1", "P2", "P3"], resources: ["R1", "R2"], total: [3, 2], available: [1, 0],
    allocation: [[1, 0], [1, 1], [0, 1]], request: [[0, 1], [1, 0], [0, 0]], max: [[2, 1], [2, 2], [1, 1]]
  },
  {
    id: "multi-deadlock", title: "Multi-instance deadlock", tag: "Deadlock · Multi-instance", expectedDeadlock: true, expectedSafe: false,
    description: "Two resource types each have multiple instances, but all instances are held by mutually waiting processes.",
    processes: ["P1", "P2", "P3", "P4"], resources: ["R1", "R2"], total: [2, 2], available: [0, 0],
    allocation: [[1, 0], [0, 1], [1, 0], [0, 1]], request: [[0, 1], [1, 0], [0, 1], [1, 0]], max: [[1, 1], [1, 1], [1, 1], [1, 1]]
  }
];

const clone = value => JSON.parse(JSON.stringify(value));
const vec = value => `[${value.join(", ")}]`;


function validateModel(s) {
  const errors = [];
  if (!s || !Array.isArray(s.processes) || !Array.isArray(s.resources) || !Array.isArray(s.available) || !Array.isArray(s.total) || !Array.isArray(s.allocation) || !Array.isArray(s.request) || !Array.isArray(s.max)) return ["Model is missing one or more required arrays."];
  const n = s.processes.length, m = s.resources.length;
  if (!n || !m) errors.push("Add at least one process and one resource type.");
  if (n > 8) errors.push("This prototype supports up to 8 processes.");
  if (m > 6) errors.push("This prototype supports up to 6 resource types.");
  if (s.processes.some(p => typeof p !== "string" || !p.trim()) || new Set(s.processes).size !== n) errors.push("Process names must be non-empty and unique.");
  if (s.resources.some(r => typeof r !== "string" || !r.trim()) || new Set(s.resources).size !== m) errors.push("Resource names must be non-empty and unique.");
  if (s.available.length !== m || s.total.length !== m) errors.push("Available and Total vectors must match the resource count.");
  const validMatrices = {};
  for (const [name, matrix] of [["allocation", s.allocation], ["request", s.request], ["max", s.max]]) {
    validMatrices[name] = Array.isArray(matrix) && matrix.length === n && matrix.every(row => Array.isArray(row) && row.length === m);
    if (!validMatrices[name]) { errors.push(`${name === "max" ? "Maximum claim" : name[0].toUpperCase() + name.slice(1)} matrix dimensions do not match the process/resource counts.`); continue; }
    if (matrix.some(row => row.some(v => !Number.isSafeInteger(v) || v < 0))) errors.push(`${name === "max" ? "Maximum claim" : name[0].toUpperCase() + name.slice(1)} values must be non-negative integers.`);
  }
  if (s.available.some(v => !Number.isSafeInteger(v) || v < 0)) errors.push("Available values must be non-negative integers.");
  if (s.total.some(v => !Number.isSafeInteger(v) || v < 0)) errors.push("Total values must be non-negative integers.");
  if (validMatrices.max && validMatrices.allocation && validMatrices.request) {
    if (s.max.some((row, i) => row.some((v, j) => v < s.allocation[i][j]))) errors.push("Maximum claim cannot be smaller than current allocation.");
    if (s.processes.some((p, i) => /\(terminated\)$/i.test(p) && [...s.allocation[i], ...s.request[i], ...s.max[i]].some(v => v !== 0))) errors.push("Terminated processes must have zero Allocation, Request and Maximum Claim values.");
    for (let i = 0; i < n; i++) if (!/\(terminated\)$/i.test(s.processes[i])) for (let j = 0; j < m; j++) if (s.request[i][j] > s.max[i][j] - s.allocation[i][j]) errors.push(`Request for ${s.processes[i]} exceeds its remaining Need for ${s.resources[j]} (Maximum − Allocation).`);
  }
  if (validMatrices.allocation && validMatrices.max && s.total.length === m && s.available.length === m) {
    for (let j = 0; j < m; j++) {
      const allocated = s.allocation.reduce((sum, row) => sum + (row[j] || 0), 0);
      if (s.total[j] !== s.available[j] + allocated) errors.push(`${s.resources[j]} conservation mismatch: Total ${s.total[j]} must equal Available ${s.available[j]} + Allocated ${allocated}.`);
      if (s.max.some(row => row[j] > s.total[j])) errors.push(`Maximum claim for ${s.resources[j]} cannot exceed the system total of ${s.total[j]} instance(s).`);
    }
  }
  return [...new Set(errors)];
}

function makeTrace(s, kind) {
  const isBanker = kind === "safety";
  const matrix = isBanker ? s.max.map((row, i) => row.map((v, j) => v - s.allocation[i][j])) : s.request;
  let work = [...s.available];
  const finish = isBanker
    ? s.processes.map(p => /\(terminated\)$/i.test(p))
    : s.allocation.map((row, i) => /\(terminated\)$/i.test(s.processes[i]) || row.every(v => v === 0));
  const steps = [{
    title: "Initialize the algorithm",
    detail: isBanker ? "Compute Need = Maximum Claim − Allocation. Start Work with Available; active processes begin unfinished and terminated rows are excluded." : "Start Work with Available. Processes holding no resources and previously terminated rows are marked finished for detection.",
    work: [...work], finish: [...finish], active: null, kind: "init", need: clone(matrix)
  }];
  const sequence = [];
  const maxLoops = s.processes.length * (s.resources.length + 2) + 10;
  for (let loop = 0; loop < maxLoops; loop++) {
    let found = false;
    for (let i = 0; i < s.processes.length; i++) {
      if (finish[i]) continue;
      const required = matrix[i];
      const canFinish = required.every((v, j) => v <= work[j]);
      steps.push({
        title: `Check ${s.processes[i]}`,
        detail: `${isBanker ? "Need" : "Request"} ${s.processes[i]} = ${vec(required)} ${canFinish ? "is less than or equal to" : "is NOT less than or equal to"} Work = ${vec(work)}.`,
        work: [...work], finish: [...finish], active: i, kind: canFinish ? "check-pass" : "check-fail", need: clone(matrix)
      });
      if (canFinish) {
        const before = [...work];
        for (let j = 0; j < work.length; j++) work[j] += s.allocation[i][j];
        finish[i] = true;
        sequence.push(i);
        found = true;
        steps.push({
          title: `${s.processes[i]} can finish`,
          detail: `${s.processes[i]} completes and releases Allocation ${vec(s.allocation[i])}. Work changes from ${vec(before)} to ${vec(work)}.`,
          work: [...work], finish: [...finish], active: i, kind: "release", need: clone(matrix)
        });
      }
    }
    if (!found) break;
  }
  const unfinished = finish.map((v, i) => v ? -1 : i).filter(i => i >= 0);
  const ok = unfinished.length === 0;
  steps.push({
    title: ok ? (isBanker ? "Safe state confirmed" : "No deadlock detected") : (isBanker ? "Unsafe state" : "Deadlock detected"),
    detail: ok
      ? `All processes can finish. One valid completion sequence is ${sequence.map(i => s.processes[i]).join(" → ") || "empty"}.`
      : `No further process can proceed. Unfinished processes: ${unfinished.map(i => s.processes[i]).join(", ")}.`,
    work: [...work], finish: [...finish], active: null, kind: ok ? "done" : "deadlock", need: clone(matrix)
  });
  return { steps, safe: ok, sequence: sequence.map(i => s.processes[i]), unfinished: unfinished.map(i => s.processes[i]), deadlockedProcesses: unfinished.map(i => s.processes[i]), need: matrix };
}

function findSingleInstanceCycle(state) {
  const n = state.processes.length;
  const nodeCount = n + state.resources.length;
  const adjacency = Array.from({ length: nodeCount }, () => []);
  state.allocation.forEach((row, i) => row.forEach((count, j) => {
    if (count > 0 && state.total[j] === 1) adjacency[n + j].push({ to: i, key: `a${i}-${j}` });
  }));
  state.request.forEach((row, i) => row.forEach((count, j) => {
    if (count > 0 && state.total[j] === 1) adjacency[i].push({ to: n + j, key: `q${i}-${j}` });
  }));
  const color = Array(nodeCount).fill(0);
  const stackNodes = [];
  const stackEdges = [];
  let cycleNodes = [];
  let cycleEdges = [];
  const visit = node => {
    color[node] = 1; stackNodes.push(node);
    for (const edge of adjacency[node]) {
      if (color[edge.to] === 0) {
        stackEdges.push(edge.key);
        if (visit(edge.to)) return true;
        stackEdges.pop();
      } else if (color[edge.to] === 1) {
        const start = stackNodes.indexOf(edge.to);
        cycleNodes = stackNodes.slice(start);
        cycleEdges = [...stackEdges.slice(start), edge.key];
        return true;
      }
    }
    stackNodes.pop(); color[node] = 2; return false;
  };
  for (let i = 0; i < nodeCount; i++) if (color[i] === 0 && visit(i)) break;
  return { nodes: new Set(cycleNodes), edges: new Set(cycleEdges), processCount: n };
}

function Graph({ state, highlighted = [], deadlocked = [], compact = false, onSelect, selectedNode = null }) {
  const graphId = useId().replace(/:/g, "");
  const cycle = findSingleInstanceCycle(state);
  const chooseNode = (type, index) => onSelect?.({ type, index });
  const width = 760;
  const nodeCount = Math.max(state.processes.length, state.resources.length);
  const height = Math.max(380, (nodeCount - 1) * 88 + 190);
  const verticalPositions = count => count === 1
    ? [height / 2 - 10]
    : Array.from({ length: count }, (_, i) => 70 + i * ((height - 150) / (count - 1)));
  const pY = verticalPositions(state.processes.length);
  const rY = verticalPositions(state.resources.length);
  const pPos = state.processes.map((_, i) => ({ x: 150, y: pY[i] }));
  const rPos = state.resources.map((_, i) => ({ x: 555, y: rY[i] }));
  const edges = [];
  state.allocation.forEach((row, i) => row.forEach((v, j) => { if (v > 0) edges.push({ a: rPos[j], b: pPos[i], label: `${v}`, type: "alloc", key: `a${i}-${j}`, processIndex: i, resourceIndex: j, active: highlighted.includes(i) || (selectedNode?.type === "process" && selectedNode.index === i) || (selectedNode?.type === "resource" && selectedNode.index === j), deadlocked: deadlocked.includes(state.processes[i]) }); }));
  state.request.forEach((row, i) => row.forEach((v, j) => { if (v > 0) edges.push({ a: pPos[i], b: rPos[j], label: `${v}`, type: "req", key: `q${i}-${j}`, processIndex: i, resourceIndex: j, active: highlighted.includes(i) || (selectedNode?.type === "process" && selectedNode.index === i) || (selectedNode?.type === "resource" && selectedNode.index === j), deadlocked: deadlocked.includes(state.processes[i]) }); }));
  return <div className={`graph-wrap ${compact ? "graph-compact" : ""}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Interactive Resource Allocation Graph">
      <defs>
        <pattern id={`${graphId}-graph-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#39463d" strokeWidth=".7" opacity=".45"/></pattern>
        <linearGradient id={`${graphId}-graph-wash`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e2b22" stopOpacity=".7"/><stop offset="1" stopColor="#151b17" stopOpacity=".15"/></linearGradient>
        <marker id={`${graphId}-alloc-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#9ed9b3" /></marker>
        <marker id={`${graphId}-request-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#d6a35e" /></marker>
        <filter id={`${graphId}-node-glow`}><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width={width} height={height} fill={`url(#${graphId}-graph-wash)`}/>
      <rect width={width} height={height} fill={`url(#${graphId}-graph-grid)`}/>
      <path d={`M 350 42 V ${height-28}`} stroke="#46564a" strokeWidth="1" strokeDasharray="3 7" opacity=".8"/>
      <text x="150" y="25" textAnchor="middle" className="graph-column-title">PROCESSES</text>
      <text x="555" y="25" textAnchor="middle" className="graph-column-title">RESOURCE TYPES</text>
      <text x="350" y="25" textAnchor="middle" className="graph-mid-label">ALLOCATION FLOW</text>
      {edges.map((e, i) => <g key={e.key} className={`graph-edge ${e.type === "req" ? "request-edge" : "allocation-edge"} ${e.active ? "edge-active" : ""} ${e.deadlocked ? "edge-deadlocked" : ""} ${cycle.edges.has(e.key) ? "edge-cycle" : ""}`} style={{ animationDelay: `${i * 65}ms` }}>
        <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={e.type === "req" ? "#d6a35e" : "#9ed9b3"} strokeWidth={e.active ? 4 : 2.5} strokeDasharray={e.type === "req" ? "7 5" : "none"} markerEnd={e.type === "req" ? `url(#${graphId}-request-arrow)` : `url(#${graphId}-alloc-arrow)`}/>
        <text x={(e.a.x + e.b.x) / 2} y={(e.a.y + e.b.y) / 2 - 8} className="edge-label">{e.label}</text>
        {e.type === "req" && <circle className="request-particle" r={e.deadlocked ? 3.8 : 3.2} fill={e.deadlocked || cycle.edges.has(e.key) ? "#ff8079" : "#f0c078"} style={{ color: e.deadlocked || cycle.edges.has(e.key) ? "#ff8079" : "#f0c078" }} aria-hidden="true"><animateMotion dur={`${1.45 + (i % 3) * 0.2}s`} begin={`${(i % 5) * 0.16}s`} repeatCount="indefinite" path={`M ${e.a.x} ${e.a.y} L ${e.b.x} ${e.b.y}`} /></circle>}
      </g>)}
      {pPos.map((p, i) => {
        const dead = deadlocked.includes(state.processes[i]);
        const selected = selectedNode?.type === "process" && selectedNode.index === i;
        const active = highlighted.includes(i) || selected;
        const terminated = /\(terminated\)$/i.test(state.processes[i]);
        return <g key={`p${i}`} className={`graph-node ${onSelect ? "graph-node-interactive" : ""} ${selected ? "graph-node-selected" : ""} ${cycle.nodes.has(i) ? "cycle-node" : ""}`} style={{ animationDelay: `${i * 75}ms` }} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Inspect process ${state.processes[i]}` : undefined} aria-pressed={onSelect ? selected : undefined} onClick={onSelect ? () => chooseNode("process", i) : undefined} onKeyDown={onSelect ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseNode("process", i); } } : undefined}>
          <circle cx={p.x} cy={p.y} r={active || selected ? 34 : 30} fill={dead ? "#512a29" : selected ? "#3b4b2e" : active ? "#2c4735" : terminated ? "#343b35" : "#26362a"} stroke={dead || cycle.nodes.has(i) ? "#ff8079" : selected ? "#f1c57a" : active ? "#d6a35e" : terminated ? "#87918a" : "#9ed9b3"} strokeWidth={active || dead || selected || cycle.nodes.has(i) ? 4 : 2.5} filter={active || dead || selected || cycle.nodes.has(i) ? `url(#${graphId}-node-glow)` : undefined}/>
          <text x={p.x} y={p.y + 5} textAnchor="middle" className="node-label">{state.processes[i].replace(" (terminated)", "")}</text>
          {dead
            ? <text x={p.x} y={p.y + 47} textAnchor="middle" className="deadlock-tag">UNFINISHED</text>
            : <text x={p.x} y={p.y + 47} textAnchor="middle" className="process-count">{terminated ? "TERMINATED" : `${state.allocation[i].reduce((a,b)=>a+b,0)} held · ${state.request[i].reduce((a,b)=>a+b,0)} requested`}</text>}
        </g>;
      })}
      {rPos.map((r, j) => {
        const total = state.total?.[j] ?? (state.available[j] + state.allocation.reduce((sum,row)=>sum+row[j],0));
        const held = state.allocation.reduce((sum,row)=>sum+row[j],0);
        const dotCount = Math.min(8, total);
        const selected = selectedNode?.type === "resource" && selectedNode.index === j;
        return <g key={`r${j}`} className={`graph-node ${onSelect ? "graph-node-interactive" : ""} ${selected ? "graph-node-selected" : ""} ${cycle.nodes.has(state.processes.length + j) ? "cycle-node" : ""}`} style={{ animationDelay: `${j * 100}ms` }} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Inspect resource ${state.resources[j]}` : undefined} aria-pressed={onSelect ? selected : undefined} onClick={onSelect ? () => chooseNode("resource", j) : undefined} onKeyDown={onSelect ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseNode("resource", j); } } : undefined}>
          <rect x={r.x - 48} y={r.y - 29} width="96" height="58" rx="12" fill={selected ? "#31563f" : cycle.nodes.has(state.processes.length + j) ? "#512a29" : "#214632"} stroke={selected ? "#f1c57a" : cycle.nodes.has(state.processes.length + j) ? "#ff8079" : "#9ed9b3"} strokeWidth={selected || cycle.nodes.has(state.processes.length + j) ? 4 : 2.5} filter={selected ? `url(#${graphId}-node-glow)` : undefined}/>
          <rect x={r.x - 43} y={r.y - 24} width="86" height="48" rx="8" fill="none" stroke="#d5ecd9" strokeOpacity=".22"/>
          <text x={r.x} y={r.y + 5} textAnchor="middle" className="node-label">{state.resources[j]}</text>
          <text x={r.x} y={r.y + 45} textAnchor="middle" className="resource-count">{state.available[j]} available · {held} held</text>
          <g className="instance-dots">
            {Array.from({length:dotCount},(_,k)=><circle key={k} cx={r.x-(dotCount-1)*7/2+k*7} cy={r.y+62} r="2.6" fill={k<state.available[j]?"#9ed9b3":k<state.available[j]+held?"#d6a35e":"#46564a"}/>)}
            {total===0 && <text x={r.x} y={r.y+66} textAnchor="middle" className="resource-count">0 instances</text>}
          </g>
        </g>;
      })}
    </svg>
    <div className="legend"><span><i className="legend-blue"/> Allocation: Resource → Process</span><span><i className="legend-amber"/> Request: Process → Resource</span><span className="legend-note">Gold = selected/current step · Coral = single-instance cycle</span></div>
  </div>;
}

function MatrixCell({ value, label, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    if (draft.trim() === "") { setDraft(String(value)); return; }
    const parsed = Number(draft);
    if (!Number.isSafeInteger(parsed) || parsed < 0) { setDraft(String(value)); return; }
    if (parsed !== value) onCommit(parsed);
  };
  return <input aria-label={label} type="number" min="0" step="1" inputMode="numeric" value={draft} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setDraft(String(value)); }} />;
}

function MatrixTable({ title, rows, rowNames, colNames, editable = false, onEdit, highlightRow = -1, disabledRows = [], disabledAll = false }) {
  return <div className="matrix-block">
    <h4>{title}</h4>
    <div className="table-scroll"><table><thead><tr><th></th>{colNames.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className={highlightRow === i ? "highlight-row" : ""}><th>{rowNames[i]}</th>{row.map((v, j) => <td key={j}>{editable
        ? <MatrixCell value={v} label={`${title} ${rowNames[i]} ${colNames[j]}`} disabled={disabledAll || disabledRows.includes(i)} onCommit={next => onEdit(i, j, next)} />
        : v}</td>)}</tr>)}</tbody></table></div>
  </div>;
}

export default function App() {
  const [state, setState] = useState(clone(BUILTIN_CASES[0]));
  const [selectedCase, setSelectedCase] = useState("deadlock");
  const [detection, setDetection] = useState(null);
  const [safety, setSafety] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("0");
  const [apiStatus, setApiStatus] = useState("Checking API…");
  const [activeSection, setActiveSection] = useState("overview");
  const [customName, setCustomName] = useState("My Custom Scenario");
  const [customCases, setCustomCases] = useState([]);
  const [testReport, setTestReport] = useState(null);
  const [traceKind, setTraceKind] = useState("detect");
  const [traceSteps, setTraceSteps] = useState([]);
  const [traceIndex, setTraceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recoveryBefore, setRecoveryBefore] = useState(null);
  const [recoveryAfter, setRecoveryAfter] = useState(null);
  const [recoveryStory, setRecoveryStory] = useState(null);
  const [recoveryFeedback, setRecoveryFeedback] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCheckingSafety, setIsCheckingSafety] = useState(false);
  const [validationVisible, setValidationVisible] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  const [recoveryOptions, setRecoveryOptions] = useState(null);
  const [isComparingRecovery, setIsComparingRecovery] = useState(false);
  const [demoStep, setDemoStep] = useState(-1);
  const [demoBusy, setDemoBusy] = useState(false);
  const [preLabModel, setPreLabModel] = useState(null);
  const [preLabCase, setPreLabCase] = useState(null);
  const [isLabProjection, setIsLabProjection] = useState(false);
  const modelLocked = isRecovering || isDetecting || isCheckingSafety || isComparingRecovery;

  const errors = useMemo(() => validateModel(state), [state]);
  const deadlocked = detection?.deadlockedProcesses || [];
  const need = useMemo(() => state.max.map((row, i) => row.map((v, j) => v - state.allocation[i][j])), [state]);
  const comparison = useMemo(() => {
    if (!detection || !safety) return null;
    if (detection.safe && safety.safe) return { kind: "good", title: "Both analyses pass", detail: `Detection found no unfinished process${detection.sequence?.length ? `; its completion sequence is ${detection.sequence.join(" → ")}` : ""}. Banker’s safety also found a safe sequence${safety.sequence?.length ? `: ${safety.sequence.join(" → ")}` : ""}.` };
    if (detection.safe && !safety.safe) return { kind: "caution", title: "No current deadlock, but the state is unsafe", detail: `Detection uses the current Request matrix and found a completion sequence (${detection.sequence.join(" → ") || "no unfinished processes"}). Banker’s algorithm uses Need = Maximum − Allocation and could not finish ${safety.unfinished.join(", ")}. An unsafe state is not proof of a current deadlock; it means the declared maximum claims do not guarantee a safe completion order.` };
    if (!detection.safe && safety.safe) return { kind: "caution", title: "Current requests are deadlocked, despite a safe maximum-claim calculation", detail: `Detection could not finish ${detection.deadlockedProcesses.join(", ")}. Banker’s safety is evaluating the declared Need matrix, not the current Request matrix. Inspect the model: if Request exceeds remaining Need, validation should reject it; otherwise review the two algorithms’ vectors and trace.` };
    return { kind: "danger", title: "Both analyses report a problem", detail: `Detection left ${detection.deadlockedProcesses.join(", ")} unfinished, while Banker’s algorithm could not complete ${safety.unfinished.join(", ")}. Compare Request against Work and Need against Work in the two independent traces.` };
  }, [detection, safety]);
  const diagnosis = useMemo(() => {
    if (!detection) return null;
    if (detection.safe) return { deadlocked: false, processes: [], blockers: [], victimIndex: -1, summary: "The current-request detection algorithm found a completion sequence. No current deadlock is indicated by this model." };
    const indices = deadlocked.map(name => state.processes.findIndex(p => p === name)).filter(i => i >= 0);
    const blockers = indices.map(i => {
      const waitingFor = state.request[i].map((count, j) => {
        if (count <= state.available[j]) return null;
        const holders = state.processes.map((name, k) => ({ name, count: state.allocation[k][j] })).filter(h => h.count > 0);
        return { resource: state.resources[j], count, available: state.available[j], holders };
      }).filter(Boolean);
      return { index: i, process: state.processes[i], waitingFor, allocated: state.allocation[i].reduce((a, b) => a + b, 0), requested: state.request[i].reduce((a, b) => a + b, 0) };
    });
    const candidates = [...blockers].sort((a, b) => a.allocated - b.allocated || b.requested - a.requested || a.index - b.index);
    const victim = candidates[0];
    return {
      deadlocked: true, processes: blockers.map(x => x.process), blockers, victimIndex: victim?.index ?? -1,
      victim: victim?.process || null,
      summary: `The detection pass could not finish ${blockers.map(x => x.process).join(", ")}. The suggested recovery victim is ${victim?.process || "not determined"} because it has the smallest current allocation among the reported unfinished processes. This is a transparent heuristic, not a universal optimal policy.`
    };
  }, [detection, deadlocked.join("|"), state]);
  const currentTrace = traceSteps[traceIndex] || null;
  const currentActive = currentTrace?.active === null || currentTrace?.active === undefined ? [] : [currentTrace.active];

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(() => setApiStatus("API connected")).catch(() => setApiStatus("API offline — start server"));
  }, []);
  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = setInterval(() => setTraceIndex(i => {
      if (i >= traceSteps.length - 1) { setIsPlaying(false); return i; }
      return i + 1;
    }), 1050);
    return () => clearInterval(timer);
  }, [isPlaying, traceSteps.length]);
  useEffect(() => {
    if (traceIndex >= traceSteps.length - 1 && isPlaying) setIsPlaying(false);
  }, [traceIndex, traceSteps.length, isPlaying]);

  function clearResults() {
    setDetection(null); setSafety(null); setTraceSteps([]); setTraceIndex(0); setIsPlaying(false);
    setRecoveryBefore(null); setRecoveryAfter(null); setRecoveryStory(null); setRecoveryFeedback(null); setRecoveryOptions(null); setTestReport(null); setSelectedGraphNode(null);
  }

  function visualizeBankerModel(labModel) {
    if (!preLabModel) { setPreLabModel(clone(state)); setPreLabCase(selectedCase); }
    const allocation = clone(labModel.allocation);
    const available = [...labModel.available];
    const request = clone(labModel.outstandingRequest || labModel.processes.map(() => labModel.resources.map(() => 0)));
    const total = labModel.resources.map((_, j) => available[j] + allocation.reduce((sum, row) => sum + row[j], 0));
    const projected = {
      id: "banker-lab-projection",
      title: `Banker’s Lab projection · ${labModel.processes.length} processes`,
      description: "Projected from Banker’s Algorithm Lab for graph visualization.",
      processes: [...labModel.processes], resources: [...labModel.resources], total, available,
      allocation, request, max: clone(labModel.max)
    };
    setState(projected);
    setSelectedCase("banker-lab-projection");
    setIsLabProjection(true);
    clearResults();
    setValidationVisible(false);
    setSelectedProcess("0");
    setMessage("Banker’s Lab model loaded into the Resource Allocation Graph. This is a copy; use Restore previous main model to return to your original scenario.");
    setActiveSection("graph");
    window.setTimeout(() => document.getElementById("graph")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function restorePreLabModel() {
    if (!preLabModel) return;
    const restored = clone(preLabModel);
    setState(restored);
    setPreLabModel(null);
    const restoredCase = preLabCase || "deadlock";
    setPreLabCase(null);
    setIsLabProjection(false);
    setSelectedCase(restoredCase);
    clearResults();
    setValidationVisible(false);
    setMessage("Restored the previous main workspace model. Algorithm results were cleared so they can be recalculated for this model.");
  }
  function navTo(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function chooseCase(item) {
    setPreLabModel(null); setPreLabCase(null); setIsLabProjection(false);
    setState(clone(item)); setSelectedCase(item.id || `custom-${customCases.indexOf(item)}`);
    clearResults(); setValidationVisible(false); setMessage(`Loaded scenario: ${item.title}`); const firstActive = item.processes.findIndex(p => !/\(terminated\)$/i.test(p)); setSelectedProcess(firstActive >= 0 ? String(firstActive) : "");
  }
  function recomputeTotal(next) {
    next.total = next.resources.map((_, j) => next.available[j] + next.allocation.reduce((sum, row) => sum + row[j], 0));
    return next;
  }
  function updateCell(matrixName, i, j, value) {
    const next = clone(state);
    const n = Math.max(0, Math.floor(Number(value) || 0));
    next[matrixName][i][j] = n;
    if (matrixName === "allocation" && next.max[i][j] < n) next.max[i][j] = n;
    if (matrixName === "max" && n < next.allocation[i][j]) next.max[i][j] = next.allocation[i][j];
    recomputeTotal(next);
    setState(next); clearResults(); setValidationVisible(true);
  }
  function updateAvailable(j, value) {
    const next = clone(state); next.available[j] = Math.max(0, Math.floor(Number(value) || 0));
    recomputeTotal(next); setState(next); clearResults(); setValidationVisible(true);
  }
  async function apiPost(endpoint, body = state) {
    const r = await fetch(`${API}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }
  async function detect() {
    if (errors.length) { setValidationVisible(true); setMessage("Fix the validation issues before running detection."); setRecoveryFeedback({ kind: "error", title: "Detection blocked", detail: "Correct the model validation errors, then run detection again." }); return; }
    if (isDetecting || isRecovering || isCheckingSafety) return;
    setIsDetecting(true);
    const recoveryContext = Boolean(recoveryStory || recoveryBefore || recoveryAfter);
    if (recoveryContext) setRecoveryFeedback({ kind: "working", title: "Running deadlock detection…", detail: "Checking the current Available, Allocation and Request vectors against the detection algorithm." });
    if (recoveryStory) setRecoveryStory(prev => prev ? { ...prev, stage: "verifying" } : prev);
    try {
      await new Promise(resolve => setTimeout(resolve, 350));
      const result = await apiPost("detect");
      setDetection(result); setTraceKind("detect"); setTraceSteps(makeTrace(state, "detect").steps); setTraceIndex(0); setIsPlaying(false);
      const detail = result.safe
        ? `No deadlock detected. Completion sequence: ${result.sequence?.join(" → ") || "no unfinished processes"}.`
        : `Deadlock remains. The algorithm could not finish: ${result.deadlockedProcesses.join(", ")}. Consider a different victim or another recovery step.`;
      setMessage(detail);
      if (recoveryBefore || recoveryAfter || recoveryStory) {
        setRecoveryStory(prev => prev ? { ...prev, stage: "verified", verification: result.safe ? "clear" : "deadlock", verificationDetail: detail } : prev);
      }
      if (recoveryContext) setRecoveryFeedback({ kind: result.safe ? "success" : "warning", title: result.safe ? "No deadlock detected" : "Deadlock detected", detail });
    } catch (e) {
      const detail = `${e.message}. Confirm that the DAGLock API is running on port 5000, then retry.`;
      setMessage(`Detection failed: ${detail}`);
      if (recoveryContext) setRecoveryFeedback({ kind: "error", title: "Detection failed", detail });
    } finally {
      setIsDetecting(false);
    }
  }
  async function checkSafety() {
    if (errors.length) { setValidationVisible(true); setMessage("Fix the validation issues before running the safety check."); return; }
    if (isCheckingSafety || isDetecting || isRecovering) return;
    setIsCheckingSafety(true);
    try {
      const result = await apiPost("safety");
      setSafety(result); setTraceKind("safety"); setTraceSteps(makeTrace(state, "safety").steps); setTraceIndex(0); setIsPlaying(false);
      setMessage(result.safe ? `Safe state. Sequence: ${result.sequence.join(" → ")}` : `Unsafe state. Unable to finish: ${result.unfinished.join(", ")}.`);
    } catch (e) { setMessage(`Safety check failed: ${e.message}. Check that the backend is running on port 5000.`); }
    finally { setIsCheckingSafety(false); }
  }

  async function recover(processIndexOverride = null) {
    if (errors.length) { setValidationVisible(true); setMessage("Fix validation issues before recovery."); setRecoveryFeedback({ kind: "error", title: "Recovery blocked", detail: "Correct the model validation errors before terminating a simulated process." }); return; }
    if (isRecovering || isDetecting || isCheckingSafety) return;
    const victimIndex = processIndexOverride === null ? Number(selectedProcess) : Number(processIndexOverride);
    const victimName = state.processes[victimIndex];
    if (victimIndex < 0 || !victimName) {
      setRecoveryFeedback({ kind: "error", title: "Choose an active process", detail: "All processes may already be terminated. Reset the scenario to start a new recovery experiment." });
      return;
    }
    if (victimName.includes("(terminated)")) {
      const nextActive = state.processes.findIndex(p => !p.includes("(terminated)"));
      setSelectedProcess(nextActive >= 0 ? String(nextActive) : "");
      setRecoveryFeedback({ kind: "warning", title: "That process is already terminated", detail: nextActive >= 0 ? `Selected ${state.processes[nextActive]} instead. Choose an active process to continue.` : "There are no active processes left. Reset the scenario to run another experiment." });
      return;
    }
    setIsRecovering(true);
    const before = clone(state);
    const released = [...state.allocation[victimIndex]];
    setRecoveryBefore(before);
    setRecoveryAfter(null);
    setRecoveryStory({ process: victimName, released, beforeAvailable: [...before.available], afterAvailable: null, deadlockedBefore: detection?.deadlockedProcesses || [], stage: "terminating" });
    setRecoveryFeedback({ kind: "working", title: `Terminating ${victimName} in the simulation…`, detail: "Stage 1 of 4: marking the selected process as the recovery victim. No real OS process is touched." });
    try {
      await new Promise(resolve => setTimeout(resolve, 650));
      setRecoveryStory(prev => prev ? { ...prev, stage: "releasing" } : prev);
      setRecoveryFeedback({ kind: "working", title: "Releasing allocated resources…", detail: `Stage 2 of 4: returning ${released.join(", ")} allocated instance(s) to the Available vector.` });
      await new Promise(resolve => setTimeout(resolve, 650));
      const result = await apiPost("recover", { ...before, processIndex: victimIndex });
      const after = clone(result.state);
      setRecoveryStory(prev => prev ? { ...prev, stage: "updating", afterAvailable: [...after.available] } : prev);
      setRecoveryFeedback({ kind: "working", title: "Updating the system model…", detail: "Stage 3 of 4: the process is marked terminated, its outstanding request is cleared, and Available is recomputed." });
      setState(after);
      setDetection(null); setSafety(null); setTraceSteps([]); setTraceIndex(0); setIsPlaying(false); setTestReport(null);
      setRecoveryBefore(before); setRecoveryAfter(after);
      await new Promise(resolve => setTimeout(resolve, 550));
      setRecoveryStory(prev => prev ? { ...prev, stage: "verifying", afterAvailable: [...after.available] } : prev);
      const nextActiveIndex = after.processes.findIndex((name, i) => i !== victimIndex && !name.includes("(terminated)"));
      setSelectedProcess(nextActiveIndex >= 0 ? String(nextActiveIndex) : "");
      setRecoveryFeedback({ kind: "success", title: `${result.terminatedProcess || victimName} terminated in the simulation`, detail: `Stage 4 of 4: ${result.message} The updated graph and resource counts are ready. Click “Re-run deadlock detection” to verify the remaining processes.` });
      setMessage(`${result.message} Re-run deadlock detection to verify the resulting state.`);
      setValidationVisible(false);
    } catch (e) {
      setRecoveryStory(null);
      const detail = `${e.message}. Check the API connection and retry.`;
      setRecoveryFeedback({ kind: "error", title: "Recovery failed", detail });
      setMessage(`Recovery failed: ${detail}`);
    } finally {
      setIsRecovering(false);
    }
  }
    function resetCurrent() {
    if (isLabProjection && preLabModel) { restorePreLabModel(); return; }
    const item = selectedCase.startsWith("custom-") ? customCases[Number(selectedCase.split("-")[1])] : BUILTIN_CASES.find(c => c.id === selectedCase);
    const restored = clone(item || BUILTIN_CASES[0]); setState(restored); clearResults(); setMessage("Scenario reset to its original values."); setValidationVisible(false); const firstActive = restored.processes.findIndex(p => !/\(terminated\)$/i.test(p)); setSelectedProcess(firstActive >= 0 ? String(firstActive) : "");
  }
  function addProcess() {
    if (state.processes.length >= 8) { setMessage("Prototype limit reached: 8 processes."); return; }
    const next = clone(state);
    let number = 1;
    while (next.processes.includes(`P${number}`) || next.processes.includes(`P${number} (terminated)`)) number++;
    const name = `P${number}`;
    next.processes.push(name); next.allocation.push(next.resources.map(() => 0)); next.request.push(next.resources.map(() => 0)); next.max.push(next.resources.map(() => 0));
    setState(next); clearResults(); setValidationVisible(false); setSelectedProcess(String(next.processes.length - 1)); setMessage(`${name} added. Configure its Allocation, Request and Maximum Claim values below.`);
  }
  function deleteProcess(index) {
    if (state.processes.length <= 1) { setMessage("Keep at least one process in the model."); return; }
    const next = clone(state);
    const name = next.processes[index];
    if (index < 0 || !name) return;
    // Deleting a process releases its held instances back to Available before removing its rows.
    next.available = next.available.map((v, j) => v + next.allocation[index][j]);
    next.processes.splice(index, 1);
    next.allocation.splice(index, 1);
    next.request.splice(index, 1);
    next.max.splice(index, 1);
    recomputeTotal(next);
    setState(next); clearResults(); setValidationVisible(false);
    const nextIndex = Math.min(Math.max(0, Number(selectedProcess) > index ? Number(selectedProcess) - 1 : Number(selectedProcess)), next.processes.length - 1);
    setSelectedProcess(String(nextIndex));
    setMessage(`${name} removed. Its allocated instances were returned to Available; all process matrix rows were updated.`);
  }
  function addResource() {
    if (state.resources.length >= 6) { setMessage("Prototype limit reached: 6 resource types."); return; }
    const next = clone(state);
    let number = 1;
    while (next.resources.includes(`R${number}`)) number++;
    const name = `R${number}`;
    next.resources.push(name); next.available.push(1); next.total.push(1);
    next.allocation.forEach(row => row.push(0)); next.request.forEach(row => row.push(0)); next.max.forEach(row => row.push(0));
    recomputeTotal(next); setState(next); clearResults(); setValidationVisible(false); setMessage(`${name} added with one available instance. All matrix columns have been updated.`);
  }
  function deleteResource(index) {
    if (state.resources.length <= 1) { setMessage("Keep at least one resource type in the model."); return; }
    const name = state.resources[index];
    if (index < 0 || !name) return;
    const allocated = state.allocation.reduce((sum, row) => sum + (row[index] || 0), 0);
    if (allocated > 0) {
      setMessage(`Cannot remove ${name}: ${allocated} instance(s) are currently allocated. Set the ${name} Allocation column to 0 first, or remove the processes holding it.`);
      setValidationVisible(true);
      return;
    }
    const next = clone(state);
    next.resources.splice(index, 1);
    next.available.splice(index, 1);
    next.total.splice(index, 1);
    next.allocation.forEach(row => row.splice(index, 1));
    next.request.forEach(row => row.splice(index, 1));
    next.max.forEach(row => row.splice(index, 1));
    recomputeTotal(next);
    setState(next); clearResults(); setValidationVisible(false);
    setMessage(`${name} removed. Its column was removed from Allocation, Request, Maximum Claim and Need; remaining totals were recalculated.`);
  }
  function saveCustom() {
    const found = validateModel(state);
    if (found.length) { setValidationVisible(true); setMessage("Cannot save an invalid scenario. Fix the validation messages first."); return; }
    const item = { ...clone(state), id: `custom-${customCases.length}`, title: customName.trim() || `Custom Scenario ${customCases.length + 1}`, tag: "Custom", description: "User-created scenario saved for this browser session." };
    setCustomCases(old => [...old, item]); setSelectedCase(item.id); setMessage(`Saved "${item.title}" for this browser session.`);
  }
  async function runTestSuite() {
    setTestReport({ running: true, results: [] });
    const results = [];
    for (const c of BUILTIN_CASES) {
      try {
        const d = await apiPost("detect", c);
        const b = await apiPost("safety", c);
        const detectionPass = d.safe === !c.expectedDeadlock;
        const safetyPass = b.safe === c.expectedSafe;
        results.push({ title: c.title, detectionPass, safetyPass, pass: detectionPass && safetyPass, expected: `Detection: ${c.expectedDeadlock ? "deadlock" : "clear"}; safety: ${c.expectedSafe ? "safe" : "unsafe"}`, actual: `Detection: ${d.safe ? "clear" : "deadlock"}; safety: ${b.safe ? "safe" : "unsafe"}` });
      } catch (e) {
        results.push({ title: c.title, pass: false, detectionPass: false, safetyPass: false, expected: "Valid API result", actual: e.message });
      }
    }
    try {
      const recovered = await apiPost("recover", { ...BUILTIN_CASES[0], processIndex: 0 });
      const conservation = recovered.state.total.every((total,j) => total === recovered.state.available[j] + recovered.state.allocation.reduce((sum,row)=>sum+row[j],0));
      const pass = recovered.state.processes[0].includes("(terminated)") && conservation && recovered.state.request[0].every(v=>v===0);
      results.push({ title: "Recovery conservation invariant", pass, detectionPass: pass, safetyPass: pass, expected: "Victim terminated, requests cleared, Total = Available + Allocated", actual: pass ? "Invariant preserved" : "Recovery invariant failed" });
    } catch(e) { results.push({ title: "Recovery conservation invariant", pass: false, detectionPass: false, safetyPass: false, expected: "Valid recovery transition", actual: e.message }); }
    try {
      const invalid = { ...BUILTIN_CASES[1], request: BUILTIN_CASES[1].request.map((row,i)=>i===0?row.map((v,j)=>j===0?999:v):row) };
      await apiPost("validate", invalid);
      results.push({ title: "Invalid model rejection", pass: false, detectionPass: false, safetyPass: false, expected: "Reject request exceeding remaining Need", actual: "API accepted invalid model" });
    } catch(e) { const pass = /Need|request/i.test(e.message); results.push({ title: "Invalid model rejection", pass, detectionPass: pass, safetyPass: pass, expected: "Reject request exceeding remaining Need", actual: pass ? "Invalid model rejected" : e.message }); }
    setTestReport({ running: false, results, passed: results.filter(x => x.pass).length, failed: results.filter(x => !x.pass).length });
  }

  async function compareRecoveryOptions() {
    if (errors.length) { setValidationVisible(true); setMessage("Fix model validation issues before comparing recovery candidates."); return; }
    if (isComparingRecovery || isRecovering || isDetecting) return;
    setIsComparingRecovery(true); setRecoveryOptions({ loading: true, options: [] });
    try {
      const result = await apiPost("recovery-options");
      setRecoveryOptions({ loading: false, ...result });
      setMessage(result.options.length ? `Compared ${result.options.length} active recovery candidate(s).` : "No active processes remain to evaluate as recovery victims.");
    } catch (e) {
      setRecoveryOptions({ loading: false, options: [], error: e.message });
      setMessage(`Recovery comparison failed: ${e.message}`);
    } finally { setIsComparingRecovery(false); }
  }

  const demoSteps = [
    { title: "Load a circular-wait scenario", detail: "Start with two processes holding different single-instance resources and requesting the other resource.", action: "Load scenario" },
    { title: "Run current-request detection", detail: "Watch Work and Finish change; unfinished processes are the detection algorithm’s deadlock candidates.", action: "Run detection" },
    { title: "Compare Banker’s safety", detail: "Run the independent maximum-claim analysis and compare Need against Work.", action: "Run safety check" },
    { title: "Inspect the evidence", detail: "Open Diagnosis Desk and inspect the resource holders and blocked requests.", action: "Open Diagnosis Desk" },
    { title: "Demonstrate recovery", detail: "Open Recovery Lab and compare termination candidates before applying a simulated recovery.", action: "Open Recovery Lab" }
  ];
  async function advanceDemo() {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const nextStep = demoStep + 1;
      if (nextStep === 0) { chooseCase(BUILTIN_CASES[0]); setDemoStep(0); }
      else if (nextStep === 1) { setDemoStep(1); navTo("graph"); await detect(); navTo("studio"); }
      else if (nextStep === 2) { setDemoStep(2); await checkSafety(); navTo("studio"); }
      else if (nextStep === 3) { setDemoStep(3); navTo("diagnosis"); }
      else if (nextStep === 4) { setDemoStep(4); navTo("recovery"); }
      else { setDemoStep(-1); setMessage("Guided demonstration complete. Continue exploring scenarios or export your experiment report."); }
    } finally { setDemoBusy(false); }
  }

  function exportPrintableReport() {
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const rows = (title, matrix, rowNames = state.processes) => `<h3>${escapeHtml(title)}</h3><table><thead><tr><th></th>${state.resources.map(r => `<th>${escapeHtml(r)}</th>`).join("")}</tr></thead><tbody>${matrix.map((row,i)=>`<tr><th>${escapeHtml(rowNames[i])}</th>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const reportTitle = state.title || allCases.find(c => c.id === selectedCase)?.title || "Custom model";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DAGLock Experiment Report</title><style>body{font:14px/1.5 Arial,sans-serif;color:#202820;max-width:1000px;margin:32px auto;padding:0 24px}h1,h2,h3{color:#274d37}.meta{color:#56665a}table{border-collapse:collapse;width:100%;margin:8px 0 22px}th,td{border:1px solid #c8d2c8;padding:7px;text-align:left}th{background:#edf3ed}.result{padding:12px;border:1px solid #c5d5c5;margin:8px 0;border-radius:5px}.muted{color:#647267}.print{position:fixed;right:20px;top:20px;padding:10px 16px;background:#234b34;color:white;border:0;border-radius:5px;cursor:pointer}@media print{.print{display:none}body{margin:0;max-width:none}}</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><header><h1>DAGLock — Experiment Report</h1><h2>${escapeHtml(reportTitle)}</h2><div class="meta">Generated ${escapeHtml(new Date().toLocaleString())} · Educational OS simulation only</div></header><h2>System model</h2><p>Processes: ${state.processes.map(escapeHtml).join(", ")}<br>Resource types: ${state.resources.map(escapeHtml).join(", ")}<br>Available: ${escapeHtml(vec(state.available))}<br>Total: ${escapeHtml(vec(state.total))}</p>${rows("Allocation",state.allocation)}${rows("Current Request",state.request)}${rows("Maximum Claim",state.max)}${rows("Need = Maximum − Allocation",need)}<h2>Algorithm results</h2><div class="result"><strong>Deadlock detection:</strong> ${detection ? detection.safe ? `No deadlock indicated. Sequence: ${escapeHtml(detection.sequence.join(" → ") || "none")}` : `Deadlock detected by the detection algorithm. Unfinished: ${escapeHtml(detection.deadlockedProcesses.join(", "))}` : "Not run"}</div><div class="result"><strong>Banker’s safety:</strong> ${safety ? safety.safe ? `Safe. Sequence: ${escapeHtml(safety.sequence.join(" → "))}` : `Unsafe. Unfinished: ${escapeHtml(safety.unfinished.join(", "))}` : "Not run"}</div>${comparison ? `<div class="result"><strong>${escapeHtml(comparison.title)}</strong><p>${escapeHtml(comparison.detail)}</p></div>` : ""}<h2>Recovery</h2><p>${recoveryStory ? `${escapeHtml(recoveryStory.process)}: ${escapeHtml(recoveryFeedback?.detail || "Recovery simulated")}` : "No recovery performed."}</p><h2>Automated tests</h2><p>${testReport && !testReport.running ? `${testReport.passed} passed, ${testReport.failed} failed` : "Not run in this session."}</p><p class="muted">DAGLock is an educational simulation. Recovery changes only this model; it does not terminate real operating-system processes. Deadlock detection uses current outstanding Request; Banker’s safety uses Need = Maximum Claim − Allocation. An unsafe state is not itself proof of a current deadlock.</p></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `daglock-report-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200);
    setMessage("Print-ready HTML report exported. Open it in a browser and choose Print → Save as PDF if needed.");
  }

  function exportReport() {
    const report = {
      application: "DAGLock — Interactive Deadlock Detection & Recovery Simulator",
      exportedAt: new Date().toISOString(),
      scenario: { title: state.title || allCases.find(c => c.id === selectedCase)?.title || "Current custom model", processes: state.processes, resources: state.resources },
      model: { total: state.total, available: state.available, allocation: state.allocation, request: state.request, maximumClaim: state.max, need: state.max.map((row, i) => row.map((v, j) => v - state.allocation[i][j])) },
      results: {
        deadlockDetection: detection ? { safe: detection.safe, sequence: detection.sequence, deadlockedProcesses: detection.deadlockedProcesses } : "Not run",
        bankersSafety: safety ? { safe: safety.safe, sequence: safety.sequence, unfinished: safety.unfinished } : "Not run",
        algorithmTrace: traceSteps.length ? traceSteps.map((step, i) => ({ step: i + 1, title: step.title, detail: step.detail, work: step.work, finish: step.finish })) : "No trace recorded",
        comparison: comparison || "Run both algorithms to compare results",
        recoveryOptions: recoveryOptions && !recoveryOptions.loading ? recoveryOptions.options?.map(({ process, released, allocatedCost, detection, safety }) => ({ process, released, allocatedCost, detection, safety })) : "Not run",
        recovery: recoveryStory ? { process: recoveryStory.process, released: recoveryStory.released, stage: recoveryStory.stage, verification: recoveryStory.verification || "Not run" } : "Not run",
        automatedTests: testReport && !testReport.running ? { passed: testReport.passed, failed: testReport.failed, results: testReport.results } : "Not run"
      },
      note: "Educational simulation only. Recovery does not terminate real operating-system processes."
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daglock-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    setMessage("Experiment report exported as JSON.");
  }

  const allCases = [...BUILTIN_CASES, ...customCases];
  const traceForSafety = traceKind === "safety";
  const traceResult = traceSteps.length ? traceSteps[traceSteps.length - 1] : null;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><img src="/daglock.svg" alt="" /></div><div><strong>DAGLock</strong><small>DEADLOCK INTELLIGENCE</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav ${activeSection === "overview" ? "active" : ""}`} onClick={() => navTo("overview")}><span>◈</span> Overview</button>
      <button className={`nav ${activeSection === "graph" ? "active" : ""}`} onClick={() => navTo("graph")}><span>⌘</span> Resource Graph</button>
      <button className={`nav ${activeSection === "studio" ? "active" : ""}`} onClick={() => navTo("studio")}><span>⌘</span> Algorithm Studio</button>
      <button className={`nav ${activeSection === "banker-lab" ? "active" : ""}`} onClick={() => navTo("banker-lab")}><span>▤</span> Banker’s Algorithm Lab</button>
      <button className={`nav ${activeSection === "matrices" ? "active" : ""}`} onClick={() => navTo("matrices")}><span>▦</span> Matrices & Model</button>
      <button className={`nav ${activeSection === "diagnosis" ? "active" : ""}`} onClick={() => navTo("diagnosis")}><span>⌘</span> Diagnosis Desk</button>
      <button className={`nav ${activeSection === "scenarios" ? "active" : ""}`} onClick={() => navTo("scenarios")}><span>◉</span> Scenarios & Tests</button>
      <button className={`nav ${activeSection === "recovery" ? "active" : ""}`} onClick={() => navTo("recovery")}><span>↻</span> Recovery Lab</button>
      <div className="side-bottom"><div className={`status-dot ${apiStatus === "API connected" ? "" : "offline"}`}/><span>{apiStatus}</span></div>
    </aside>

    <main className="main">
      <header className="topbar" id="overview">
        <div><div className="eyebrow">OPERATING SYSTEMS · RESOURCE MANAGEMENT</div><h1>Deadlock Detection & Recovery</h1><p>Inspect the graph, step through the algorithm, verify scenarios and explain recovery.</p></div>
        <div className="top-actions"><span className="pill"><span className="pulse-dot"/> Interactive simulator</span><button className="secondary" onClick={exportReport}>Export JSON ↓</button><button className="secondary" onClick={exportPrintableReport}>Print report ↗</button><button className="secondary" onClick={() => { chooseCase(BUILTIN_CASES[0]); setDemoStep(0); }} disabled={modelLocked || !!testReport?.running}>Guided demo ▶</button><button className="secondary" onClick={resetCurrent} disabled={modelLocked}>Reset scenario</button></div>
      </header>

      {demoStep >= 0 && <section className="guided-demo" aria-live="polite"><div className="guided-demo-top"><div><span className="eyebrow">GUIDED FACULTY WALKTHROUGH · STEP {demoStep + 1} OF {demoSteps.length}</span><h2>{demoSteps[demoStep].title}</h2><p>{demoSteps[demoStep].detail}</p></div><button className="icon-button" onClick={() => setDemoStep(-1)} aria-label="Close guided demo">×</button></div><div className="guided-progress">{demoSteps.map((step,i)=><span key={step.title} className={i <= demoStep ? "done" : ""}/>)}</div><div className="guided-demo-actions"><button className="secondary" onClick={() => setDemoStep(-1)}>Exit walkthrough</button><button className="primary" onClick={advanceDemo} disabled={demoBusy}>{demoBusy ? "Working…" : demoStep === demoSteps.length - 1 ? "Finish walkthrough →" : `Next: ${demoSteps[demoStep + 1]?.action || "Finish"} →`}</button></div></section>}

      <section className="stats">
        <div className="stat"><span>Processes</span><strong>{state.processes.length}</strong><small>Current model</small></div>
        <div className="stat"><span>Resource types</span><strong>{state.resources.length}</strong><small>Configured classes</small></div>
        <div className="stat"><span>Available instances</span><strong>{state.available.reduce((a,b)=>a+b,0)}</strong><small>Total across resource types</small></div>
        <div className={`stat ${detection && !detection.safe ? "danger" : detection?.safe ? "good" : ""}`}><span>Deadlock detection</span><strong>{detection ? (detection.safe ? "No deadlock" : "Deadlock") : "Not checked"}</strong><small>{detection ? (detection.safe ? "No unfinished processes" : `${deadlocked.length} unfinished process(es)`) : "Run detection to analyze"}</small></div>
      </section>

      {message && <div role={["danger", "warning"].includes(getNoticeTone(message)) ? "alert" : "status"} aria-live={["danger", "warning"].includes(getNoticeTone(message)) ? "assertive" : "polite"} className={`notice ${getNoticeTone(message)}`}><span aria-hidden="true">{getNoticeTone(message) === "success" ? "✓" : getNoticeTone(message) === "danger" ? "!" : getNoticeTone(message) === "warning" ? "⚠" : "ℹ"}</span><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}
      {validationVisible && errors.length > 0 && <div className="validation-banner" role="alert"><strong>Model validation</strong><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}

      <div className="content-grid" id="graph">
        <section className="panel graph-panel">{isLabProjection && <div className="lab-projection-banner"><div><strong>Viewing Banker’s Lab projection</strong><p>The graph, matrices, and analysis controls now use a copy of the lab model. Banker’s safety and deadlock detection remain separate calculations.</p></div><button className="secondary" onClick={restorePreLabModel}>↶ Restore previous main model</button></div>}<div className="panel-head"><div><h2>Resource Allocation Graph</h2><p>Directed edges show current allocation and outstanding requests.</p></div><button onClick={detect} disabled={errors.length > 0 || modelLocked}>{isDetecting ? "Analyzing…" : "Run detection ↗"}</button></div>
          <Graph state={state} deadlocked={deadlocked} highlighted={currentActive} selectedNode={selectedGraphNode} onSelect={setSelectedGraphNode}/>
          {selectedGraphNode && <div className="graph-inspector"><div><span className="eyebrow">SELECTED {selectedGraphNode.type.toUpperCase()}</span><h3>{selectedGraphNode.type === "process" ? state.processes[selectedGraphNode.index] : state.resources[selectedGraphNode.index]}</h3></div><div className="graph-inspector-data">{selectedGraphNode.type === "process" ? <><span>Allocation <b>{vec(state.allocation[selectedGraphNode.index] || [])}</b></span><span>Request <b>{vec(state.request[selectedGraphNode.index] || [])}</b></span><span>Need <b>{vec(need[selectedGraphNode.index] || [])}</b></span><span>Status <b>{/\(terminated\)$/i.test(state.processes[selectedGraphNode.index]) ? "Terminated in simulation" : deadlocked.includes(state.processes[selectedGraphNode.index]) ? "Unfinished by detection" : "Active / not classified as deadlocked"}</b></span></> : <><span>Available <b>{state.available[selectedGraphNode.index]}</b></span><span>Allocated <b>{state.allocation.reduce((sum,row)=>sum+row[selectedGraphNode.index],0)}</b></span><span>Total instances <b>{state.total[selectedGraphNode.index]}</b></span><span>Outstanding requests <b>{state.request.reduce((sum,row)=>sum+row[selectedGraphNode.index],0)}</b></span></>}</div><button className="secondary" onClick={() => setSelectedGraphNode(null)}>Clear selection</button></div>}
          <div className="graph-footnote">Mint solid edge: Resource → Process allocation · Copper dashed edge: Process → Resource request · Edge labels show instance counts. Coral highlights cycles involving only single-instance resource types. With multiple instances, a cycle alone does not prove deadlock; matrix-based detection is authoritative.</div>
        </section>
        <section className="panel control-panel"><div className="panel-head"><div><h2>Analysis Console</h2><p>Detection and safety results remain independent.</p></div></div>
          <button className="primary full" onClick={detect} disabled={errors.length > 0 || isDetecting || isRecovering || isCheckingSafety}>{isDetecting ? "Analyzing current requests…" : "⌕ Detect deadlock"}</button>
          <button className="secondary full" onClick={checkSafety} disabled={errors.length > 0 || isDetecting || isRecovering || isCheckingSafety}>{isCheckingSafety ? "Checking safety…" : "✓ Check safe state (Banker’s)"}</button>
          <div className="control-divider"/>
          <div className="result-card"><div className="result-title">Deadlock detection <b className={!detection ? "muted" : detection.safe ? "ok" : "bad"}>{!detection ? "NOT RUN" : detection.safe ? "CLEAR" : "DEADLOCK"}</b></div><p>{!detection ? "Run the detection algorithm to inspect outstanding requests." : detection.safe ? `Completion sequence: ${detection.sequence.join(" → ") || "No unfinished processes"}` : `Unfinished: ${deadlocked.join(", ")}`}</p></div>
          <div className="result-card"><div className="result-title">Banker’s safety <b className={!safety ? "muted" : safety.safe ? "ok" : "bad"}>{!safety ? "NOT RUN" : safety.safe ? "SAFE" : "UNSAFE"}</b></div><p>{!safety ? "Run the safety algorithm to test the declared maximum claims." : safety.safe ? `Safe sequence: ${safety.sequence.join(" → ")}` : `Unable to finish: ${safety.unfinished.join(", ")}`}</p></div>
          {comparison && <div className={`algorithm-comparison comparison-${comparison.kind}`}><div className="eyebrow">WHY THE RESULTS DIFFER</div><h3>{comparison.title}</h3><p>{comparison.detail}</p><div className="comparison-vectors"><span><small>Detection Work</small><b>{detection ? vec(detection.work || []) : "Not run"}</b></span><span><small>Banker’s final Work</small><b>{safety ? vec(safety.work || []) : "Not run"}</b></span></div></div>}
          <p className="hint">Deadlock detection uses current Request. Banker’s safety uses Need = Maximum − Allocation. A safe-state result is not the same as a deadlock-detection result.</p>
        </section>
      </div>

      <section className="panel diagnosis-panel" id="diagnosis">
        <div className="panel-head"><div><div className="eyebrow">EXPLAINABLE OS ASSISTANT</div><h2><span className="assistant-mark">D</span> DAGLock Diagnosis Desk</h2><p>A rule-based assistant that explains the current matrix evidence, blocked processes and a recovery option.</p></div><span className="pill">Evidence-based · local rules</span></div>
        {!diagnosis ? <div className="diagnosis-empty"><div className="diagnosis-orbit"><span>?</span></div><div><strong>Run deadlock detection to start the diagnosis</strong><p>The assistant reads Available, Allocation and Request. It will not guess from the graph alone.</p></div><button className="primary" onClick={detect} disabled={errors.length > 0}>Analyze current state ↗</button></div> : !diagnosis.deadlocked ? <div className="diagnosis-clear"><span className="diagnosis-state-icon">✓</span><div><strong>No current deadlock reported</strong><p>{diagnosis.summary} If Banker’s safety reports unsafe, that is a separate maximum-claim analysis—not proof of a current deadlock.</p></div></div> : <>
          <div className="diagnosis-summary"><div className="diagnosis-alert-icon">!</div><div><strong>Why the system is stuck</strong><p>{diagnosis.summary}</p></div></div>
          <div className="diagnosis-columns">
            <div className="diagnosis-blockers"><h3>Blocked-process evidence</h3>{diagnosis.blockers.map(item=><div className="blocker-row" key={item.process}>
              <div className="blocker-process"><span className="process-chip">{item.process}</span><span>{item.allocated} instance(s) held</span></div>
              {item.waitingFor.length ? item.waitingFor.map(w=><p className="blocker-detail" key={w.resource}><b>{item.process}</b> requests <b>{w.count} × {w.resource}</b>, but only <b>{w.available}</b> are available.{w.holders.length ? ` Currently allocated to ${w.holders.map(h=>`${h.name} (${h.count})`).join(", ")}.` : " No other process currently holds this resource in the model."}</p>) : <p className="blocker-detail">The detection algorithm left this process unfinished; inspect its request vector and the current Work/Available values in Algorithm Studio.</p>}
            </div>)}</div>
            <div className="recovery-recommendation"><div className="eyebrow">SUGGESTED RECOVERY</div><h3>Consider terminating {diagnosis.victim || "a blocked process"}</h3><p>Victim selection uses the smallest currently allocated resource count among the unfinished processes as a simple recovery-cost heuristic. Faculty can choose another process and compare outcomes.</p>
              {diagnosis.victimIndex >= 0 && <div className="victim-stats"><span>Victim <b>{diagnosis.victim}</b></span><span>Resources to release <b>{state.allocation[diagnosis.victimIndex].join(" / ")}</b></span></div>}
              <button className="danger-btn" onClick={()=>recover(diagnosis.victimIndex)} disabled={errors.length > 0 || diagnosis.victimIndex < 0 || modelLocked}>Apply suggested recovery ↗</button>
              <button className="secondary full" onClick={()=>navTo("recovery")}>Open Recovery Lab</button>
              <small>This is a recommendation for an educational simulation, not a claim that one victim policy is always best.</small>
            </div>
          </div>
        </>}
      </section>

      <section className="panel studio-panel" id="studio">
        <div className="panel-head"><div><div className="eyebrow">STEP-BY-STEP EXPLAINABILITY</div><h2>Algorithm Studio</h2><p>Watch Work and Finish change, inspect the active process, and follow each decision.</p></div><span className="pill">Playback trace</span></div>
        {!traceSteps.length ? <div className="studio-empty"><div className="empty-symbol">▶</div><div><strong>Ready to walk through the algorithm</strong><p>Run deadlock detection or Banker’s safety above. Then use playback controls to inspect each step.</p></div></div> :
          <>
            <div className="trace-toolbar">
              <div className="trace-mode"><span className={`mode-dot ${traceForSafety ? "green" : "blue"}`}/><div><strong>{traceForSafety ? "Banker’s Safety Algorithm" : "Deadlock Detection Algorithm"}</strong><small>{traceSteps.length} trace steps · step {traceIndex + 1} of {traceSteps.length}</small></div></div>
              <div className="trace-actions"><button className="secondary" onClick={()=>{setIsPlaying(false);setTraceIndex(0)}}>↺ Restart</button><button className="secondary" onClick={()=>setIsPlaying(v=>!v)}>{isPlaying ? "Ⅱ Pause" : "▶ Play"}</button><button className="primary" onClick={()=>{setIsPlaying(false);setTraceIndex(i=>Math.min(traceSteps.length-1,i+1))}} disabled={traceIndex >= traceSteps.length-1}>Next step →</button><button className="secondary" onClick={()=>{setIsPlaying(false);setTraceIndex(i=>Math.max(0,i-1))}} disabled={traceIndex===0}>← Previous</button><button className="secondary" onClick={()=>{setIsPlaying(false);setTraceIndex(traceSteps.length-1)}}>Run to end</button></div>
            </div>
            <div className="trace-progress"><div style={{width:`${((traceIndex+1)/traceSteps.length)*100}%`}}/></div>
            <div className="trace-grid">
              <article className="trace-step-card"><div className="step-label">CURRENT STEP · {String(traceIndex+1).padStart(2,"0")}</div><h3>{currentTrace?.title}</h3><p>{currentTrace?.detail}</p><div className="trace-vectors"><div><span>Work vector</span><strong>{vec(currentTrace?.work || [])}</strong></div><div><span>Finish vector</span><strong>[{(currentTrace?.finish || []).map(v=>v?"T":"F").join(", ")}]</strong></div></div></article>
              <article className="trace-process-card"><h4>Process evaluation</h4><div className="process-list">{state.processes.map((p,i)=><div className={`process-row ${currentTrace?.active===i?"process-current":currentTrace?.finish?.[i]?"process-finished":""}`} key={p}><span className="process-token">{p}</span><span>{currentTrace?.finish?.[i] ? "Finished" : currentTrace?.active===i ? "Evaluating now" : "Waiting to be checked"}</span><b>{currentTrace?.finish?.[i] ? "✓" : currentTrace?.active===i ? "●" : "—"}</b></div>)}</div></article>
            </div>
            <div className="trace-matrix"><MatrixTable title={traceForSafety ? "Need matrix used by this step" : "Request matrix used by this step"} rows={currentTrace?.need || []} rowNames={state.processes} colNames={state.resources} highlightRow={currentTrace?.active ?? -1}/></div>
          </>}
      </section>

      <BankerLab onVisualizeModel={visualizeBankerModel} />

      <section className="panel matrices" id="matrices">
        <div className="panel-head"><div><div className="eyebrow">EDITABLE SYSTEM MODEL</div><h2>Matrices & Resource Model</h2><p>Edit the model to experiment. Total instances are recalculated from Available + Allocation.</p></div><span className="pill">Live model</span></div>
        <div className="matrix-grid">
          <MatrixTable title="Allocation" rows={state.allocation} rowNames={state.processes} colNames={state.resources} editable disabledAll={modelLocked} disabledRows={state.processes.map((p,i)=>/\(terminated\)$/i.test(p)?i:-1).filter(i=>i>=0)} onEdit={(i,j,v)=>updateCell("allocation",i,j,v)} highlightRow={currentTrace?.active ?? -1}/>
          <MatrixTable title="Outstanding Request" rows={state.request} rowNames={state.processes} colNames={state.resources} editable disabledAll={modelLocked} disabledRows={state.processes.map((p,i)=>/\(terminated\)$/i.test(p)?i:-1).filter(i=>i>=0)} onEdit={(i,j,v)=>updateCell("request",i,j,v)} highlightRow={traceKind==="detect" ? currentTrace?.active ?? -1 : -1}/>
          <MatrixTable title="Maximum Claim" rows={state.max} rowNames={state.processes} colNames={state.resources} editable disabledAll={modelLocked} disabledRows={state.processes.map((p,i)=>/\(terminated\)$/i.test(p)?i:-1).filter(i=>i>=0)} onEdit={(i,j,v)=>updateCell("max",i,j,v)} highlightRow={traceKind==="safety" ? currentTrace?.active ?? -1 : -1}/>
          <MatrixTable title="Need = Max − Allocation" rows={need} rowNames={state.processes} colNames={state.resources} highlightRow={traceKind==="safety" ? currentTrace?.active ?? -1 : -1}/>
        </div>
        <div className="available-editor"><h4>Available / Total</h4>{state.resources.map((r,j)=><label key={r}>{r}<span className="resource-input-pair"><MatrixCell value={state.available[j]} label={`${r} available`} disabled={modelLocked} onCommit={next=>updateAvailable(j,next)}/><small>of {state.total[j]} total</small></span></label>)}</div>
        <div className="model-actions"><button className="secondary" onClick={addProcess} disabled={state.processes.length >= 8 || modelLocked}>＋ Add process</button><button className="secondary" onClick={addResource} disabled={state.resources.length >= 6 || modelLocked}>＋ Add resource type</button><span className="hint">Limits: 8 processes · 6 resource types · keep at least one of each</span></div>
        <div className="entity-manager">
          <div className="entity-manager-head"><div><h3>Model configuration</h3><p>Remove a process or resource type. Changes apply to the live model and clear stale algorithm results.</p></div><span className="pill">Editable</span></div>
          <div className="entity-manager-grid">
            <section className="entity-list"><div className="entity-list-title"><strong>Processes</strong><span>{state.processes.length}/8</span></div>
              {state.processes.map((name,i)=><div className="entity-item" key={`${name}-${i}`}><span className="entity-symbol process-symbol">P</span><div className="entity-copy"><strong>{name}</strong><small>{state.allocation[i].reduce((a,b)=>a+b,0)} allocated · {state.request[i].reduce((a,b)=>a+b,0)} requested</small></div><button className="entity-delete" title={`Remove ${name}`} aria-label={`Remove ${name}`} onClick={()=>deleteProcess(i)} disabled={state.processes.length<=1 || modelLocked}>Remove</button></div>)}
            </section>
            <section className="entity-list"><div className="entity-list-title"><strong>Resource types</strong><span>{state.resources.length}/6</span></div>
              {state.resources.map((name,j)=>{const held=state.allocation.reduce((sum,row)=>sum+(row[j]||0),0);return <div className="entity-item" key={`${name}-${j}`}><span className="entity-symbol resource-symbol">R</span><div className="entity-copy"><strong>{name}</strong><small>{state.available[j]} available · {held} allocated · {state.total[j]} total</small></div><button className="entity-delete" title={held>0?`Release ${name} allocations before removal`:`Remove ${name}`} aria-label={`Remove ${name}`} onClick={()=>deleteResource(j)} disabled={state.resources.length<=1 || modelLocked}>Remove</button></div>})}
            </section>
          </div>
          <p className="entity-manager-note">Safety rules: at least one process and one resource type must remain. Removing a process returns its allocated resources to Available. A resource type with allocated instances must be released before it can be removed.</p>
        </div>
        {validationVisible && errors.length > 0 && <div className="inline-errors"><strong>Fix these issues before running an algorithm:</strong>{errors.map((e,i)=><p key={i}>• {e}</p>)}</div>}
      </section>

      <section className="panel scenario-panel" id="scenarios">
        <div className="panel-head"><div><div className="eyebrow">REPRODUCIBLE EXPERIMENTS</div><h2>Scenarios & Automated Tests</h2><p>Load a preset, create your own, or run the built-in correctness suite against the backend algorithms.</p></div><button className="primary" onClick={runTestSuite} disabled={!!testReport?.running || apiStatus !== "API connected" || modelLocked}>{testReport?.running ? "Running tests…" : "▶ Run all tests"}</button></div>
        <div className="scenario-grid">{allCases.map((c,i)=><button key={c.id || i} className={`scenario-card ${selectedCase===c.id?"selected":""}`} onClick={()=>chooseCase(c)} disabled={modelLocked || !!testReport?.running}>
          <div className="scenario-top"><span className={`scenario-icon s${i%5}`}>{c.expectedDeadlock ? "↔" : c.expectedSafe ? "✓" : "!"}</span><span className="scenario-load">Load ↗</span></div>
          <strong>{c.title}</strong><p>{c.description}</p><small>{c.processes.length} processes · {c.resources.length} resource types · {c.tag || "Custom"}</small>
        </button>)}</div>
        <div className="custom-save-row"><div className="field"><label>Save current model as a custom scenario</label><input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Give your scenario a name"/></div><button className="secondary" onClick={saveCustom} disabled={modelLocked || !!testReport?.running}>＋ Save current scenario</button></div>
        <p className="hint">Custom scenarios are saved in browser memory for this session. Refreshing the page clears custom scenarios.</p>
        {testReport && <div className="test-report">
          <div className="test-report-head"><div><h3>Automated test report</h3><p>{testReport.running ? "Calling the backend and checking actual outputs against expected outcomes." : "Preset outcomes, recovery conservation and invalid-model rejection are checked against expected results."}</p></div>{!testReport.running && <div className="test-summary"><strong className="ok">{testReport.passed} passed</strong><strong className={testReport.failed?"bad":"ok"}>{testReport.failed} failed</strong></div>}</div>
          {testReport.results.map((r,i)=><div className="test-row" key={i}><span className={`test-status ${r.pass?"pass":"fail"}`}>{r.pass?"PASS":"FAIL"}</span><div className="test-copy"><strong>{r.title}</strong><small>Expected: {r.expected}</small><small>Actual: {r.actual}</small></div><span className="test-check">{r.pass?"✓":"!"}</span></div>)}
        </div>}
      </section>

      <section className="panel recovery-panel" id="recovery">
        <div className="panel-head"><div><div className="eyebrow">RECOVERY EXPERIMENT</div><h2>Recovery Lab</h2><p>Terminate a process in the simulation, release its allocation and inspect the resulting state.</p></div><span className="pill">Simulated only</span></div>
        <div className="recovery-controls"><label>Process to terminate<select value={selectedProcess} onChange={e=>setSelectedProcess(e.target.value)} disabled={modelLocked}>{state.processes.every(p=>p.includes("(terminated)")) && <option value="">No active processes</option>}{state.processes.map((p,i)=><option value={i} key={i} disabled={p.includes("(terminated)")}>{p}</option>)}</select></label><button className="danger-btn" onClick={()=>recover()} disabled={errors.length>0 || modelLocked || selectedProcess==="" || !state.processes[Number(selectedProcess)] || state.processes[Number(selectedProcess)]?.includes("(terminated)")}>{isRecovering ? "⏳ Running recovery…" : "↻ Simulate process termination"}</button><button className="secondary" onClick={detect} disabled={modelLocked || errors.length>0}>{isDetecting ? "⏳ Analyzing…" : "Re-run deadlock detection"}</button></div>
        <p className="hint">Recovery is simulated in memory; no real operating-system process is terminated. The selected process releases its currently allocated instances.</p>
        <div className="recovery-compare-action"><div><strong>Compare recovery candidates</strong><p>Simulate terminating each active process in isolation, then compare detection and Banker’s safety without changing the live model.</p></div><button className="secondary" onClick={compareRecoveryOptions} disabled={isComparingRecovery || isRecovering || isDetecting || isCheckingSafety || errors.length>0}>{isComparingRecovery ? "Comparing…" : "Compare candidates ↗"}</button></div>
        {recoveryOptions && <div className="recovery-options"><div className="recovery-options-head"><div><div className="eyebrow">RECOVERY STRATEGY COMPARISON</div><h3>Candidate outcomes</h3><p>{recoveryOptions.note || "Candidates are evaluated against the current model."}</p></div>{!recoveryOptions.loading && <button className="secondary" onClick={()=>setRecoveryOptions(null)}>Close</button>}</div>{recoveryOptions.loading ? <p className="hint">Evaluating each active process…</p> : recoveryOptions.error ? <p className="inline-errors">{recoveryOptions.error}</p> : recoveryOptions.options.length === 0 ? <p className="hint">No active processes remain. Reset or load another scenario to compare candidates.</p> : <div className="recovery-option-grid">{recoveryOptions.options.map((option, index)=><article className={`recovery-option ${index===0?"recommended":""}`} key={option.process}><div className="recovery-option-top"><span className="rank">#{index+1}</span><strong>Terminate {option.process}</strong>{index===0&&<span className="pill">Best by heuristic</span>}</div><p>Would release {vec(option.released)} · {option.allocatedCost} held instance(s).</p><div className="option-results"><span>Detection <b className={option.detection.safe?"ok":"bad"}>{option.detection.safe?"CLEAR":"DEADLOCK"}</b></span><span>Banker’s safety <b className={option.safety.safe?"ok":"bad"}>{option.safety.safe?"SAFE":"UNSAFE"}</b></span></div><small>{option.detection.safe?`Completion: ${option.detection.sequence.join(" → ") || "none"}`:`Unfinished: ${option.detection.deadlockedProcesses.join(", ")}`}</small><button className={index===0?"danger-btn":"secondary"} onClick={()=>{setSelectedProcess(String(option.processIndex));recover(option.processIndex);}} disabled={isRecovering || isDetecting || isCheckingSafety}>Apply this recovery</button></article>)}</div>}</div>}
        {recoveryFeedback && <div className={`recovery-feedback feedback-${recoveryFeedback.kind}`} role="status" aria-live="polite"><span className="feedback-indicator">{recoveryFeedback.kind === "success" ? "✓" : recoveryFeedback.kind === "error" ? "!" : recoveryFeedback.kind === "warning" ? "!" : "…"}</span><div><strong>{recoveryFeedback.title}</strong><p>{recoveryFeedback.detail}</p></div></div>}
        {recoveryStory && <div className="recovery-sequence" key={recoveryStory.process}>
          <div className="recovery-sequence-head"><div><div className="eyebrow">LIVE RECOVERY SEQUENCE</div><h3>Resource release animation</h3></div><span className="pill">Simulation only</span></div>
          <div className="recovery-track">
            <div className={`recovery-stage ${["terminating"].includes(recoveryStory.stage) ? "stage-active" : "stage-done"}`}><span className="stage-number">01</span><div className="stage-visual"><span className="process-chip doomed">{recoveryStory.process}</span><span className="terminate-slash">×</span></div><strong>Terminate victim</strong><p>The selected process is marked as terminated in the model.</p></div>
            <div className="recovery-flow-arrow">→</div>
            <div className={`recovery-stage ${recoveryStory.stage === "releasing" ? "stage-active" : ["updating","verifying","verified"].includes(recoveryStory.stage) ? "stage-done" : ""}`}><span className="stage-number">02</span><div className="resource-token-row">{recoveryStory.released.map((count,j)=><span className={`resource-token ${count>0?"token-moving":""}`} key={j}>{state.resources[j] || `R${j+1}`} <b>+{count}</b></span>)}</div><strong>Release allocations</strong><p>Allocated instances return to the Available vector.</p></div>
            <div className="recovery-flow-arrow">→</div>
            <div className={`recovery-stage ${recoveryStory.stage === "updating" ? "stage-active" : ["verifying","verified"].includes(recoveryStory.stage) ? "stage-done" : ""}`}><span className="stage-number">03</span><div className="available-shift"><span>{(recoveryStory.beforeAvailable || []).join(", ")}</span><b>→</b><span>{(recoveryStory.afterAvailable || recoveryStory.beforeAvailable || []).join(", ")}</span></div><strong>Recompute availability</strong><p>Outstanding requests and the resource-conservation invariant are updated.</p></div>
            <div className="recovery-flow-arrow">→</div>
            <div className={`recovery-stage ${["verifying"].includes(recoveryStory.stage) ? "stage-active" : recoveryStory.stage === "verified" ? "stage-done" : ""}`}><span className="stage-number">04</span><div className="verify-orb">✓</div><strong>Verify again</strong><p>Run detection to check whether the remaining processes can proceed.</p><button className="secondary" onClick={detect} disabled={modelLocked || errors.length>0}>{isDetecting ? "Analyzing…" : "Run detection ↗"}</button>{recoveryStory.verification && <small className={`verification-result ${recoveryStory.verification}`}>{recoveryStory.verification === "clear" ? "✓ No deadlock detected" : "⚠ Deadlock remains"}</small>}</div>
          </div>
        </div>}
        {(recoveryBefore || recoveryAfter) && <div className="recovery-comparison">
          <div className="compare-card"><div className="compare-head"><h3>Before recovery</h3><span className="pill">Snapshot</span></div><Graph state={recoveryBefore || state} compact deadlocked={recoveryStory?.deadlockedBefore || []}/><div className="compare-available">{(recoveryBefore || state).resources.map((r,j)=><span key={r}>{r}: {(recoveryBefore || state).available[j]} available</span>)}</div></div>
          <div className="compare-arrow">→</div>
          <div className="compare-card"><div className="compare-head"><h3>After recovery</h3><span className="pill">Updated state</span></div><Graph state={recoveryAfter || state} compact deadlocked={detection?.deadlockedProcesses || []}/><div className="compare-available">{(recoveryAfter || state).resources.map((r,j)=><span key={r}>{r}: {(recoveryAfter || state).available[j]} available</span>)}</div></div>
        </div>}
      </section>

      <footer><span>DAGLock · Deadlock Detection, Avoidance & Recovery</span><span>React · Express · Banker’s Lab · Algorithm traces · Regression tests</span></footer>
    </main>
  </div>;
}
