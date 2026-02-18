import { clamp } from "utils/math";

export type HSLAColor = {
    h: number;
    s: number;
    l: number;
    a: number;
};

type RGBAColor = {
    r: number;
    g: number;
    b: number;
    a: number;
};

export function hslaToHex({ h, s, l, a }: HSLAColor): RGBAColor {
    l /= 100;
    const a2 = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, "0"); // convert to Hex and prefix "0" if needed
    };
    return {
        r: parseInt(f(0)),
        g: parseInt(f(8)),
        b: parseInt(f(4)),
        a: a,
    };
}

export function getSofterHSLAColor(
    { h, s, l, a }: HSLAColor,
    lightnessOffset: number
): HSLAColor {
    return { h, s, l: clamp(l + lightnessOffset, 0, 100), a: a } as HSLAColor;
}

export function hslaToString({ h, s, l, a }: HSLAColor): string {
    return `hsl(${h},${s}%,${l}%,${a})`;
}

export function parseHSL(colorStr: string): HSLAColor {
    const matches = colorStr
        .replaceAll(" ", "")
        .match(/hsl\((\d{1,3}),(\d{1,3})%,(\d{1,3})%\)/)!;
    const h = parseInt(matches[1]);
    const s = parseInt(matches[2]);
    const l = parseInt(matches[3]);

    return { h, s, l, a: 1 };
}

export function lightenHSL(color: string, lOffset: number): string {
    const matches = color
        .replaceAll(" ", "")
        .match(/hsl\((\d{1,3}),(\d{1,3})%,(\d{1,3})%\)/)!;
    const h = matches[1];
    const s = matches[2];
    const l = matches[3];
    const newLightness = Math.min(parseInt(l) + lOffset, 100);
    return `hsl(${h}, ${s}%, ${newLightness}%)`;
}