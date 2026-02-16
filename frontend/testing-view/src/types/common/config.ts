/**
 * Type of the field value in the config data.
 */
export type ConfigField = string | string[] | number | boolean;

/**
 * Configuration type used in app slice to store values from the form.
 */
export type ConfigData = {
  [section: string]: {
    [field: string]: ConfigField;
  };
};
