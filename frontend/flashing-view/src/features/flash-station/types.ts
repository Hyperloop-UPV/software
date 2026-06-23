export type Board = {
  name: string;
  accessible: boolean;
};

export type GeneralState = "Connecting" | "Operational" | "Fault";
export type OperationalState = "Idle" | "Flashing";

export type BoardsResponse = {
  boards: Record<string, boolean>;
  general_state_machine: GeneralState;
  operational_state_machine: string;
};
