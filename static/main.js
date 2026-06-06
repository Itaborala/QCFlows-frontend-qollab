import {apiGet, apiPost} from "./api.js";
import {appState, setBasis, setMarker, setMetric, setNumQubits} from "./state.js";
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

initGraph(qubitId => {
  document.getElementById("single-qubit").value = qubitId;
});

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
      const gate = button.dataset.singleGate;
      const qubit = readInteger("single-qubit");
      runAction(() => apiPost(singleGateRoutes[gate], {qubit_id: qubit}));
    });
  });

  document.querySelectorAll("[data-rotation-gate]").forEach(button => {
    button.addEventListener("click", () => {
      const gate = button.dataset.rotationGate;
      const qubit = readInteger("single-qubit");
      const angle = Number.parseFloat(document.getElementById("rotation-angle").value);
      runAction(() => apiPost(rotationRoutes[gate], {qubit_id: qubit, angle}));
    });
  });

  document.querySelectorAll("[data-two-gate]").forEach(button => {
    button.addEventListener("click", () => {
      const gate = button.dataset.twoGate;
      const control = readInteger("control-qubit");
      const target = readInteger("target-qubit");
      runAction(() => apiPost(twoGateRoutes[gate], {control_id: control, target_id: target}));
    });
  });

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
    await refreshAll();
  } catch (error) {
    setStatus(error.message, "error");
  }
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
