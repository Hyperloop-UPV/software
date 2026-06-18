/**
 * Shape returned by GET /boards on the BLCU Python server.
 * The `host` field is used as the TFTP target for uploads.
 */
export type Board = {
  name: string;
  host: string;
  operational_state: string;
  flashing_state: string;
};
