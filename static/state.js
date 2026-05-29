export const appState = {
  basis: "z",
  metric: "k",
  numQubits: 5,
  graphData: null,
  stateData: null,
};

export function setBasis(basis) {
  appState.basis = basis;
}

export function setMetric(metric) {
  appState.metric = metric;
}

export function setNumQubits(numQubits) {
  const next = Number.parseInt(numQubits, 10);
  if (Number.isInteger(next) && next > 0) {
    appState.numQubits = next;
  }
}
