export type ConfigField = string | string[] | number | boolean;

export interface ConfigData {
  [section: string]: {
    [field: string]: ConfigField;
  };
}
