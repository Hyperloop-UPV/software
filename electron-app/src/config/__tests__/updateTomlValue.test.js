import { describe, it, expect, vi } from "vitest";
import { updateTomlValue } from "../configManager.js";

describe("updateTomlValue", () => {
  it("should update a string value in root section", () => {
    const toml = `# Config file
name = "old value" # inline comment
enabled = true    # Testing comment`;

    let result = updateTomlValue(toml, null, "name", "new value");
    result = updateTomlValue(result, null, "enabled", false);

    expect(result).toContain('name = "new value" # inline comment');
    expect(result).toContain("enabled = false    # Testing comment");
  });

  it("should update key correctly", () => {
    const toml = `key = "value"`;

    const result = updateTomlValue(toml, null, "key", "new data");

    expect(result).toContain('key = "new data"');
  });

  it("should update a boolean value", () => {
    const toml = `enabled = true
debug = false`;

    const result = updateTomlValue(toml, null, "enabled", false);

    expect(result).toContain("enabled = false");
    expect(result).toContain("debug = false");
  });

  it("should update a value in a specific section", () => {
    const toml = `
    [app]
    window_opening = "both"
    
    [database]
    host = "localhost"
    port = 5432`;

    const result = updateTomlValue(toml, "database", "host", "127.0.0.1");

    expect(result).toContain('host = "127.0.0.1"');
  });

  it("should update multiple values in a specific sections", () => {
    const toml = `
    [app]
    window_opening = "both"

    [tcp]
    keep_alive_ms = 1000
    connection_timeout_ms = 1000
    block_size = 131072
    timeout_ms = 5000
    backoff_max_ms = 5000

    [database]
    host = "localhost"
    port = 5432`;

    let result = updateTomlValue(toml, "database", "host", "127.0.0.1");
    expect(result).toContain('host = "127.0.0.1"');

    result = updateTomlValue(toml, "tcp", "block_size", "130000");
    expect(result).toContain('block_size = "130000"');

    result = updateTomlValue(toml, "tcp", "timeout_ms", "5000");
    expect(result).toContain('timeout_ms = "5000"');

    result = updateTomlValue(toml, "app", "window_opening", "both");
    expect(result).toContain('window_opening = "both"');
  });

  it("should preserve indentation and comments", () => {
    const toml = `[section]
    key = "value" # important comment
    other = 123`;

    const result = updateTomlValue(toml, "section", "key", "updated");

    expect(result).toContain('    key = "updated" # important comment');
  });

  it("should work with CR/LF line endings", () => {
    const toml = `key = "value"\r\nother = 123`;

    const result = updateTomlValue(toml, null, "other", 500);

    expect(result).toContain("other = 500");
    expect(result).toContain('key = "value"');
  });

  it("should handle array values", () => {
    const toml = `items = ["a", "b"]`;

    const result = updateTomlValue(toml, null, "items", ["x", "y", "z"]);

    expect(result).toContain('items = ["x", "y", "z"]');
  });

  it("should escape special characters in strings", () => {
    const toml = `path = "C:\\old\\path"`;

    const result = updateTomlValue(toml, null, "path", "C:\\new\\path");

    expect(result).toContain('path = "C:\\\\new\\\\path"');
  });

  it("should handle quotes in strings", () => {
    const toml = `message = "hello"`;

    const result = updateTomlValue(toml, null, "message", 'say "hello"');

    expect(result).toContain('message = "say \\"hello\\""');
  });

  it("should skip null and undefined values", () => {
    const toml = `key = "value"`;

    const resultNull = updateTomlValue(toml, null, "key", null);
    const resultUndefined = updateTomlValue(toml, null, "key", undefined);

    expect(resultNull).toBe(toml);
    expect(resultUndefined).toBe(toml);
  });

  it("should warn when key not found", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const toml = `existing = "value"`;

    updateTomlValue(toml, null, "nonexistent", "value");

    expect(consoleSpy).toHaveBeenCalledWith(
      'Warning: Key "nonexistent" in section "root" not found'
    );

    consoleSpy.mockRestore();
  });

  it("should not update keys in wrong section", () => {
    const toml = `key = "root"

[section]
key = "section"`;

    const result = updateTomlValue(toml, "section", "key", "updated");

    expect(result).toContain('key = "root"');
    expect(result).toContain('key = "updated"');
  });

  it("should preserve empty lines", () => {
    const toml = `key1 = "value1"

key2 = "value2"`;

    const result = updateTomlValue(toml, null, "key1", "updated");

    expect(result.split("\n").filter((l) => l === "").length).toBeGreaterThan(
      0
    );
  });

  it("should not corrupt a [section]-like line inside a multiline string", () => {
    const toml = `[app]
note = """
[not-a-section]
just text
"""
name = "old"`;

    const result = updateTomlValue(toml, "app", "name", "new");

    expect(result).toContain('name = "new"');
    expect(result).toContain("[not-a-section]");
  });

  it("should not update a key inside a multiline string", () => {
    const toml = `[app]
note = """
name = "inside multiline"
"""
name = "real"`;

    const result = updateTomlValue(toml, "app", "name", "updated");

    expect(result).toContain('name = "updated"');
    expect(result).toContain('name = "inside multiline"');
    expect(result.indexOf('name = "inside multiline"')).toBeLessThan(
      result.indexOf('name = "updated"')
    );
  });

  it("should handle a multiline string that opens and closes on the same line", () => {
    const toml = `[app]
note = """single line multiline"""
name = "old"`;

    const result = updateTomlValue(toml, "app", "name", "new");

    expect(result).toContain('name = "new"');
    expect(result).toContain('note = """single line multiline"""');
  });
});
