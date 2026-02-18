import { useInterval } from "hooks/useInterval";
import { useState } from "react";

export const AnimatedEllipsis = () => {
    const [points, setPoints] = useState(["."]);

    useInterval(() => {
        setPoints((prevPoints) => {
            return new Array((prevPoints.length + 1) % 4).fill(".");
        });
    }, 800);

    return <span>{points}</span>;
};
