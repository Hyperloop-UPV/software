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
  currentReading: "HVSCU/current_reading",
  tempMax: "HVSCU/temp_max",
  tempMin: "HVSCU/temp_min",
  imdOk: "HVSCU/imd_is_ok",
  sdcStatus: "HVSCU/sdc_status",
} as const;
