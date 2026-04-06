export const config = {
  /** Default buffer size for a new chart. */
  DEFAULT_CHART_HISTORY_LIMIT: 100,

  /** Fallback history limit for a chart. Used when the history limit is not set. */
  FALLBACK_CHART_HISTORY_LIMIT: 100,

  /** Minimum history limit for the chart buffer size slider. */
  CHART_HISTORY_MIN: 50,

  /** Maximum history limit for the chart buffer size slider. */
  CHART_HISTORY_MAX: 5000,

  /** Step size for the chart buffer size slider. */
  CHART_HISTORY_STEP: 50,

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

  /** GitHub repository used to fetch available branches for ADJ configuration. */
  ADJ_GITHUB_REPO: "hyperloop-upv/adj",

  /** Timeout for fetching branches from GitHub API. */
  BRANCHES_FETCH_TIMEOUT: 5000,
} as const;
