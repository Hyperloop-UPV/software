/**
 * Type of the field component showed in the settings form and defined in the settings schema (configuration).
 */
export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multi-checkbox"
  | "path"
  | "combobox";

/**
 * Generic props for a field component showed in the settings form.\
 * @template T - The type of the field value.
 * **!IMPORTANT:** it is a type used for input component and possibly doesn't match the actual type of the field value.\
 * **E.g.** number field value T should be a string, but the actual type is number.
 */
export interface FieldProps<T> {
  /** Field configuration */
  field: SettingField;
  /** Current value of the field */
  value: T;
  /** Function to handle the change of the field value */
  onChange: (value: T) => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * One item of the settings schema from config.toml.
 */
export type SettingField = {
  /** Label of the field. The text showed above the field itself. */
  label: string;

  /** Type of the field. It affects what kind of component is showed in the interface.\
   * **E.g.** checkboxes or multiple choice section. */
  type: FieldType;

  /** Options of the field */
  options?: string[];

  /** Placeholder of the field. The text showed inside the field when it is empty. */
  placeholder?: string;

  /** Path to the field in the config.toml configuration.\
   * **Note:** it should match config.toml section and variable name.\
   * **E.g.** `vehicle.boards` or `adj.branch`. */
  path: string;
};

/**
 * One section of the settings from config.toml.
 */
export type SettingsSection = {
  /** Title of the section */
  title: string;

  /** Fields of the section */
  fields: SettingField[];
};
