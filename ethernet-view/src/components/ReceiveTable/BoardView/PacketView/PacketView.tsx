import { Packet } from "common";
import styles from "./PacketView.module.scss";
import { MeasurementView } from "./MeasurementView/MeasurementView";
import { memo } from "react";
import { useUpdater } from "./useUpdater";
import { useColumnsStore } from "store/columnsStore";

type Props = {
    packet: Packet;
};

export const PacketView = memo(({ packet }: Props) => {
    const columnSizes = useColumnsStore((state) => state.columnSizes);

    const { countRef, cycleTimeRef } = useUpdater(packet);

    return (
        <div className={styles.packetView}>
            <div className={styles.data}>
                <div style={{ flexBasis: columnSizes[0] }}>{packet.id}</div>
                <div style={{ flexBasis: columnSizes[1] }}>{packet.name}</div>
                <div
                    ref={countRef}
                    className={styles.count}
                    style={{ flexBasis: columnSizes[2] }}
                ></div>
                <div
                    ref={cycleTimeRef}
                    className={styles.cycleTime}
                    style={{ flexBasis: columnSizes[3] }}
                ></div>
            </div>
            {Object.keys(packet.measurements).length > 0 && (
                <div className={styles.measurements}>
                    {packet.measurements.map((measurement) => {
                        return (
                            <MeasurementView
                                key={measurement.id}
                                measurement={measurement}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
});
