/**
 * @fileoverview
 * Reusable TypeScript utilities with JSDoc documentation.
 * Import what you need from this module.
 */

/**
 * Represents an application-level error with a machine-readable code.
 */
export class AppError extends Error {
  /** A stable error code for programmatic handling. */
  public readonly code: string;

  /**
   * Creates a new {@link AppError}.
   *
   * @param code - Machine-readable error code (e.g., "VALIDATION_FAILED").
   * @param message - Human-readable error message.
   */
  constructor(code: string, message: string ) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

/**
 * Narrows a value by ensuring it is neither `null` nor `undefined`.
 *
 * @typeParam T - The value type.
 * @param value - Value to check.
 * @param message - Message used if the assertion fails.
 * @throws {@link AppError} If `value` is `null` or `undefined`.
 * @returns The same value, but typed as non-nullable.
 *
 * @example
 * const port = assertDefined(process.env.PORT, "PORT is required");
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = "Value is required"
): T {
  if (value === null || value === undefined) {
    throw new AppError("ASSERT_DEFINED_FAILED", message);
  }
  return value;
}

/**
 * Ensures a condition is true; otherwise throws an {@link AppError}.
 *
 * @param condition - Condition that must be truthy.
 * @param code - Machine-readable error code.
 * @param message - Human-readable error message.
 * @throws {@link AppError} If `condition` is falsy.
 *
 * @example
 * invariant(user.isActive, "USER_INACTIVE", "User must be active to proceed.");
 */
export function invariant(
  condition: unknown,
  code: string,
  message: string
): asserts condition {
  if (!condition) {
    throw new AppError(code, message);
  }
}

/**
 * Returns a debounced version of a function.
 * The debounced function delays invoking `fn` until after `waitMs` milliseconds
 * have elapsed since the last time it was called.
 *
 * @typeParam TArgs - Function argument tuple.
 * @typeParam TResult - Function return type.
 * @param fn - Function to debounce.
 * @param waitMs - Debounce delay in milliseconds.
 * @returns A debounced function with a `cancel()` method.
 *
 * @example
 * const debouncedSave = debounce((value: string) => save(value), 300);
 * debouncedSave("hello");
 * debouncedSave.cancel();
 */
export function debounce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  waitMs: number
): ((...args: TArgs) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: TArgs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
}

/**
 * Safely parses a JSON string.
 *
 * @typeParam T - Expected type of the parsed object.
 * @param input - JSON string input.
 * @returns The parsed value on success, or `null` on failure.
 *
 * @example
 * const obj = safeJsonParse<{ id: string }>('{"id":"123"}');
 */
export function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

/**
 * Creates a stable, URL-friendly slug from a string.
 *
 * @param text - Input text.
 * @returns A lowercase slug with hyphens.
 *
 * @example
 * slugify("Hello, World!") // "hello-world"
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Measures execution time of a synchronous function.
 *
 * @typeParam T - Return type of the function.
 * @param label - A label for logging or reporting.
 * @param fn - The function to execute.
 * @returns An object containing `label`, `result`, and `elapsedMs`.
 *
 * @example
 * const { elapsedMs } = timeIt("sum", () => 1 + 2);
 */
export function timeIt<T>(
  label: string,
  fn: () => T
): { label: string; result: T; elapsedMs: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { label, result, elapsedMs: end - start };
}
