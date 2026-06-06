import { BMSL, HVSCU, LCU, PCU_BOARD, VCU } from "../../constants/measurements";
import BoardCard from "./components/BoardCard";
import LcuAirgapCard from "./components/LcuAirgapCard";

/**
 * Boards status page.
 *
 * Gives an at-a-glance view of every ECU's state machine status
 * plus the most critical secondary measurements for each board.
 */
const Boards = () => (
  <div className="flex h-full flex-col gap-6 overflow-auto p-4">
    {/* Primary board states */}
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
          name="HVSCU"
          stateMeasurementKey={HVSCU.operationalState}
          stats={[
            { label: "Min SOC",    measurementKey: HVSCU.minimumSoc,     unit: "%"  },
            { label: "Voltage",    measurementKey: HVSCU.voltageReading, unit: "V"  },
            { label: "Current",    measurementKey: HVSCU.currentReading, unit: "A"  },
            { label: "Temp max",   measurementKey: HVSCU.tempMax,        unit: "°C" },
            { label: "IMD",        measurementKey: HVSCU.imdOk                      },
            { label: "SDC status", measurementKey: HVSCU.sdcStatus                  },
          ]}
        />

        <BoardCard
          name="PCU"
          stateMeasurementKey={PCU_BOARD.generalState}
          stats={[
            { label: "Operating state", measurementKey: PCU_BOARD.operatingState            },
            { label: "Peak current",    measurementKey: PCU_BOARD.peakCurrent,   unit: "A"  },
            { label: "Motor A temp",    measurementKey: PCU_BOARD.motorATemp,    unit: "°C" },
            { label: "Motor B temp",    measurementKey: PCU_BOARD.motorBTemp,    unit: "°C" },
            { label: "Frequency",       measurementKey: PCU_BOARD.frequency,     unit: "Hz" },
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
          name="BMSL"
          stateMeasurementKey={BMSL.generalState}
          stats={[
            { label: "SOC",           measurementKey: BMSL.soc,          unit: "%", decimals: 0 },
            { label: "Total voltage", measurementKey: BMSL.totalVoltage, unit: "V"              },
            { label: "Current",       measurementKey: BMSL.current,      unit: "A"              },
            { label: "Temp max",      measurementKey: BMSL.tempMax,      unit: "°C"             },
          ]}
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
