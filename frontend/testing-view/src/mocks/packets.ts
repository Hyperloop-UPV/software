import type { Packet } from "../types/Packet";
import type { PacketsBoardName } from "../types/TabFilter";

export const MOCK_PACKETS: Record<PacketsBoardName, Packet[]> = {
  BCU: [
    {
      id: "bcu_pack_voltage",
      name: "Pack Voltage",
      description: "Total battery pack voltage",
      variables: [
        {
          id: "bcu_pack_voltage",
          name: "Pack Voltage",
          type: "float",
          unit: "V",
          value: 403.2,
        },
        {
          id: "bcu_pack_voltage_2",
          name: "Pack Voltage 2",
          type: "float",
          unit: "V",
          value: 404.2,
        },
      ],
      timestamp: "12:34:56.123",
    },
    {
      id: "bcu_pack_current",
      name: "Pack Current",
      description: "Battery pack current draw",
      timestamp: "12:34:56.145",
      variables: [
        {
          id: "bcu_pack_current",
          name: "Pack Current",
          type: "float",
          unit: "A",
          value: -125.5,
        },
        {
          id: "bcu_pack_current_2",
          name: "Pack Current 2",
          type: "float",
          unit: "A",
          value: -126.5,
        },
      ],
    },
    {
      id: "bcu_soc",
      name: "State of Charge",
      description: "Battery state of charge",
      timestamp: "12:34:56.167",
      variables: [
        {
          id: "bcu_soc",
          name: "State of Charge",
          type: "float",
          unit: "%",
          value: 78.5,
        },
      ],
    },
    {
      id: "bcu_max_cell_temp",
      name: "Max Cell Temperature",
      description: "Highest cell temperature in pack",
      timestamp: "12:34:56.189",
      variables: [
        {
          id: "bcu_max_cell_temp",
          name: "Max Cell Temperature",
          type: "float",
          unit: "°C",
          value: 42.3,
        },
      ],
    },
    {
      id: "bcu_min_cell_voltage",
      name: "Min Cell Voltage",
      description: "Lowest cell voltage in pack",
      timestamp: "12:34:56.201",
      variables: [
        {
          id: "bcu_min_cell_voltage",
          name: "Min Cell Voltage",
          type: "float",
          unit: "V",
          value: 3.65,
        },
      ],
    },
  ],

  PCU: [
    {
      id: "pcu_motor_rpm",
      name: "Motor RPM",
      description: "Motor rotational speed",
      timestamp: "12:34:56.234",
      variables: [
        {
          id: "pcu_motor_rpm",
          name: "Motor RPM",
          type: "integer",
          unit: "RPM",
          value: 5420,
        },
      ],
    },
    {
      id: "pcu_inverter_temp",
      name: "Inverter Temperature",
      description: "Power inverter temperature",
      timestamp: "12:34:56.256",
      variables: [
        {
          id: "pcu_inverter_temp",
          name: "Inverter Temperature",
          type: "float",
          unit: "°C",
          value: 68.7,
        },
      ],
    },
    {
      id: "pcu_power_output",
      name: "Power Output",
      description: "Current power output",
      timestamp: "12:34:56.278",
      variables: [
        {
          id: "pcu_power_output",
          name: "Power Output",
          type: "float",
          unit: "kW",
          value: 87.3,
        },
      ],
    },
    {
      id: "pcu_efficiency",
      name: "Efficiency",
      description: "Power conversion efficiency",
      timestamp: "12:34:56.290",
      variables: [
        {
          id: "pcu_efficiency",
          name: "Efficiency",
          type: "float",
          unit: "%",
          value: 94.2,
        },
      ],
    },
    {
      id: "pcu_dc_bus_voltage",
      name: "DC Bus Voltage",
      description: "Inverter DC bus voltage",
      timestamp: "12:34:56.312",
      variables: [
        {
          id: "pcu_dc_bus_voltage",
          name: "DC Bus Voltage",
          type: "float",
          unit: "V",
          value: 405.8,
        },
      ],
    },
  ],

  LCU: [
    {
      id: "lcu_can_load",
      name: "CAN Bus Load",
      description: "CAN bus utilization percentage",
      timestamp: "12:34:56.334",
      variables: [
        {
          id: "lcu_can_load",
          name: "CAN Bus Load",
          type: "float",
          unit: "%",
          value: 67.5,
        },
      ],
    },
    {
      id: "lcu_error_count",
      name: "Error Count",
      description: "Total system error count",
      timestamp: "12:34:56.356",
      variables: [
        {
          id: "lcu_error_count",
          name: "Error Count",
          type: "integer",
          unit: "",
          value: 3,
        },
      ],
    },
    {
      id: "lcu_uptime",
      name: "System Uptime",
      description: "Controller uptime",
      timestamp: "12:34:56.378",
      variables: [
        {
          id: "lcu_uptime",
          name: "System Uptime",
          type: "integer",
          unit: "s",
          value: 3624,
        },
      ],
    },
    {
      id: "lcu_cpu_usage",
      name: "CPU Usage",
      description: "Processor utilization",
      timestamp: "12:34:56.390",
      variables: [
        {
          id: "lcu_cpu_usage",
          name: "CPU Usage",
          type: "float",
          unit: "%",
          value: 45.2,
        },
      ],
    },
    {
      id: "lcu_memory_free",
      name: "Free Memory",
      description: "Available RAM",
      timestamp: "12:34:56.412",
      variables: [
        {
          id: "lcu_memory_free",
          name: "Free Memory",
          type: "integer",
          unit: "kB",
          value: 28672,
        },
      ],
    },
  ],

  HVSCU: [
    {
      id: "hvscu_hv_voltage",
      name: "HV Bus Voltage",
      description: "High voltage bus voltage",
      timestamp: "12:34:56.434",
      variables: [
        {
          id: "hvscu_hv_voltage",
          name: "HV Bus Voltage",
          type: "float",
          unit: "V",
          value: 412.7,
        },
      ],
    },
    {
      id: "hvscu_isolation",
      name: "Isolation Resistance",
      description: "HV system isolation to chassis",
      timestamp: "12:34:56.456",
      variables: [
        {
          id: "hvscu_isolation",
          name: "Isolation Resistance",
          type: "float",
          unit: "kΩ",
          value: 850.3,
        },
      ],
    },
    {
      id: "hvscu_contactor_pos",
      name: "Positive Contactor",
      description: "HV+ contactor state",
      timestamp: "12:34:56.478",
      variables: [
        {
          id: "hvscu_contactor_pos",
          name: "Positive Contactor",
          type: "string",
          unit: "",
          value: "CLOSED",
        },
      ],
    },
    {
      id: "hvscu_contactor_neg",
      name: "Negative Contactor",
      description: "HV- contactor state",
      timestamp: "12:34:56.490",
      variables: [
        {
          id: "hvscu_contactor_neg",
          name: "Negative Contactor",
          type: "string",
          unit: "",
          value: "CLOSED",
        },
      ],
    },
    {
      id: "hvscu_precharge_voltage",
      name: "Precharge Voltage",
      description: "Precharge circuit voltage",
      timestamp: "12:34:56.512",
      variables: [
        {
          id: "hvscu_precharge_voltage",
          name: "Precharge Voltage",
          type: "float",
          unit: "V",
          value: 408.1,
        },
      ],
    },
  ],

  BMSL: [
    {
      id: "bmsl_12v_voltage",
      name: "12V Bus Voltage",
      description: "Auxiliary 12V system voltage",
      timestamp: "12:34:56.534",
      variables: [
        {
          id: "bmsl_12v_voltage",
          name: "12V Bus Voltage",
          type: "float",
          unit: "V",
          value: 13.8,
        },
      ],
    },
    {
      id: "bmsl_12v_current",
      name: "12V Current",
      description: "Auxiliary system current draw",
      timestamp: "12:34:56.556",
      variables: [
        {
          id: "bmsl_12v_current",
          name: "12V Current",
          type: "float",
          unit: "A",
          value: 8.3,
        },
      ],
    },
    {
      id: "bmsl_dcdc_temp",
      name: "DC-DC Temperature",
      description: "DC-DC converter temperature",
      timestamp: "12:34:56.578",
      variables: [
        {
          id: "bmsl_dcdc_temp",
          name: "DC-DC Temperature",
          type: "float",
          unit: "°C",
          value: 55.2,
        },
      ],
    },
    {
      id: "bmsl_dcdc_output",
      name: "DC-DC Output Power",
      description: "DC-DC converter output power",
      timestamp: "12:34:56.590",
      variables: [
        {
          id: "bmsl_dcdc_output",
          name: "DC-DC Output Power",
          type: "float",
          unit: "W",
          value: 114.5,
        },
      ],
    },
    {
      id: "bmsl_aux_battery_voltage",
      name: "Aux Battery Voltage",
      description: "12V auxiliary battery voltage",
      timestamp: "12:34:56.612",
      variables: [
        {
          id: "bmsl_aux_battery_voltage",
          name: "Aux Battery Voltage",
          type: "float",
          unit: "V",
          value: 12.6,
        },
      ],
    },
  ],

  VCU: [
    {
      id: "vcu_vehicle_speed",
      name: "Vehicle Speed",
      description: "Current vehicle speed",
      timestamp: "12:34:56.634",
      variables: [
        {
          id: "vcu_vehicle_speed",
          name: "Vehicle Speed",
          type: "float",
          unit: "km/h",
          value: 85.3,
        },
      ],
    },
    {
      id: "vcu_accelerator_pos",
      name: "Accelerator Position",
      description: "Accelerator pedal position",
      timestamp: "12:34:56.656",
      variables: [
        {
          id: "vcu_accelerator_pos",
          name: "Accelerator Position",
          type: "float",
          unit: "%",
          value: 42.5,
        },
      ],
    },
    {
      id: "vcu_brake_pressure",
      name: "Brake Pressure",
      description: "Brake system pressure",
      timestamp: "12:34:56.678",
      variables: [
        {
          id: "vcu_brake_pressure",
          name: "Brake Pressure",
          type: "float",
          unit: "bar",
          value: 0.0,
        },
      ],
    },
    {
      id: "vcu_torque_request",
      name: "Torque Request",
      description: "Requested motor torque",
      timestamp: "12:34:56.690",
      variables: [
        {
          id: "vcu_torque_request",
          name: "Torque Request",
          type: "float",
          unit: "Nm",
          value: 145.8,
        },
      ],
    },
    {
      id: "vcu_drive_mode",
      name: "Drive Mode",
      description: "Current drive mode",
      timestamp: "12:34:56.712",
      variables: [
        {
          id: "vcu_drive_mode",
          name: "Drive Mode",
          type: "string",
          unit: "",
          value: "SPORT",
        },
      ],
    },
  ],

  "HVSCU-Cabinet": [
    {
      id: "hvscu_cabinet_temperature",
      name: "Cabinet Temperature",
      description: "Cabinet temperature",
      timestamp: "12:34:56.734",
      variables: [
        {
          id: "hvscu_cabinet_temperature",
          name: "Cabinet Temperature",
          type: "float",
          unit: "°C",
          value: 25.3,
        },
      ],
    },
  ],
};
