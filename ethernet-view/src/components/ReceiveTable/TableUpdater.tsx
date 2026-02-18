import {
    getPacket,
    isNumericMeasurement,
    useGlobalTicker,
    useMeasurementsStore,
    usePodDataStore,
} from 'common';
import { createContext, useRef } from 'react';

export type PacketElement = {
    count: Text;
    cycleTime: Text;
};

type MeasurementElement = { id: string; value: Text };

type Updater = {
    addPacket: (id: number, element: PacketElement) => void;
    removePacket: (id: number) => void;
    addMeasurement: (element: MeasurementElement) => void;
    removeMeasurement: (id: string) => void;
};

export const TableContext = createContext<Updater>({
    addPacket() {},
    removePacket() {},
    addMeasurement() {},
    removeMeasurement() {},
});

type Props = {
    children?: React.ReactNode;
};

export const TableUpdater = ({ children }: Props) => {
    const packetElements = useRef<Record<string, PacketElement>>({});
    const measurementElements = useRef<MeasurementElement[]>([]);

    const podData = usePodDataStore((state) => state.podData);
    const getMeasurement = useMeasurementsStore(
        (state) => state.getMeasurement
    );

    useGlobalTicker(() => {
        for (const id in packetElements.current) {
            const packet = getPacket(podData, Number.parseInt(id));
            const element = packetElements.current[id];
            if (packet) {
                element.count.nodeValue = packet.count.toFixed(0);
                element.cycleTime.nodeValue = packet.cycleTime.toFixed(0);
            } else {
                console.warn(`packet ${id} not found`);
            }
        }

        for (const item of measurementElements.current) {
            const measurement = getMeasurement(item.id);
            if (!measurement) {
                console.warn(`measurement ${item.id} not found`);
                return;
            }
            const element = measurementElements.current.find(
                (elem) => elem.id == item.id
            );
            if (!element) {
                console.warn(`element of measurement ${item.id} not found`);
                return;
            }
            element.value.nodeValue = isNumericMeasurement(measurement)
                ? measurement.value.showLatest
                    ? measurement.value.last.toFixed(3)
                    : measurement.value.average.toFixed(3)
                : measurement.value.toString();
        }
    });

    const updater: Updater = {
        addPacket: (id: number, element: PacketElement) => {
            packetElements.current[id] = element;
        },
        removePacket(id) {
            delete packetElements.current[id];
        },
        addMeasurement: (element: MeasurementElement) => {
            if (
                !measurementElements.current.find(
                    (item) => item.id == element.id
                )
            ) {
                measurementElements.current.push(element);
            }
        },
        removeMeasurement: (id: string) => {
            measurementElements.current = measurementElements.current.filter(
                (item) => item.id != id
            );
        },
    };

    return (
        <TableContext.Provider value={updater}>
            {children}
        </TableContext.Provider>
    );
};
