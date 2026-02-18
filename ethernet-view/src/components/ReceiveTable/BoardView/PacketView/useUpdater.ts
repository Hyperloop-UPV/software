import { Packet } from "common";
import { useLayoutEffect, useRef, useContext } from "react";
import { TableContext } from "../../TableUpdater";

export function useUpdater(packet: Packet) {
    const updater = useContext(TableContext);

    const countRef = useRef<HTMLDivElement>(null);
    const cycleTimeRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const countNode = document.createTextNode(packet.count.toFixed(2));
        const cycleTimeNode = document.createTextNode(
            packet.cycleTime.toFixed(0)
        );

        countRef.current!.appendChild(countNode);
        cycleTimeRef.current!.appendChild(cycleTimeNode);

        updater.addPacket(packet.id, {
            count: countNode,
            cycleTime: cycleTimeNode,
        });

        return () => {
            updater.removePacket(packet.id);

            countRef.current!.removeChild(countNode);
            cycleTimeRef.current!.removeChild(cycleTimeNode);
        };
    }, [packet]);

    return { countRef, cycleTimeRef };
}
