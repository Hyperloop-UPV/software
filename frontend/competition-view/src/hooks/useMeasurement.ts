import { useStore } from "../store/store";

/**
 * Reads a single telemetry measurement from the store by its backend key
 * (e.g. "VCU/general_state"). Returns `undefined` if no data has arrived yet.
 */
const useMeasurement = (key: string) =>
  useStore((s) => s.getMeasurement(key));

export default useMeasurement;
