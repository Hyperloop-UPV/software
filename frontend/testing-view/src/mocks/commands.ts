import type { BoardName } from "../types/BoardName";
import type { Command } from "../types/Command";

// Mock Commands - Structured by ECU
export const MOCK_COMMANDS: Record<BoardName, Command[]> = {
  BCU: [
    {
      id: "bcu_read_voltage",
      name: "Read Voltage",
      description: "Read battery pack voltage",
    },
    {
      id: "bcu_read_current",
      name: "Read Current",
      description: "Read battery pack current",
    },
    {
      id: "bcu_read_temp",
      name: "Read Temperature",
      description: "Read battery temperature sensors",
    },
    {
      id: "bcu_read_soc",
      name: "Read SOC",
      description: "Read state of charge percentage",
    },
    {
      id: "bcu_read_soh",
      name: "Read SOH",
      description: "Read state of health percentage",
    },
    {
      id: "bcu_balance_cells",
      name: "Balance Cells",
      description: "Start cell balancing routine",
      dangerous: true,
    },
    {
      id: "bcu_reset_counters",
      name: "Reset Counters",
      description: "Reset charge/discharge counters",
    },
    {
      id: "bcu_calibrate",
      name: "Calibrate Sensors",
      description: "Calibrate voltage and current sensors",
      parameters: [{ name: "sensor_type", type: "string", required: true }],
    },
    {
      id: "bcu_read_history",
      name: "Read History",
      description: "Read battery usage history",
    },
    {
      id: "bcu_emergency_disconnect",
      name: "Emergency Disconnect",
      description: "Emergency battery disconnect",
      dangerous: true,
    },
  ],

  PCU: [
    {
      id: "pcu_read_power",
      name: "Read Power",
      description: "Read current power output",
    },
    {
      id: "pcu_set_power_limit",
      name: "Set Power Limit",
      description: "Set maximum power output limit",
      parameters: [{ name: "limit_kw", type: "number", required: true }],
    },
    {
      id: "pcu_read_efficiency",
      name: "Read Efficiency",
      description: "Read power conversion efficiency",
    },
    {
      id: "pcu_enable_regen",
      name: "Enable Regeneration",
      description: "Enable regenerative braking",
    },
    {
      id: "pcu_disable_regen",
      name: "Disable Regeneration",
      description: "Disable regenerative braking",
    },
    {
      id: "pcu_read_inverter_temp",
      name: "Read Inverter Temp",
      description: "Read inverter temperature",
    },
    {
      id: "pcu_reset_faults",
      name: "Reset Faults",
      description: "Clear power system faults",
    },
    {
      id: "pcu_run_diagnostics",
      name: "Run Diagnostics",
      description: "Execute power system diagnostics",
    },
    {
      id: "pcu_set_mode",
      name: "Set Mode",
      description: "Set power control mode",
      parameters: [{ name: "mode", type: "string", required: true }],
    },
    {
      id: "pcu_emergency_shutdown",
      name: "Emergency Shutdown",
      description: "Emergency power system shutdown",
      dangerous: true,
    },
  ],

  LCU: [
    {
      id: "lcu_read_status",
      name: "Read Status",
      description: "Read system status flags",
    },
    {
      id: "lcu_set_operation_mode",
      name: "Set Operation Mode",
      description: "Set vehicle operation mode",
      parameters: [{ name: "mode", type: "string", required: true }],
    },
    {
      id: "lcu_read_inputs",
      name: "Read Digital Inputs",
      description: "Read all digital input states",
    },
    {
      id: "lcu_set_outputs",
      name: "Set Digital Outputs",
      description: "Set digital output states",
      parameters: [{ name: "output_mask", type: "number", required: true }],
    },
    {
      id: "lcu_read_can_stats",
      name: "Read CAN Stats",
      description: "Read CAN bus statistics",
    },
    {
      id: "lcu_clear_errors",
      name: "Clear Error Log",
      description: "Clear system error log",
    },
    {
      id: "lcu_read_config",
      name: "Read Configuration",
      description: "Read system configuration",
    },
    {
      id: "lcu_save_config",
      name: "Save Configuration",
      description: "Save configuration to EEPROM",
    },
    {
      id: "lcu_software_reset",
      name: "Software Reset",
      description: "Perform software reset",
      dangerous: true,
    },
    {
      id: "lcu_enter_bootloader",
      name: "Enter Bootloader",
      description: "Enter firmware update mode",
      dangerous: true,
    },
  ],

  HVSCU: [
    {
      id: "hvscu_read_hv_voltage",
      name: "Read HV Voltage",
      description: "Read high voltage bus voltage",
    },
    {
      id: "hvscu_read_isolation",
      name: "Read Isolation",
      description: "Read isolation resistance",
    },
    {
      id: "hvscu_precharge_start",
      name: "Start Precharge",
      description: "Start HV bus precharge sequence",
    },
    {
      id: "hvscu_close_contactors",
      name: "Close Contactors",
      description: "Close HV contactors",
      dangerous: true,
    },
    {
      id: "hvscu_open_contactors",
      name: "Open Contactors",
      description: "Open HV contactors",
      dangerous: true,
    },
    {
      id: "hvscu_read_contactor_state",
      name: "Read Contactor State",
      description: "Read HV contactor states",
    },
    {
      id: "hvscu_discharge_bus",
      name: "Discharge HV Bus",
      description: "Discharge high voltage bus",
    },
    {
      id: "hvscu_test_interlocks",
      name: "Test Interlocks",
      description: "Test safety interlock circuits",
    },
    {
      id: "hvscu_read_faults",
      name: "Read Fault Status",
      description: "Read HV system faults",
    },
    {
      id: "hvscu_emergency_disconnect",
      name: "Emergency Disconnect",
      description: "Emergency HV disconnect",
      dangerous: true,
    },
  ],

  BMSL: [
    {
      id: "bmsl_read_12v",
      name: "Read 12V Voltage",
      description: "Read 12V auxiliary battery voltage",
    },
    {
      id: "bmsl_read_current",
      name: "Read 12V Current",
      description: "Read 12V system current draw",
    },
    {
      id: "bmsl_enable_dcdc",
      name: "Enable DC-DC",
      description: "Enable DC-DC converter",
    },
    {
      id: "bmsl_disable_dcdc",
      name: "Disable DC-DC",
      description: "Disable DC-DC converter",
    },
    {
      id: "bmsl_read_dcdc_temp",
      name: "Read DC-DC Temp",
      description: "Read DC-DC converter temperature",
    },
    {
      id: "bmsl_set_dcdc_voltage",
      name: "Set DC-DC Voltage",
      description: "Set DC-DC output voltage",
      parameters: [{ name: "voltage", type: "number", required: true }],
    },
    {
      id: "bmsl_read_aux_loads",
      name: "Read Auxiliary Loads",
      description: "Read auxiliary load currents",
    },
    {
      id: "bmsl_control_load",
      name: "Control Load",
      description: "Enable/disable auxiliary load",
      parameters: [
        { name: "load_id", type: "number", required: true },
        { name: "enable", type: "boolean", required: true },
      ],
    },
    {
      id: "bmsl_reset_protection",
      name: "Reset Protection",
      description: "Reset overcurrent protection",
    },
    {
      id: "bmsl_read_diagnostics",
      name: "Read Diagnostics",
      description: "Read LV system diagnostics",
    },
  ],

  VCU: [
    {
      id: "vcu_read_vehicle_state",
      name: "Read Vehicle State",
      description: "Read current vehicle state",
    },
    {
      id: "vcu_set_drive_mode",
      name: "Set Drive Mode",
      description: "Set vehicle drive mode",
      parameters: [{ name: "mode", type: "string", required: true }],
    },
    {
      id: "vcu_read_speed",
      name: "Read Speed",
      description: "Read vehicle speed",
    },
    {
      id: "vcu_read_odometer",
      name: "Read Odometer",
      description: "Read vehicle odometer",
    },
    {
      id: "vcu_enable_cruise",
      name: "Enable Cruise Control",
      description: "Enable cruise control system",
    },
    {
      id: "vcu_disable_cruise",
      name: "Disable Cruise Control",
      description: "Disable cruise control system",
    },
    {
      id: "vcu_read_torque_request",
      name: "Read Torque Request",
      description: "Read motor torque request",
    },
    {
      id: "vcu_calibrate_pedals",
      name: "Calibrate Pedals",
      description: "Calibrate accelerator and brake pedals",
    },
    {
      id: "vcu_read_warnings",
      name: "Read Warnings",
      description: "Read active vehicle warnings",
    },
    {
      id: "vcu_system_shutdown",
      name: "System Shutdown",
      description: "Controlled vehicle system shutdown",
      dangerous: true,
    },
  ],
};

// Helper to get all commands as flat array
export const getAllCommands = (): Command[] => {
  return Object.values(MOCK_COMMANDS).flat();
};

// Helper to get commands by ECU
export const getCommandsByBoard = (board: BoardName): Command[] => {
  return MOCK_COMMANDS[board];
};

// Get all ECU categories
export const BOARD_NAMES: BoardName[] = Object.keys(
  MOCK_COMMANDS,
) as BoardName[];

// Get total command count
export const getTotalCommandCount = (): number => {
  return getAllCommands().length;
};
