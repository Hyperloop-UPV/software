import { LcuMeasurements } from 'common';
import styles from './LevitationUnit.module.scss';
import { IndicatorStack } from 'components/IndicatorStack/IndicatorStack';
import thunder from 'assets/svg/thunder-filled.svg';
import { useMeasurementsStore } from 'common';
import EMSRepresentation from './EMSRepresentation/EMSRepresentation';
import HEMSRepresentation from './HEMSRepresentation/HEMSRepresentation';
import { CurrentIndicator } from './CurrentIndicator/CurrentIndicator';
export interface Props {
    unitIndex: number;
    imageSide: 'left' | 'right' | 'none';
    kind: 'ems' | 'hems';
}

export const currentMeasurements = [
    LcuMeasurements.coilCurrentHEMS1,
    LcuMeasurements.coilCurrentHEMS2,
    LcuMeasurements.coilCurrentHEMS3,
    LcuMeasurements.coilCurrentHEMS4,
    LcuMeasurements.coilCurrentEMS1,
    LcuMeasurements.coilCurrentEMS2,
    LcuMeasurements.coilCurrentEMS3,
    LcuMeasurements.coilCurrentEMS4,
    LcuMeasurements.coilCurrentEMS5,
    LcuMeasurements.coilCurrentEMS6,
];

export const temperatureMeasurements = [
    LcuMeasurements.coilTemperatureHEMS1,
    LcuMeasurements.coilTemperatureHEMS2,
    LcuMeasurements.coilTemperatureHEMS3,
    LcuMeasurements.coilTemperatureHEMS4,
    LcuMeasurements.coilTemperatureEMS1,
    LcuMeasurements.coilTemperatureEMS2,
    LcuMeasurements.coilTemperatureEMS3,
    LcuMeasurements.coilTemperatureEMS4,
    LcuMeasurements.coilTemperatureEMS5,
    LcuMeasurements.coilTemperatureEMS6,
];

export const airgapMeasurements = [
    LcuMeasurements.verticalAirgap1,
    LcuMeasurements.verticalAirgap2,
    LcuMeasurements.verticalAirgap3,
    LcuMeasurements.verticalAirgap4,
    LcuMeasurements.horizontalAirgap1,
    LcuMeasurements.horizontalAirgap2,
    LcuMeasurements.horizontalAirgap1,
    LcuMeasurements.horizontalAirgap2,
    LcuMeasurements.horizontalAirgap3,
    LcuMeasurements.horizontalAirgap4,
];

export const LevitationUnit = ({ unitIndex, kind, imageSide }: Props) => {
    const getNumericMeasurementInfo = useMeasurementsStore(
        (state) => state.getNumericMeasurementInfo
    );

    const current = getNumericMeasurementInfo(currentMeasurements[unitIndex]);

    const airgap = getNumericMeasurementInfo(airgapMeasurements[unitIndex]);
    const airgap2 =
        unitIndex == 6 || unitIndex == 7
            ? getNumericMeasurementInfo(airgapMeasurements[unitIndex + 2])
            : undefined;

    return (
        <div className={styles.levitationUnitWrapper}>
            {imageSide === 'left' &&
                (kind == 'ems' ? (
                    <EMSRepresentation
                        getUpdate={
                            unitIndex == 6 || unitIndex == 7
                                ? () =>
                                      (airgap.getUpdate() +
                                          airgap2!.getUpdate()) /
                                      2
                                : airgap.getUpdate
                        }
                        rangeMin={airgap.warningRange[0]!!}
                        rangeMax={airgap.warningRange[1]!!}
                        side={imageSide}
                    />
                ) : (
                    <HEMSRepresentation
                        getUpdate={
                            unitIndex == 6 || unitIndex == 7
                                ? () =>
                                      (airgap.getUpdate() +
                                          airgap2!.getUpdate()) /
                                      2
                                : airgap.getUpdate
                        }
                        rangeMin={airgap.warningRange[0]!!}
                        rangeMax={airgap.warningRange[1]!!}
                    />
                ))}
            <IndicatorStack className={styles.levitationUnitMeasurements}>
                <CurrentIndicator
                    icon={thunder}
                    getValue={current.getUpdate}
                    units={current.units}
                    safeRangeMin={-50}
                    safeRangeMax={50}
                    warningRangeMin={-60}
                    warningRangeMax={60}
                />
                {/* <BarIndicator
                    icon={thermometerFilled}
                    name="Temperature"
                    getValue={temperature.getUpdate}
                    units={temperature.units}
                    safeRangeMin={temperature.range[0]!!}
                    safeRangeMax={temperature.range[1]!!}
                    warningRangeMin={temperature.warningRange[0]!!}
                    warningRangeMax={temperature.warningRange[1]!!}
                />
                <BarIndicator
                    icon={airgapIcon}
                    name="Airgap"
                    color={
                        unitIndex == 6 || unitIndex == 7
                            ? 'transparent'
                            : undefined
                    }
                    backgroundColor={
                        unitIndex == 6 || unitIndex == 7
                            ? 'transparent'
                            : undefined
                    }
                    getValue={
                        unitIndex == 6 || unitIndex == 7
                            ? () =>
                                  (airgap.getUpdate() + airgap2!.getUpdate()) /
                                  2
                            : airgap.getUpdate
                    }
                    units={airgap.units}
                    safeRangeMin={
                        unitIndex == 6 || unitIndex == 7
                            ? null!!
                            : airgap.range[0]!!
                    }
                    safeRangeMax={
                        unitIndex == 6 || unitIndex == 7
                            ? null!!
                            : airgap.range[1]!!
                    }
                    warningRangeMin={
                        unitIndex == 6 || unitIndex == 7
                            ? null!!
                            : airgap.warningRange[0]!!
                    }
                    warningRangeMax={
                        unitIndex == 6 || unitIndex == 7
                            ? null!!
                            : airgap.warningRange[1]!!
                    }
                /> */}
            </IndicatorStack>
            {imageSide === 'right' &&
                (kind == 'ems' ? (
                    <EMSRepresentation
                        getUpdate={
                            unitIndex == 6 || unitIndex == 7
                                ? () =>
                                      (airgap.getUpdate() +
                                          airgap2!.getUpdate()) /
                                      2
                                : airgap.getUpdate
                        }
                        rangeMin={airgap.warningRange[0]!!}
                        rangeMax={airgap.warningRange[1]!!}
                        side={imageSide}
                    />
                ) : (
                    <HEMSRepresentation
                        getUpdate={
                            unitIndex == 6 || unitIndex == 7
                                ? () =>
                                      (airgap.getUpdate() +
                                          airgap2!.getUpdate()) /
                                      2
                                : airgap.getUpdate
                        }
                        rangeMin={airgap.warningRange[0]!!}
                        rangeMax={airgap.warningRange[1]!!}
                    />
                ))}
        </div>
    );
};
