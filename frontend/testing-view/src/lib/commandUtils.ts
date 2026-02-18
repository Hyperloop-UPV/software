import type {
  CommandParameter,
  EnumCommandParameter,
} from "../types/data/commandCatalogItem";

export const getDefaultParameterValues = (
  fields: Record<string, CommandParameter>,
): Record<string, any> => {
  const defaults: Record<string, any> = {};

  Object.entries(fields).forEach(([key, field]) => {
    if (field.kind === "numeric") {
      defaults[key] = 0;
    } else if (field.kind === "enum") {
      defaults[key] = (field as EnumCommandParameter).options[0] || "";
    } else if (field.kind === "boolean") {
      defaults[key] = false;
    }
  });

  return defaults;
};
