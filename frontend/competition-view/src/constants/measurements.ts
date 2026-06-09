/**
 * Backend telemetry measurement IDs.
 * Centralised here so every component imports a named constant
 * rather than an inline magic string.
 */
export const VCU = {
  generalState:     "VCU/general_state",
  operationalState: "VCU/operational_state",
  allReeds:         "VCU/all_reeds",
  highPressure:     "VCU/pressure_high",
  pressureBrakes:   "VCU/pressure_brakes",
  pressureCapsule:  "VCU/pressure_capsule",
} as const;

export const PCU = {
  speed:         "PCU/encoder_speed_km_h",
  position:      "PCU/encoder_position",
  acceleration:  "PCU/encoder_acceleration",
  // DLIM phase currents (motor A)
  motorCurrentU: "PCU/current_sensor_u_a",
  motorCurrentV: "PCU/current_sensor_v_a",
  motorCurrentW: "PCU/current_sensor_w_a",
} as const;

export const PCU_BOARD = {
  generalState:   "PCU/general_state_machine",
  operatingState: "PCU/operational_state_machine",
  peakCurrent:    "PCU/current_Peak",
  frequency:      "PCU/frequency",
} as const;

/** BCU (Booster Control Unit) — LSM phase currents and board states. */
export const BCU = {
  averageCurrentU:  "BCU/average_current_u",
  averageCurrentV:  "BCU/average_current_v",
  averageCurrentW:  "BCU/average_current_w",
  generalState:     "BCU/bcu_general_state",
  operationalState: "BCU/bcu_operational_state",
  nestedState:      "BCU/bcu_nested_state",
} as const;

/** HVBMS — high-voltage battery management system. */
export const HVBMS = {
  minimumSoc:       "HVBMS/minimum_soc",
  voltageReading:   "HVBMS/voltage_reading",
  batteriesVoltage: "HVBMS/batteries_voltage_reading",
  currentReading:   "HVBMS/current_reading",
  tempMax:          "HVBMS/temp_max",
  tempMin:          "HVBMS/temp_min",
  voltageMax:       "HVBMS/voltage_max",
  voltageMin:       "HVBMS/voltage_min",
  imdOk:            "HVBMS/imd_is_ok",
  sdcStatus:        "HVBMS/sdc_status",
  operationalState: "HVBMS/operational_state_machine_status",
} as const;

/** HVBMS-Cabinet — supercapacitor bank and HV bus. */
export const HVBMS_CABINET = {
  contactorsState:       "HVBMS-Cabinet/HVBMS-Cabinet_contactors_state",
  busVoltage:            "HVBMS-Cabinet/HVBMS-Cabinet_bus_voltage",
  outputCurrent:         "HVBMS-Cabinet/HVBMS-Cabinet_output_current",
  sdcGood:               "HVBMS-Cabinet/HVBMS-Cabinet_sdc_good",
  totalSupercapsVoltage: "HVBMS-Cabinet/HVBMS-Cabinet_total_supercaps_voltage",
} as const;

/** Per-pack indices are 1-based (1–18). */
export const hvbmsPack = (n: number) => ({
  soc:         `HVBMS/battery${n}_SOC`,
  temperature: `HVBMS/battery${n}_temperature1`,
  voltage:     `HVBMS/battery${n}_total_voltage`,
  cell1:       `HVBMS/battery${n}_cell1`,
  cell2:       `HVBMS/battery${n}_cell2`,
  cell3:       `HVBMS/battery${n}_cell3`,
  cell4:       `HVBMS/battery${n}_cell4`,
  cell5:       `HVBMS/battery${n}_cell5`,
  cell6:       `HVBMS/battery${n}_cell6`,
});

/** LVBMS — low-voltage battery management system. */
export const LVBMS = {
  cells:        ["LVBMS/cell_1","LVBMS/cell_2","LVBMS/cell_3","LVBMS/cell_4","LVBMS/cell_5","LVBMS/cell_6"] as string[],
  soc:          "LVBMS/SOC",
  totalVoltage: "LVBMS/total_voltage",
  voltageMin:   "LVBMS/voltage_min",
  voltageMax:   "LVBMS/voltage_max",
  tempMin:      "LVBMS/temp_min",
  tempMax:      "LVBMS/temp_max",
  current:      "LVBMS/current",
  generalState: "LVBMS/state",
} as const;

/** BLCU — bootloader control unit (firmware flashing). */
export const BLCU = {
  state: "BLCU/state",
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
