// Color classes for ADJ measurement type badges — shared across all views.
export const typeBadgeClasses = {
  float:
    "bg-sky-500/20 text-sky-400 border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
  integer:
    "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400",
  uint:
    "bg-orange-500/20 text-orange-500 border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-400",
  enum: "bg-violet-500/20 text-violet-500 border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-400",
  boolean:
    "bg-amber-500/20 text-amber-500 border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400",
  unknown:
    "bg-slate-500/20 text-slate-400 border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
};

export const getTypeBadgeClass = (type: string): string => {
  switch (type.toLowerCase()) {
    case "float":
    case "float32":
    case "float64":
      return typeBadgeClasses.float;

    case "integer":
    case "int":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
      return typeBadgeClasses.integer;

    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
      return typeBadgeClasses.uint;

    case "string":
    case "enum":
      return typeBadgeClasses.enum;

    case "boolean":
    case "bool":
      return typeBadgeClasses.boolean;

    default:
      return typeBadgeClasses.unknown;
  }
};
