export const config = {
  /** Default buffer size for a new chart. */
  DEFAULT_CHART_HISTORY_LIMIT: 100,

  /** Fallback history limit for a chart. Used when the history limit is not set. */
  FALLBACK_CHART_HISTORY_LIMIT: 100,

  /** Default height of chart. */
  DEFAULT_CHART_HEIGHT: 250,

  /** Width of lines in chart between points. */
  CHART_LINE_WIDTH: 2,

  /** Size of points in chart (not hovered state). */
  CHART_POINT_SIZE: 2,

  /** Maximum number of messages section to store. */
  MAX_MESSAGES_COUNT: 200,

  /** Timeout for logger response or time to invalidate logger status after start button click. */
  LOGGER_RESPONSE_TIMEOUT: 2000,

  /** Timeout applied after settings save to give enough time for backend to restart. */
  SETTINGS_RESPONSE_TIMEOUT: 1000,
} as const;
