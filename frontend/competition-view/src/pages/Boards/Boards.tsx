import { BCU, BLCU, HVBMS, HVBMS_CABINET, LCU, LVBMS, PCU_BOARD, VCU } from "../../constants/measurements";
import BoardCard from "./components/BoardCard";
import LcuAirgapCard from "./components/LcuAirgapCard";

const Boards = () => (
  <div className="flex h-full flex-col gap-6 overflow-auto p-4">
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">Board States</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BoardCard
          name="VCU"
          stateMeasurementKey={VCU.generalState}
          stats={[
            { label: "Operational state", measurementKey: VCU.operationalState },
            { label: "High pressure",     measurementKey: VCU.highPressure,    unit: "bar" },
            { label: "Brake pressure",    measurementKey: VCU.pressureBrakes,  unit: "bar" },
            { label: "Capsule pressure",  measurementKey: VCU.pressureCapsule, unit: "bar" },
          ]}
        />

        <BoardCard
          name="HVBMS"
          stateMeasurementKey={HVBMS.operationalState}
          stats={[
            { label: "Min SOC",    measurementKey: HVBMS.minimumSoc,     unit: "%"  },
            { label: "Voltage",    measurementKey: HVBMS.voltageReading, unit: "V"  },
            { label: "Current",    measurementKey: HVBMS.currentReading, unit: "A"  },
            { label: "Temp max",   measurementKey: HVBMS.tempMax,        unit: "°C" },
            { label: "IMD",        measurementKey: HVBMS.imdOk                      },
            { label: "SDC status", measurementKey: HVBMS.sdcStatus                  },
          ]}
        />

        <BoardCard
          name="HVBMS-Cabinet"
          stateMeasurementKey={HVBMS_CABINET.contactorsState}
          stats={[
            { label: "Bus voltage",    measurementKey: HVBMS_CABINET.busVoltage,            unit: "V" },
            { label: "Output current", measurementKey: HVBMS_CABINET.outputCurrent,         unit: "A" },
            { label: "SDC",            measurementKey: HVBMS_CABINET.sdcGood                          },
            { label: "Supercaps V",    measurementKey: HVBMS_CABINET.totalSupercapsVoltage, unit: "V" },
          ]}
        />

        <BoardCard
          name="PCU"
          stateMeasurementKey={PCU_BOARD.generalState}
          stats={[
            { label: "Operating state", measurementKey: PCU_BOARD.operatingState           },
            { label: "Peak current",    measurementKey: PCU_BOARD.peakCurrent,  unit: "A"  },
            { label: "Frequency",       measurementKey: PCU_BOARD.frequency,    unit: "Hz" },
          ]}
        />

        <BoardCard
          name="LCU"
          stateMeasurementKey={LCU.generalState}
          stats={[
            { label: "Position Y", measurementKey: LCU.positionY, unit: "mm", decimals: 2 },
            { label: "Position Z", measurementKey: LCU.positionZ, unit: "mm", decimals: 2 },
          ]}
        />

        <BoardCard
          name="LVBMS"
          stateMeasurementKey={LVBMS.generalState}
          stats={[
            { label: "SOC",           measurementKey: LVBMS.soc,          unit: "%", decimals: 0 },
            { label: "Total voltage", measurementKey: LVBMS.totalVoltage, unit: "V"              },
            { label: "Current",       measurementKey: LVBMS.current,      unit: "A"              },
            { label: "Temp max",      measurementKey: LVBMS.tempMax,      unit: "°C"             },
          ]}
        />

        <BoardCard
          name="BCU"
          stateMeasurementKey={BCU.generalState}
          stats={[
            { label: "Operational state", measurementKey: BCU.operationalState },
            { label: "Nested state",      measurementKey: BCU.nestedState      },
          ]}
        />

        <BoardCard
          name="BLCU"
          stateMeasurementKey={BLCU.state}
        />
      </div>
    </section>

    {/* LCU levitation detail */}
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">Levitation</h2>
      <LcuAirgapCard />
    </section>
  </div>
);

export default Boards;
