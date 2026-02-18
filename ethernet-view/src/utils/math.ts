export function getVectorLimits(vector: number[]): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    vector.forEach((value) => {
        min = value < min ? value : min;
        max = value > max ? value : max;
    });

    return [min, max];
}

export function getMultipleVectorsLimits(vectors: number[][]) {
    let [minOfLines, maxOfLines] = [Infinity, -Infinity];
    for (let vector of vectors) {
        const [localMin, localMax] = getVectorLimits(vector);
        if (localMin < minOfLines) {
            minOfLines = localMin;
        }
        if (localMax > maxOfLines) {
            maxOfLines = localMax;
        }
    }
    return [minOfLines, maxOfLines];
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(min, value), max);
}
