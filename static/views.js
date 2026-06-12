const GATE_SYMBOL = {h: "H", x: "X", y: "Y", z: "Z", cx: "CX", cy: "CY", cz: "CZ", swap: "SWAP"};

export function setStatus(message, tone = "neutral") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.dataset.tone = tone;
}

export function renderGraphCaption(state, data) {
  const caption = document.getElementById("graph-caption");
  const metric = data?.metric_label || state.metric.toUpperCase();
  const markerLabel = data?.marker_label ? `, ${data.marker_label}` : "";
  caption.textContent = `${metric}, ${state.basis.toUpperCase()} basis${markerLabel}`;
}

//export function renderCircuit(data) {
  //const container = document.getElementById("circuit");
  //container.innerHTML = data?.circuit_diagram || "No circuit.";
//}

export function renderCircuit(operations, numQubits) {
  const container = document.getElementById("circuit");
  if (!container) return;

  const n = Math.max(numQubits, 1);
  const rowCount = 2 * n - 1;
  const labelWidth = `q${n - 1}: `.length;


  const lines = Array.from({length: rowCount}, (_, r) => 
    r % 2 === 0 ? `q${r / 2}: `.padEnd(labelWidth, " ") : " ".repeat(labelWidth)
  );

  const columns = operations.map(op => buildColumn(op, n));
  if (!columns.length) {
    for (let r = 0; r < rowCount; r++) {
      if (r % 2 === 0) lines[r] += "─".repeat(3);
    }
  }
  for (const col of columns) {
    for (let r = 0; r < rowCount; r++) {
      lines[r] += r % 2 === 0 ? col.wire[r / 2] : col.gap[(r - 1) / 2];
    }
  }

  container.textContent = lines.join("\n");
}

function buildColumn(op, n) {
  const labels = Array.from({length: n}, () => "");
  const connect = Array.from({length: Math.max(0, n - 1)}, () => false);

    if (op.qubits.length === 1) {
      const sym = GATE_SYMBOL[op.gate] || op.gate.toUpperCase();
      labels[op.qubits[0]] = ` ${sym} `;
  } else {
    const [control, target] = op.qubits;
    labels[control] = "\u25CF";                                  // ● control
    labels[target] = op.gate === "cz" ? " Z " : " X ";
    const lo = Math.min(control, target);
    const hi = Math.max(control, target);
    for (let g = lo; g < hi; g++) connect[g] = true;
  }

  const width = Math.max(1, ...labels.map(s => s.length)) + 2;
  const center = Math.floor(width / 2);

  const wire = labels.map(s => {
    if (!s) return "\u2500".repeat(width);                       // ─ fill
    const pad = width - s.length;
    const left = Math.floor(pad / 2);
    return "\u2500".repeat(left) + s + "\u2500".repeat(pad - left);
  });

  const gap = connect.map(on => {
    if (!on) return " ".repeat(width);
    const cells = Array.from({length: width}, () => " ");
    cells[center] = "\u2502";                                    // │ connector
    return cells.join("");
  });

  return {wire, gap};
}


export function renderOperations(operations) {
  const container = document.getElementById("operations-list");
  if (!container) return;

  //const operations = Array.isArray(data?.operations) ? data.operations : [];
  container.innerHTML = "";
  if (!operations.length) {
    container.textContent = "Input state.";
    return;
  }
  operations.forEach((op, index) => {
    const chip = document.createElement("span");
    chip.className = "operation-chip";
    chip.textContent = formatOperation(op, index + 1);
    container.appendChild(chip);
  });
}

  //for (const operation of operations) {
    //const item = document.createElement("span");
    //item.className = "operation-chip";
    //item.textContent = `${operation.id}. ${operation.label || operation.gate}`;
    //container.appendChild(item);
  //}
//}

function formatOperation(op, index) {
  const gate = op.gate.toUpperCase();
  const qubits = op.qubits.join(",");
  const angle = op.params?.angle;
  return angle != null
    ? `${index}. ${gate}(${Number(angle).toFixed(3)})[${qubits}]`
    : `${index}. ${gate}[${qubits}]`;
}

export function renderTimeline(data, state) {
  const input = document.getElementById("history-marker");
  const label = document.getElementById("history-label");
  const count = document.getElementById("history-count");
  if (!input || !label || !count) return;

  const markers = Array.isArray(data?.markers) ? data.markers : [];
  if (!markers.length) {
    input.disabled = true;
    input.min = 0;
    input.max = 0;
    input.value = 0;
    label.textContent = "Latest";
    count.textContent = "-";
    return;
  }

  const ids = markers.map(marker => Number(marker.id)).filter(Number.isInteger);
  const min = Math.min(...ids);
  const max = Math.max(...ids);
  const current = state.marker ?? Number(data.current_marker ?? max);
  const active = markers.find(marker => Number(marker.id) === current) || markers[markers.length - 1];

  input.disabled = false;
  input.min = min;
  input.max = max;
  input.step = 1;
  input.value = Number(active.id);
  label.textContent = active.label || `Marker ${active.id}`;
  count.textContent = `${active.id}/${max}`;
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
  const match = first.match(/\|(.+)>/);
  return match ? match[1].length : 1;
}
