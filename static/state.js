const STORAGE_KEY = "qcflows:circuit";

export const appState = {
  basis: "z",
  metric: "k",
  marker: null,
  numQubits: 5,
  operations: [],
  results: [],
  resultsByBasis: {},
  graphData: null,
  stale: true,
  stateData: null,
  timelineData: null,
  pendingGate: null,
};

export function appendOp(op) {
  appState.operations.push(op);
  markStale();
}

export function removeLastOp() {
  appState.operations.pop();
  markStale();
} 

export function resetOps() {
  appState.operations = [];
  markStale();
}


export function setBasis(basis) {
  appState.basis = basis;
  persist();
}

export function setMetric(metric) {
  appState.metric = metric;
}

export function setMarker(marker) {
  if (marker === null || marker === undefined || marker === "") {
    appState.marker = null;
    return;
  }
  const next = Number.parseInt(marker, 10);
  if (Number.isInteger(next) && next >= 0) {
    appState.marker = next;
  }
}

export function setNumQubits(numQubits) {
  const next = Number.parseInt(numQubits, 10);
  if (Number.isInteger(next) && next > 0) {
    appState.numQubits = next;
    appState.operations = [];
    appState.results = [];
    appState.resultsByBasis = {};
    appState.marker = null;
    markStale();
  }
}

export function setPendingGate(pendingGate) {
  appState.pendingGate = pendingGate ? {...pendingGate} : null;
}

export function clearStale() {
  appState.stale = false;
}

function markStale() {
  appState.stale = true;
  persist();
} 

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      operations: appState.operations,
      numQubits: appState.numQubits,
      basis: appState.basis,
    }));
  } catch (e) {
    console.warn("Failed to persist state", e);
  }
}


export function loadPersisted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.operations)) appState.operations = saved.operations;
    if (saved.numQubits) appState.numQubits = saved.numQubits;
    if (saved.basis) appState.basis = saved.basis;
  } catch (e) {
    console.warn("Failed to load persisted state", e);
  }
}
