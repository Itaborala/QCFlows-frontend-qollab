# QCFlows Frontend

Static frontend for the Quantum Correlation Flows project.

## Expected backend routes

Currently expects QAG-compatible HTTP endpoints, including:

`/graph_data`, `/get_state`, `/get_circuit`, `/get_operations`,
`/get_qubit_states`, `/set_qubit_state`, `/set_num_qubits`,
`/update_operation_params`, `/reorder_operations`,
`/reorder_operations_cross_qubit`, `/import_qasm`, `/export_qasm`,
`/reset_circuit`, `/remove_last_gate`, `/apply_hadamard`, `/apply_x`,
`/apply_t`, `/apply_s`, `/apply_z`, `/apply_y`, `/apply_cx`, `/apply_cz`,
`/apply_rx`, `/apply_ry`, `/apply_rz`, `/apply_mcx`, `/apply_qft`,
`/apply_oracle`, `/apply_diffuser`, `/apply_grover_layer`,
`/apply_qaoa_layer`, and `/teleport`.
