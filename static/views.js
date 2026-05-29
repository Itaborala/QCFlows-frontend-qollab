export function setStatus(message, tone = "neutral") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.dataset.tone = tone;
}

export function renderGraphCaption(state, data) {
  const caption = document.getElementById("graph-caption");
  const metric = data?.metric_label || state.metric.toUpperCase();
  caption.textContent = `${metric}, ${state.basis.toUpperCase()} basis`;
}

export function renderCircuit(data) {
  const container = document.getElementById("circuit");
  container.innerHTML = data?.circuit_diagram || "No circuit.";
}

export function renderStatevector(data) {
  const target = document.getElementById("statevector");
  const amplitudes = data?.amplitudes || [];
  if (!amplitudes.length) {
    target.textContent = "No statevector.";
    return;
  }
  target.textContent = amplitudes
    .filter(item => Number(item.magnitude_squared ?? 0) > 1e-6)
    .map(item => `${formatComplex(item.amplitude)} ${item.basis_state}`)
    .join("\n") || "0";
}

export function renderBasisGrid(data) {
  const container = document.getElementById("basis-grid");
  const amplitudes = data?.amplitudes || [];
  container.innerHTML = "";
  if (!amplitudes.length) {
    container.textContent = "No amplitudes.";
    return;
  }

  const bits = bitCount(amplitudes);
  const columns = Math.pow(2, Math.ceil(bits / 2));
  container.style.gridTemplateColumns = `repeat(${columns}, minmax(42px, 1fr))`;

  for (const item of amplitudes) {
    const probability = Number(item.magnitude_squared ?? 0);
    const amplitude = item.amplitude || [0, 0];
    const phase = Math.atan2(amplitude[1] || 0, amplitude[0] || 0);
    const hue = ((phase * 180 / Math.PI) + 360) % 360;
    const cell = document.createElement("div");
    cell.className = "basis-cell";
    cell.style.background = `hsl(${hue}, 74%, ${96 - Math.min(48, probability * 80)}%)`;
    cell.innerHTML = `<span>${item.basis_state}</span><strong>${probability.toFixed(3)}</strong>`;
    container.appendChild(cell);
  }
}

export function renderPanelError(id, message) {
  const element = document.getElementById(id);
  if (element) element.textContent = message;
}

export function setQubitInputs(numQubits) {
  document.getElementById("qubit-count").max = 12;
  document.getElementById("qubit-count").value = numQubits;
  for (const id of ["single-qubit", "control-qubit", "target-qubit"]) {
    const input = document.getElementById(id);
    input.max = Math.max(0, numQubits - 1);
  }
}

function formatComplex(value = [0, 0]) {
  const real = Number(value[0] || 0);
  const imag = Number(value[1] || 0);
  if (Math.abs(imag) < 1e-9) return real.toFixed(3);
  if (Math.abs(real) < 1e-9) return `${imag.toFixed(3)}i`;
  return `${real.toFixed(3)} ${imag < 0 ? "-" : "+"} ${Math.abs(imag).toFixed(3)}i`;
}

function bitCount(amplitudes) {
  const first = amplitudes[0]?.basis_state || "|0>";
  const match = first.match(/[01]+/);
  return match ? match[0].length : 1;
}
