export type ColorScheme = "default" | "pink" | "twight";

export const colorSchemes: Record<
  ColorScheme,
  { label: string; next: ColorScheme }
> = {
  default: { label: "Normal", next: "pink" },
  pink: { label: "Claudia", next: "twight" },
  twight: { label: "Twight", next: "default" },
};
