export const minMaxDownsample = (buffer: any[]) => {
  let minIdx = 0;
  let maxIdx = 0;

  buffer.forEach((packet, i) => {
    const measurements = packet.measurementUpdates || {};
    const firstKey = Object.keys(measurements)[0];
    const val = measurements[firstKey as keyof typeof measurements];

    if (typeof val === "number") {
      if (val < (buffer[minIdx].measurementUpdates[firstKey] ?? Infinity))
        minIdx = i;
      if (val > (buffer[maxIdx].measurementUpdates[firstKey] ?? -Infinity))
        maxIdx = i;
    }
  });

  // 4. Return them in chronological order to maintain X-axis integrity
  const result =
    minIdx < maxIdx
      ? [buffer[minIdx], buffer[maxIdx]]
      : [buffer[maxIdx], buffer[minIdx]];

  return result;
};
