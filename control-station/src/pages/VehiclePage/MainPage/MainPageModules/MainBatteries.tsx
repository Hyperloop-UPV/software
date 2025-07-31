import { Window2 } from 'components/Window/Window2';
import styles from '../MainPage.module.scss';
import { BatteryIndicator } from 'components/BatteryIndicator/BatteryIndicator';
import { BmslMeasurements, useMeasurementsStore, HvscuMeasurements, HvscuCabinetMeasurements } from "common";
import { GaugeTag } from 'components/GaugeTag/GaugeTag';

export const Batteries = () => {
    const getNumericMeasurementInfo = useMeasurementsStore((state) => state.getNumericMeasurementInfo);

    const CurrentHV = getNumericMeasurementInfo(HvscuMeasurements.CurrentReading);
    const CurrentLV = getNumericMeasurementInfo(BmslMeasurements.current);
    const CurrentCabinet = getNumericMeasurementInfo(HvscuCabinetMeasurements.CurrentOutput);

    const SocHigh = getNumericMeasurementInfo(HvscuMeasurements.MinimumSoc);
    const SocLow = getNumericMeasurementInfo(BmslMeasurements.stateOfCharge);
    const SocCabinet = getNumericMeasurementInfo(HvscuCabinetMeasurements.Soc);

    const TotalVoltageHigh = getNumericMeasurementInfo(HvscuMeasurements.BatteriesVoltage);
    const TotalVoltageLow = getNumericMeasurementInfo(BmslMeasurements.totalVoltage);
    const TotalVoltageCabinet = getNumericMeasurementInfo(HvscuCabinetMeasurements.TotalVoltage);

    const BusHV = getNumericMeasurementInfo(HvscuMeasurements.VoltageReading);
    const BusCabinet = getNumericMeasurementInfo(HvscuCabinetMeasurements.BusVoltage);

    return (
        <div className={styles.batteriesRow}>
        <Window2 title="High Voltage">
            <GaugeTag name={'Current'} id={'hv'} units={CurrentHV.units} getUpdate={CurrentHV.getUpdate} strokeWidth={110} min={0} max={85} />
            <BatteryIndicator getValue={TotalVoltageHigh.getUpdate} getValueSOC={SocHigh.getUpdate} color='#ACF293' units={TotalVoltageHigh.units}
                safeRangeMin={0} warningRangeMin={100}
                safeRangeMax={100} warningRangeMax={70} />
            <GaugeTag name={'DC Bus'} id={'hv-bus'} units={BusHV.units} getUpdate={BusHV.getUpdate} strokeWidth={110} min={0} max={430} />
        </Window2>

        <Window2 title="Low Voltage">
            <GaugeTag name={'Current'} id={'lv'} units={CurrentLV.units} getUpdate={CurrentLV.getUpdate} strokeWidth={110} min={0} max={5} />
            <BatteryIndicator getValue={TotalVoltageLow.getUpdate} getValueSOC={SocLow.getUpdate} color='#ACF293' units={TotalVoltageLow.units}
                safeRangeMin={0} warningRangeMin={0}
                safeRangeMax={100} warningRangeMax={70} />
        </Window2>

        <Window2 title="Booster">
            <GaugeTag name={'Current'} id={'cabinet'} units={CurrentCabinet.units} getUpdate={CurrentCabinet.getUpdate} strokeWidth={110} min={0} max={125} />
            <BatteryIndicator getValue={TotalVoltageCabinet.getUpdate} getValueSOC={SocCabinet.getUpdate} color='#ACF293' units={TotalVoltageCabinet.units}
                safeRangeMin={0} warningRangeMin={0}
                safeRangeMax={100} warningRangeMax={70} />
            <GaugeTag name={'DC Bus'} id={'cabinet-bus'} units={BusCabinet.units} getUpdate={BusCabinet.getUpdate} strokeWidth={110} min={0} max={432} />
        </Window2>
    </div>
    );

};