/**
 * One connection to the vehicle.
 */
export type Connection = {
  /** Name of the connection */
  name: string;

  /** Whether the connection is established */
  isConnected: boolean;
};
