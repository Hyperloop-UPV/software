import { useLayoutEffect, useRef } from "react";

const AUTO_THRESHOLD = 30;

export function useAutoScroll(items: Array<unknown>) {
    const ref = useRef<HTMLElement>(null);
    const autoScroll = useRef(true);
    const prevScrollTop = useRef<number>();

    useLayoutEffect(() => {
        if (ref.current && autoScroll.current) {
            ref.current.scroll({
                top: ref.current.scrollHeight,
                behavior: "auto",
            });
        }
    }, [items]);

    function handleScroll(ev: React.UIEvent<HTMLElement, UIEvent>) {
        // If user scrolls up, auto = false
        if (
            prevScrollTop.current &&
            ev.currentTarget.scrollTop < prevScrollTop.current
        ) {
            autoScroll.current = false;
        } else if (
            // If user scroll to the bottom, auto = true
            Math.abs(
                ev.currentTarget.scrollTop +
                    ev.currentTarget.offsetHeight -
                    ev.currentTarget.scrollHeight
            ) < AUTO_THRESHOLD
        ) {
            autoScroll.current = true;
        }

        prevScrollTop.current = ev.currentTarget.scrollTop;
    }

    return { ref, handleScroll };
}
