import { type TelemetryPacket, type VariableValue } from "./types";

/**
 * Helper to extract a numeric value for comparison.
 * Handles both primitive numbers, booleans and { last, average } objects.
 */
const getNumericValue = (
  val: VariableValue | undefined,
): number | undefined => {
  if (typeof val === "number") {
    return val;
  }

  if (typeof val === "boolean") {
    return val ? 1 : 0;
  }

  if (
    typeof val === "object" &&
    val !== null &&
    "last" in val &&
    "average" in val
  ) {
    return val.last;
  }

  return undefined;
};

/**
 * Downsamples a buffer of packets using the min-max algorithm.\
 * It considers only numeric variables, booleans and { last, average } object variables.
 *
 * The idea is to reduce the number of packets in the buffer by keeping only the min and max packets
 * to prevent the app from freezing when there are too many packets. (Usually happens on start)
 *
 * @param buffer - array of packets to downsample, should contain at least 2 elements
 * @returns downsampled buffer with only min and max packets from the original buffer (in chronological order)
 */
export const minMaxDownsample = (buffer: TelemetryPacket[]) => {
  if (buffer.length < 2) return buffer;

  let minIdx = 0;
  let maxIdx = 0;

  buffer.forEach((packet, i) => {
    const measurements = packet.measurementUpdates || {};

    // At the beginning the initial champion is the first variable in the packet
    const firstKey = Object.keys(measurements)[0];
    if (!firstKey) return;

    const rawVal = measurements[firstKey];
    const val = getNumericValue(rawVal);

    const minVal = getNumericValue(
      buffer[minIdx]?.measurementUpdates[firstKey],
    );
    const maxVal = getNumericValue(
      buffer[maxIdx]?.measurementUpdates[firstKey],
    );

    // Compare local min and max with the global champions
    // If one of them is undefined, use Infinity or -Infinity respectively
    if (val !== undefined) {
      if (val < (minVal ?? Infinity)) minIdx = i;
      if (val > (maxVal ?? -Infinity)) maxIdx = i;
    }
  });

  // Return them in chronological order to maintain X-axis integrity
  const result =
    minIdx < maxIdx
      ? [buffer[minIdx], buffer[maxIdx]]
      : [buffer[maxIdx], buffer[minIdx]];

  return result;
};
