// Colors for enum variants. Nothing in the monorepo did this before: the kit's
// getTypeBadgeClass colors by measurement *type*, and Plot Studio picks trace
// colors by position. Two requirements shape this list:
//   - it must not include the orange reserved for order markers
//     (see lib/plotStudio/palette.ts), and
//   - behind a line chart it has to stay out of the way, so the band variant
//     is deliberately pale.
const ENUM_HUES = [
  "#1f77b4", // blue
  "#2ca02c", // green
  "#9467bd", // purple
  "#17becf", // cyan
  "#bcbd22", // olive
  "#e377c2", // pink
  "#8c564b", // brown
  "#0f766e", // teal
  "#6b7280", // gray
  "#d62728", // red
] as const;

/** Opaque color for a variant, for a timeline row or a legend swatch. */
export function enumVariantColor(index: number): string {
  return ENUM_HUES[((index % ENUM_HUES.length) + ENUM_HUES.length) % ENUM_HUES.length];
}

/**
 * The same color as a translucent wash, for a band drawn behind curves.
 * Dark mode needs a touch more alpha to read against the darker panel.
 */
export function enumBandColor(index: number, isDarkMode: boolean): string {
  const hex = enumVariantColor(index);
  const alpha = isDarkMode ? 0.28 : 0.18;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
