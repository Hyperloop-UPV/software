export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multi-checkbox"
  | "path";

export interface SettingField {
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  path: string;
}

export interface SettingsSection {
  title: string;
  fields: SettingField[];
}
