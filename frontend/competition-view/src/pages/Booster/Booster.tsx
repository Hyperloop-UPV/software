import { BCU, HVBMS_CABINET } from "../../constants/measurements";
import BoardCard from "../Boards/components/BoardCard";

/**
 * Booster page — BCU (Booster Control Unit) state + HVBMS-Cabinet health.
 *
 * Layout:
 *   Section 1 — BCU state: general/operational/nested states + LSM phase currents
 *   Section 2 — HVBMS-Cabinet: contactors, bus voltage, output current, supercaps
 */
const Booster = () => (
  <div className="flex h-full flex-col gap-6 overflow-auto p-4">
    {/* ── BCU ─────────────────────────────────────────────────────────── */}
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">
        BCU — Booster Control Unit
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BoardCard
          name="BCU State"
          stateMeasurementKey={BCU.generalState}
          stats={[
            { label: "Operational state", measurementKey: BCU.operationalState },
            { label: "Nested state",      measurementKey: BCU.nestedState      },
          ]}
        />

        <BoardCard
          name="LSM Phase Currents"
          stateMeasurementKey={BCU.operationalState}
          stats={[
            { label: "Phase U avg", measurementKey: BCU.averageCurrentU, unit: "A", decimals: 2 },
            { label: "Phase V avg", measurementKey: BCU.averageCurrentV, unit: "A", decimals: 2 },
            { label: "Phase W avg", measurementKey: BCU.averageCurrentW, unit: "A", decimals: 2 },
          ]}
        />
      </div>
    </section>

    {/* ── HVBMS-Cabinet ────────────────────────────────────────────────── */}
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">
        HVBMS-Cabinet
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BoardCard
          name="HVBMS-Cabinet"
          stateMeasurementKey={HVBMS_CABINET.contactorsState}
          stats={[
            { label: "Bus voltage",    measurementKey: HVBMS_CABINET.busVoltage,            unit: "V" },
            { label: "Output current", measurementKey: HVBMS_CABINET.outputCurrent,         unit: "A" },
            { label: "Supercaps V",    measurementKey: HVBMS_CABINET.totalSupercapsVoltage, unit: "V" },
            { label: "SDC",            measurementKey: HVBMS_CABINET.sdcGood                          },
          ]}
        />
      </div>
    </section>
  </div>
);

export default Booster;
