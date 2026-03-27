import { describe, expect, it } from "vitest";
import { variablesBadgeClasses } from "../constants/variablesBadgeClasses";
import type { FilterScope } from "../features/filtering/types/filters";
import type { MessageTimestamp } from "../types/data/message";
import {
  canAddSeriesToChart,
  createEmptyFilter,
  createFullFilter,
  formatName,
  formatTimestamp,
  formatVariableValue,
  getCatalogKey,
  getTypeBadgeClass,
} from "./utils";

describe("getCatalogKey", () => {
  it("should return the correct catalog key", () => {
    expect(getCatalogKey("commands")).toBe("commandsCatalog");
    expect(getCatalogKey("telemetry")).toBe("telemetryCatalog");
    expect(getCatalogKey("logs")).toBe("telemetryCatalog");
  });

  it("should return null for an invalid scope", () => {
    expect(getCatalogKey(null as unknown as FilterScope)).toBeNull();
    expect(getCatalogKey("invalid" as FilterScope)).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("should return the correct formatted timestamp", () => {
    expect(
      formatTimestamp({
        counter: 0,
        day: 1,
        month: 1,
        year: 2021,
        hour: 12,
        minute: 30,
        second: 0,
      }),
    ).toBe("12:30:00");
  });

  it("should handle correctly null values", () => {
    expect(formatTimestamp(null as unknown as MessageTimestamp)).toBe(
      "00:00:00",
    );
  });
});

describe("formatName", () => {
  it("should return the correct formatted name", () => {
    expect(formatName("connection")).toBe("Connection");
    expect(formatName("latency")).toBe("Latency");
    expect(formatName("packet")).toBe("Packet");
    expect(formatName("calibration")).toBe("Calibration");
  });

  it("should correctly remove parentheses", () => {
    expect(formatName("connection (test)")).toBe("Connection Test");
    expect(formatName("(test) latency")).toBe("Test Latency");
    expect(formatName("packet (test) pwm")).toBe("Packet Test PWM");
    expect(formatName("(test) calibration (dclv test)")).toBe(
      "Test Calibration DCLV Test",
    );
  });

  it("should correctly remove common board prefixes", () => {
    expect(formatName("bcu_connection")).toBe("Connection");
    expect(formatName("pcu_latency")).toBe("Latency");
    expect(formatName("lcu_packet")).toBe("Packet");
    expect(formatName("hvscu_calibration")).toBe("Calibration");
    expect(formatName("hvscu_cabinet_calibration")).toBe("Calibration");
  });

  it("should correctly handle acronyms", () => {
    expect(formatName("SOC_connection")).toBe("SOC Connection");
    expect(formatName("SOH_latency")).toBe("SOH Latency");
    expect(formatName("CAN_packet")).toBe("CAN Packet");
    expect(formatName("HV_calibration")).toBe("HV Calibration");
    expect(formatName("DC_calibration Pfm")).toBe("DC Calibration PFM");
    expect(formatName("DC-DC_calibration")).toBe("DC-DC Calibration");
  });

  it("should correctly handle words with multiple spaces", () => {
    expect(formatName("connection  test")).toBe("Connection Test");
    expect(formatName("latency  test")).toBe("Latency Test");
    expect(formatName("packet   test")).toBe("Packet Test");
    expect(formatName("calibration     test pfM")).toBe("Calibration Test PFM");
  });
});

describe("getTypeBadgeClass", () => {
  it("should return the correct badge class", () => {
    expect(getTypeBadgeClass("float")).toBe(variablesBadgeClasses.float);
    expect(getTypeBadgeClass("integer")).toBe(variablesBadgeClasses.integer);
    expect(getTypeBadgeClass("uint8")).toBe(variablesBadgeClasses.uint8);
    expect(getTypeBadgeClass("enum")).toBe(variablesBadgeClasses.enum);
    expect(getTypeBadgeClass("string")).toBe(variablesBadgeClasses.enum);
    expect(getTypeBadgeClass("boolean")).toBe(variablesBadgeClasses.boolean);
  });

  it("should return the correct badge class for an unknown type", () => {
    expect(getTypeBadgeClass("unknown")).toBe(variablesBadgeClasses.unknown);
  });
});

describe("canAddSeriesToChart", () => {
  it("should allow adding a numeric series to an empty chart", () => {
    expect(canAddSeriesToChart([], false)).toBe(true);
  });

  it("should allow adding an enum series to an empty chart", () => {
    expect(canAddSeriesToChart([], true)).toBe(true);
  });

  it("should prevent adding an enum series to a chart with existing series", () => {
    expect(canAddSeriesToChart([{}], true)).toBe(false);
    expect(canAddSeriesToChart([{ enumOptions: ["A", "B"] }], true)).toBe(false);
  });

  it("should prevent adding a numeric series to a chart with an enum series", () => {
    expect(canAddSeriesToChart([{ enumOptions: ["A", "B"] }], false)).toBe(false);
  });

  it("should allow adding a numeric series to a chart with existing numeric series", () => {
    expect(canAddSeriesToChart([{}], false)).toBe(true);
    expect(canAddSeriesToChart([{}, {}], false)).toBe(true);
  });
});

describe("formatVariableValue", () => {
  it("should return '—' for null or undefined", () => {
    expect(formatVariableValue(null)).toBe("—");
    expect(formatVariableValue(undefined)).toBe("—");
  });

  it("should return enum label by string value", () => {
    expect(formatVariableValue("Running", ["Idle", "Running", "Fault"])).toBe("Running");
  });

  it("should return enum label by numeric index", () => {
    expect(formatVariableValue(1, ["Idle", "Running", "Fault"])).toBe("Running");
  });

  it("should return raw string if index is out of bounds", () => {
    expect(formatVariableValue(5, ["Idle", "Running"])).toBe("5");
  });

  it("should format booleans as 0/1", () => {
    expect(formatVariableValue(true)).toBe("1");
    expect(formatVariableValue(false)).toBe("0");
  });

  it("should format numbers with 2 decimal places", () => {
    expect(formatVariableValue(3.14159)).toBe("3.14");
    expect(formatVariableValue(42)).toBe("42.00");
  });

  it("should format object with last/average using last", () => {
    expect(formatVariableValue({ last: 1.5, average: 1.2 })).toBe("1.50");
  });
});

describe("emptyFilter", () => {
  it("should return the correct empty filter", () => {
    const boards = [
      "BCU",
      "PCU",
      "LCU",
      "HVSCU",
      "HVSCU-Cabinet",
      "BMSL",
      "VCU",
    ];

    expect(createEmptyFilter(boards)).toStrictEqual({
      BCU: [],
      PCU: [],
      LCU: [],
      HVSCU: [],
      "HVSCU-Cabinet": [],
      BMSL: [],
      VCU: [],
    });
  });
});

describe("fullFilter", () => {
  it("should return the correct full filter", () => {
    const testItem1 = { id: 1, name: "board-1", label: "Board 1" };
    const testItem2 = { id: 2, name: "board-2", label: "Board 2" };
    const testItem3 = { id: 3, name: "board-3", label: "Board 3" };

    const testDataSource = {
      BCU: [testItem1],
      PCU: [testItem2],
      LCU: [testItem3],
      HVSCU: [testItem1, testItem3],
      "HVSCU-Cabinet": [testItem1, testItem2],
      BMSL: [testItem2, testItem3],
      VCU: [],
    };

    const boards = [
      "BCU",
      "PCU",
      "LCU",
      "HVSCU",
      "HVSCU-Cabinet",
      "BMSL",
      "VCU",
    ];

    expect(createFullFilter(testDataSource, boards)).toStrictEqual({
      BCU: [1],
      PCU: [2],
      LCU: [3],
      HVSCU: [1, 3],
      "HVSCU-Cabinet": [1, 2],
      BMSL: [2, 3],
      VCU: [],
    });
  });
});
