import { useLayoutEffect, useRef, useState } from "react";

export function useBounds<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [rect, setRect] = useState<DOMRect>({
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        toJSON: () => {},
    });
    const resizeObserverRef = useRef<ResizeObserver>();

    useLayoutEffect(() => {
        setRect((prevRect) => {
            if (ref.current) {
                return ref.current.getBoundingClientRect();
            } else {
                return { ...prevRect };
            }
        });

        resizeObserverRef.current = new ResizeObserver((entries) => {
            setRect(entries[0].target.getBoundingClientRect());
        });

        resizeObserverRef.current.observe(ref.current!);

        return () => {
            resizeObserverRef.current?.disconnect();
        };
    }, []);

    return [ref, rect] as const;
}
