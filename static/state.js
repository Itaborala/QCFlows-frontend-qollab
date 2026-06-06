export const appState = {
  basis: "z",
  metric: "k",
  marker: null,
  numQubits: 5,
  graphData: null,
  stateData: null,
  timelineData: null,
};

export function setBasis(basis) {
  appState.basis = basis;
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
  }
}
