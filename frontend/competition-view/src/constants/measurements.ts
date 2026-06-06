/**
 * Backend telemetry measurement IDs.
 * Centralised here so every component imports a named constant
 * rather than an inline magic string.
 */
export const VCU = {
  generalState: "VCU/general_state",
  operationalState: "VCU/operational_state",
  allReeds: "VCU/all_reeds",
  highPressure: "VCU/high_pressure",
  pressureBrakes: "VCU/pressure_brakes",
  pressureCapsule: "VCU/pressure_capsule",
} as const;

export const PCU = {
  speed: "PCU/speetec_velocity",
  position: "PCU/speetec_position",
  acceleration: "PCU/speetec_accel",
} as const;

export const HVSCU = {
  minimumSoc: "HVSCU/minimum_soc",
  voltageReading: "HVSCU/voltage_reading",
  batteriesVoltage: "HVSCU/batteries_voltage_reading",
  currentReading: "HVSCU/current_reading",
  tempMax: "HVSCU/temp_max",
  tempMin: "HVSCU/temp_min",
  voltageMax: "HVSCU/voltage_max",
  voltageMin: "HVSCU/voltage_min",
  imdOk: "HVSCU/imd_is_ok",
  sdcStatus: "HVSCU/sdc_status",
  contactors: "HVSCU/contactors_state",
  operationalState: "HVSCU/operational_state_machine_status",
} as const;

/** Per-pack indices are 1-based (1–10). */
const obccuPackKey = (n: number, suffix: string) => `OBCCU/${suffix}${n}` as const;

/** Generates the measurement key set for a single OBCCU battery pack (1–10). */
export const obccuPack = (n: number) => ({
  soc:         obccuPackKey(n, "SOC"),
  temperature: `OBCCU/battery_temperature_${n}`,
  maxCell:     `OBCCU/maximum_cell_${n}`,
  minCell:     `OBCCU/minimum_cell_${n}`,
  voltage:     `OBCCU/total_voltage${n}`,
  isBalancing: `OBCCU/is_balancing${n}`,
});

export const BMSL = {
  cells:        ["BMSL/cell_1","BMSL/cell_2","BMSL/cell_3","BMSL/cell_4","BMSL/cell_5","BMSL/cell_6"] as string[],
  soc:          "BMSL/SOC",
  totalVoltage: "BMSL/total_voltage",
  voltageMin:   "BMSL/voltage_min",
  voltageMax:   "BMSL/voltage_max",
  tempMin:      "BMSL/temp_min",
  tempMax:      "BMSL/temp_max",
  current:      "BMSL/current",
  generalState: "BMSL/general_state",
} as const;

export const LCU = {
  // Airgaps — vertical (V1–V4) and horizontal (H1–H4)
  verticalAirgap1:   "LCU/lcu_airgap_1",
  verticalAirgap2:   "LCU/lcu_airgap_2",
  verticalAirgap3:   "LCU/lcu_airgap_3",
  verticalAirgap4:   "LCU/lcu_airgap_4",
  horizontalAirgap1: "LCU/lcu_airgap_5",
  horizontalAirgap2: "LCU/lcu_airgap_6",
  horizontalAirgap3: "LCU/lcu_airgap_7",
  horizontalAirgap4: "LCU/lcu_airgap_8",
  // Position control outputs
  positionY:      "LCU/dist_control_y",
  positionZ:      "LCU/dist_control_z",
  // Rotation control outputs
  rotationPitch:  "LCU/rot_control_y",
  rotationRoll:   "LCU/rot_control_x",
  rotationYaw:    "LCU/rot_control_z",
  // State
  generalState:   "LCU/general_state",
} as const;

export const PCU_BOARD = {
  generalState:   "PCU/general_state",
  operatingState: "PCU/operating_state",
  peakCurrent:    "PCU/peak_current",
  motorATemp:     "PCU/motor_a_temp_u",
  motorBTemp:     "PCU/motor_b_temp_v",
  frequency:      "PCU/target_frequency",
} as const;
