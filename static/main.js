import {apiGet, apiPost} from "./api.js";
import {appState, setBasis, setMarker, setMetric, setNumQubits, setPendingGate} from "./state.js";
import {initGraph, renderGraph} from "./graph.js";
import {renderMatrix} from "./matrix.js";
import {
  renderBasisGrid,
  renderCircuit,
  renderGraphCaption,
  renderOperations,
  renderPanelError,
  renderStatevector,
  renderTimeline,
  setQubitInputs,
  setStatus,
} from "./views.js";

const singleGateRoutes = {
  H: "/apply_hadamard",
  X: "/apply_x",
  T: "/apply_t",
  S: "/apply_s",
  Z: "/apply_z",
  Y: "/apply_y",
};

const rotationRoutes = {
  RX: "/apply_rx",
  RY: "/apply_ry",
  RZ: "/apply_rz",
};

const twoGateRoutes = {
  CX: "/apply_cx",
  CZ: "/apply_cz",
};

initGraph(handleGraphNodeClick);
initCollapsibleSections();

bindControls();
setQubitInputs(appState.numQubits);
initialize();

function bindControls() {
  bindSegmented("basis-control", "basis", value => {
    setBasis(value);
    refreshAll();
  });
  bindSegmented("metric-control", "metric", value => {
    setMetric(value);
    refreshGraph();
  });

  document.getElementById("history-marker").addEventListener("input", event => {
    setMarker(event.target.value);
    renderTimeline(appState.timelineData, appState);
    refreshAll();
  });

  document.querySelectorAll("[data-single-gate]").forEach(button => {
    button.addEventListener("click", () => {
      toggleGatePlacement({gate: button.dataset.singleGate, kind: "single"});
    });
  });

  document.querySelectorAll("[data-rotation-gate]").forEach(button => {
    button.addEventListener("click", () => {
      toggleGatePlacement({gate: button.dataset.rotationGate, kind: "rotation"});
    });
  });

  document.querySelectorAll("[data-two-gate]").forEach(button => {
    button.addEventListener("click", () => {
      toggleGatePlacement({gate: button.dataset.twoGate, kind: "two", control: null});
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !appState.pendingGate) return;
    event.preventDefault();
    clearPendingGate("Ready");
  });

  syncGateButtonState();

  document.getElementById("set-qubits").addEventListener("click", () => {
    const requested = readInteger("qubit-count");
    runAction(async () => {
      const result = await apiPost("/set_num_qubits", {num_qubits: requested});
      setNumQubits(result.num_qubits || requested);
      setQubitInputs(appState.numQubits);
    });
  });

  document.getElementById("undo-gate").addEventListener("click", () => {
    runAction(() => apiPost("/remove_last_gate"));
  });

  document.getElementById("reset-circuit").addEventListener("click", () => {
    runAction(() => apiPost("/reset_circuit"));
  });

  document.getElementById("import-qasm").addEventListener("click", () => {
    const qasm = document.getElementById("qasm-input").value;
    runAction(async () => {
      const result = await apiPost("/import_qasm", {qasm});
      if (result.num_qubits) {
        setNumQubits(result.num_qubits);
        setQubitInputs(appState.numQubits);
      }
    });
  });

  document.getElementById("load-current-qasm").addEventListener("click", async () => {
    try {
      setStatus("Loading QASM");
      const result = await apiGet("/export_qasm");
      document.getElementById("qasm-input").value = result.qasm || "";
      setStatus("Ready", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
}

async function refreshAll() {
  setStatus("Loading");
  const results = await Promise.allSettled([
    refreshGraph(),
    refreshState(),
    refreshCircuit(),
  ]);
  const failed = results.filter(result => result.status === "rejected");
  setStatus(failed.length ? "Backend missing" : "Ready", failed.length ? "error" : "ok");
}

async function initialize() {
  await refreshTimeline();
  await refreshAll();
}

async function refreshTimeline() {
  try {
    const data = await apiGet("/timeline");
    appState.timelineData = data;
    if (appState.marker === null && Number.isInteger(Number(data.current_marker))) {
      setMarker(data.current_marker);
    }
    renderTimeline(data, appState);
  } catch {
    appState.timelineData = null;
    setMarker(null);
    renderTimeline(null, appState);
  }
}

async function refreshGraph() {
  const params = new URLSearchParams({basis: appState.basis, metric: appState.metric});
  appendMarker(params);
  try {
    const data = await apiGet(`/graph_data?${params.toString()}`);
    appState.graphData = data;
    const nodeCount = Array.isArray(data.nodes) ? data.nodes.length : appState.numQubits;
    setNumQubits(nodeCount);
    setQubitInputs(appState.numQubits);
    renderGraph(data, appState);
    renderMatrix(data, appState);
    renderGraphCaption(appState, data);
  } catch (error) {
    appState.graphData = null;
    renderGraph(null, appState);
    renderMatrix(null, appState);
    throw error;
  }
}

async function refreshState() {
  const params = new URLSearchParams({basis: appState.basis});
  appendMarker(params);
  try {
    const data = await apiGet(`/get_state?${params.toString()}`);
    appState.stateData = data;
    renderStatevector(data);
    renderBasisGrid(data);
  } catch (error) {
    renderPanelError("statevector", "Statevector unavailable.");
    renderPanelError("basis-grid", "States unavailable.");
    throw error;
  }
}

async function refreshCircuit() {
  const params = new URLSearchParams();
  appendMarker(params);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  try {
    const data = await apiGet(`/get_circuit${suffix}`);
    renderOperations(data);
    renderCircuit(data);
  } catch (error) {
    renderPanelError("operations-list", "Operations unavailable.");
    renderPanelError("circuit", "Circuit unavailable.");
    throw error;
  }
}

async function runAction(action) {
  try {
    setStatus("Updating");
    await action();
    await refreshTimeline();
    selectLatestMarker();
    await refreshAll();
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    return false;
  }
}

async function handleGraphNodeClick(qubitId) {
  const pending = appState.pendingGate;
  const qubit = normalizeQubitId(qubitId);

  if (!pending) return;

  if (pending.kind === "single") {
    const ok = await runAction(() => apiPost(singleGateRoutes[pending.gate], {qubit_id: qubit}));
    if (ok) clearPendingGate("Ready");
    return;
  }

  if (pending.kind === "rotation") {
    const angle = Number.parseFloat(document.getElementById("rotation-angle").value);
    const ok = await runAction(() => apiPost(rotationRoutes[pending.gate], {qubit_id: qubit, angle}));
    if (ok) clearPendingGate("Ready");
    return;
  }

  if (pending.kind === "two") {
    if (pending.control === null || pending.control === undefined) {
      setPendingGate({...pending, control: qubit});
      syncGateButtonState();
      renderGraph(appState.graphData, appState);
      setStatus(gatePlacementPrompt(appState.pendingGate));
      return;
    }

    if (sameQubit(pending.control, qubit)) {
      setStatus(`${pending.gate} target must differ from control.`, "error");
      return;
    }

    const control = normalizeQubitId(pending.control);
    const ok = await runAction(() => apiPost(twoGateRoutes[pending.gate], {
      control_id: control,
      target_id: qubit,
    }));
    if (ok) clearPendingGate("Ready");
  }
}

function toggleGatePlacement(nextGate) {
  const pending = appState.pendingGate;
  if (pending?.gate === nextGate.gate && pending?.kind === nextGate.kind) {
    clearPendingGate("Ready");
    return;
  }

  setPendingGate(nextGate);
  syncGateButtonState();
  renderGraph(appState.graphData, appState);
  setStatus(gatePlacementPrompt(appState.pendingGate));
}

function clearPendingGate(message = "") {
  setPendingGate(null);
  syncGateButtonState();
  renderGraph(appState.graphData, appState);
  if (message) setStatus(message, message === "Ready" ? "ok" : "neutral");
}

function syncGateButtonState() {
  document.querySelectorAll("[data-single-gate], [data-rotation-gate], [data-two-gate]").forEach(button => {
    const gate = button.dataset.singleGate || button.dataset.rotationGate || button.dataset.twoGate;
    const active = appState.pendingGate?.gate === gate;
    button.classList.toggle("active-tool", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function gatePlacementPrompt(pending) {
  if (!pending) return "Ready";
  if (pending.kind === "two" && pending.control !== null && pending.control !== undefined) {
    return `${pending.gate} control q${pending.control}; click a different target node.`;
  }
  if (pending.kind === "two") {
    return `${pending.gate} selected; click the control qubit node.`;
  }
  return `${pending.gate} selected; click a qubit node.`;
}

function normalizeQubitId(qubitId) {
  const value = Number.parseInt(qubitId, 10);
  return Number.isInteger(value) ? value : 0;
}

function sameQubit(first, second) {
  return String(first) === String(second);
}

function selectLatestMarker() {
  const current = appState.timelineData?.current_marker;
  if (!Number.isInteger(Number(current))) return;
  setMarker(current);
  renderTimeline(appState.timelineData, appState);
}

function appendMarker(params) {
  if (appState.marker !== null) {
    params.set("marker", String(appState.marker));
  }
}

function bindSegmented(id, dataKey, handler) {
  document.getElementById(id).addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    for (const item of event.currentTarget.querySelectorAll("button")) {
      item.classList.toggle("active", item === button);
    }
    handler(button.dataset[dataKey]);
  });
}

function readInteger(id) {
  const value = Number.parseInt(document.getElementById(id).value, 10);
  return Number.isInteger(value) ? value : 0;
}

function initCollapsibleSections() {
  document.querySelectorAll("[data-collapsible]").forEach((section, index) => {
    const sourceHeader = section.querySelector(":scope > .panel-header") || section.querySelector(":scope > h2");
    if (!sourceHeader) return;

    const key = section.dataset.collapseKey || String(index);
    const content = document.createElement("div");
    content.className = "collapsible-content";
    content.id = `collapse-${key}`;

    const {anchor, heading, label} = prepareCollapseHeading(section, sourceHeader);
    const toggle = createCollapseToggle(content.id);
    heading.insertBefore(toggle, heading.firstChild);

    let next = anchor.nextSibling;
    while (next) {
      const current = next;
      next = next.nextSibling;
      content.appendChild(current);
    }
    section.appendChild(content);

    const stored = readCollapseState(key);
    const collapsed = stored ?? section.dataset.collapseDefault === "closed";
    setCollapsed(section, content, toggle, collapsed, label);

    toggle.addEventListener("click", () => {
      const nextCollapsed = section.dataset.collapsed !== "true";
      setCollapsed(section, content, toggle, nextCollapsed, label);
      writeCollapseState(key, nextCollapsed);
      if (!nextCollapsed) refreshExpandedSection(section);
    });
  });
}

function prepareCollapseHeading(section, sourceHeader) {
  if (sourceHeader.matches("h2")) {
    const heading = document.createElement("div");
    heading.className = "collapse-heading";
    section.insertBefore(heading, sourceHeader);
    heading.appendChild(sourceHeader);
    return {
      anchor: heading,
      heading,
      label: sourceHeader.textContent.trim() || "Section",
    };
  }

  const title = sourceHeader.querySelector("h2");
  const heading = document.createElement("div");
  heading.className = "collapse-heading";
  if (title) {
    sourceHeader.insertBefore(heading, title);
    heading.appendChild(title);
  } else {
    sourceHeader.insertBefore(heading, sourceHeader.firstChild);
  }

  return {
    anchor: sourceHeader,
    heading,
    label: title?.textContent.trim() || "Section",
  };
}

function createCollapseToggle(contentId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "collapse-toggle";
  button.setAttribute("aria-controls", contentId);

  const icon = document.createElement("span");
  icon.className = "collapse-icon";
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);
  return button;
}

function setCollapsed(section, content, toggle, collapsed, label) {
  section.dataset.collapsed = collapsed ? "true" : "false";
  content.hidden = collapsed;
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  const action = collapsed ? "Expand" : "Collapse";
  toggle.setAttribute("aria-label", `${action} ${label}`);
  toggle.title = `${action} ${label}`;
}

function refreshExpandedSection(section) {
  requestAnimationFrame(() => {
    if (section.querySelector("#metric-matrix")) {
      renderMatrix(appState.graphData, appState);
    }
    if (section.querySelector("#graph")) {
      renderGraph(appState.graphData, appState);
    }
  });
}

function readCollapseState(key) {
  try {
    const value = localStorage.getItem(collapseStorageKey(key));
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    return null;
  }
  return null;
}

function writeCollapseState(key, collapsed) {
  try {
    localStorage.setItem(collapseStorageKey(key), collapsed ? "true" : "false");
  } catch {
    // Ignore storage failures; collapse state is still applied for the current session.
  }
}

function collapseStorageKey(key) {
  return `qcflows:collapse:${key}`;
}
