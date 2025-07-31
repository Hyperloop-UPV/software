import { useContext, useState } from "react";
import styles from "./BoosterPage.module.scss";
import BoosterModule from "components/BoosterModules/BoosterModule";
import {
  useMeasurementsStore,
  HvscuCabinetMeasurements,
  getBooleanMeasurement,
  GlobalTicker,
  useGlobalTicker,
  useOrders,
  BoardOrders,
  MessagesContainer,
  BcuMeasurements,
  VcuMeasurements,
} from "common";
import { OrdersContainer } from "components/OrdersContainer/OrdersContainer";
import { Window } from "components/Window/Window";
import { emergencyStopOrders, getHardcodedOrders } from "../BatteriesPage/FixedOrders";
import { usePodDataUpdate } from "hooks/usePodDataUpdate";
import { Connection, useConnections } from "common";
import { LostConnectionContext } from "services/connections";
import { BarIndicator } from "components/BarIndicator/BarIndicator";
import { EnumIndicator } from "components/EnumIndicator/EnumIndicator";
import battery from "assets/svg/battery-filled.svg";
import thunder from "assets/svg/thunder-filled.svg";
import thermometer from "assets/svg/thermometer-field.svg";
import Contactors from "assets/svg/open-contactors-icon.svg";
import teamLogo from "assets/svg/team_logo.svg";
import { BigOrderButton } from "components/BigOrderButton";
import { LEDS } from "../MainPage/MainPageModules/Leds";
import { SdcIndicator } from "components/BoolIndicator/SdcIndicator";

interface ModuleData {
  id: number | string;
  name: string;
}

const modules: ModuleData[] = [
  { id: 1, name: "Module 1" },
  { id: 2, name: "Module 2" },
  { id: 3, name: "Module 3" },
];

export function BoosterPage() {
  usePodDataUpdate();

  const connections = useConnections();
  const getNumericMeasurementInfo = useMeasurementsStore(
    (state) => state.getNumericMeasurementInfo,
  );

  const boardOrders = useOrders();

  // Medidas
  const totalSupercapsVoltageInfo = getNumericMeasurementInfo(
    HvscuCabinetMeasurements.TotalVoltage,
  );

  const currentMeasurementInfo = getNumericMeasurementInfo(
    HvscuCabinetMeasurements.CurrentOutput,
  );

  // Enums
  const contactorsStateMeasurement = useMeasurementsStore(
    (state) =>
      state.getEnumMeasurementInfo(HvscuCabinetMeasurements.ContactorsState)
        .getUpdate,
  );
  const bcuGeneralStateMeasurement = useMeasurementsStore(
    (state) =>
      state.getEnumMeasurementInfo(BcuMeasurements.generalState).getUpdate,
  );
  const bcuOperationalStateMeasurement = useMeasurementsStore(
    (state) =>
      state.getEnumMeasurementInfo(BcuMeasurements.operationalState).getUpdate,
  );

  // Estados
  const [generalState, setGeneralState] = useState(bcuGeneralStateMeasurement);
  const [operationalState, setOperationalState] = useState(
    bcuOperationalStateMeasurement,
  );

  useGlobalTicker(() => {
    setGeneralState(bcuGeneralStateMeasurement);
    setOperationalState(bcuOperationalStateMeasurement);
  });

  const bcuState =
    generalState == "Operational" ? operationalState : generalState;

  return (
    <LostConnectionContext.Provider
      value={any([...connections.boards, connections.backend], isDisconnected)}
    >
      <main className={styles.boosterMainContainer}>
        <div className={styles.boosterContainer}>
          <LEDS measurement={HvscuCabinetMeasurements.BusVoltage}/>
          <Window title="Booster Status">
            <div className={styles.statusIndicators}>
              <BarIndicator
                name="Total Voltage"
                icon={battery}
                getValue={totalSupercapsVoltageInfo.getUpdate}
                safeRangeMin={0}
                safeRangeMax={432}
                warningRangeMin={0}
                warningRangeMax={432}
                units={totalSupercapsVoltageInfo.units}
              />
              <BarIndicator
                name="Current Output"
                icon={thunder}
                getValue={currentMeasurementInfo.getUpdate}
                safeRangeMin={0}
                safeRangeMax={125}
                warningRangeMin={0}
                warningRangeMax={125}
                units={currentMeasurementInfo.units}
              />
            </div>
          </Window>

          <Window title="Booster State">
            <div className={styles.stateIndicators}>
              <div className={styles.text}>
                <span className={styles.subtitle}>Contactors</span>
                <EnumIndicator
                  measurementId={HvscuCabinetMeasurements.ContactorsState}
                  icon={Contactors}
                />
              </div>
              <div className={styles.text}>
                <span className={styles.subtitle}>SDC</span>
                <SdcIndicator/>
              </div>
              <div className={styles.text}>
                <span className={styles.subtitle}>BCU General State</span>
                <EnumIndicator
                  measurementId={BcuMeasurements.generalState}
                  icon={teamLogo}
                />
              </div>
              <div className={styles.text}>
                <span className={styles.subtitle}>BCU Operational State</span>
                <EnumIndicator
                  measurementId={BcuMeasurements.operationalState}
                  icon={teamLogo}
                />
              </div>
              <div className={styles.text}>
                <span className={styles.subtitle}>BCU Control State</span>
                <EnumIndicator
                  measurementId={BcuMeasurements.nestedState}
                  icon={teamLogo}
                />
              </div>
            </div>
          </Window>

          <div className={styles.modulesContainer}>
            {modules.map((module) => (
              <BoosterModule key={module.id} id={module.id} />
            ))}
          </div>
        </div>
        <div className={styles.messagesAndOrders}>
          <Window title="Messages" className={styles.messages}>
            <MessagesContainer />
          </Window>
          <div className={styles.emergency_wrapper}>
              <BigOrderButton
                  orders={emergencyStopOrders}
                  label="⚠️ EMERGENCY STOP"
                  shortcut=" "
                  className={`${styles.emergency_button} ${styles.emergency_stop}`}
                  brightness={3}
              />
          </div>
          <Window title="Orders" className={styles.orders}>
            <div className={styles.order_column}>
              <OrdersContainer
                boardFilter={['BCU']}
                boardOrdersFilter={getHardcodedOrders}
              />
            </div>
          </Window>
        </div>
      </main>
    </LostConnectionContext.Provider>
  );
}

function isDisconnected(connection: Connection): boolean {
  return !connection.isConnected;
}

function all<T>(data: T[], condition: (value: T) => boolean): boolean {
  for (const value of data) {
    if (!condition(value)) {
      return false;
    }
  }
  return true;
}

function any<T>(data: T[], condition: (value: T) => boolean): boolean {
  for (const value of data) {
    if (condition(value)) {
      return true;
    }
  }
  return false;
}
