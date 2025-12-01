# Tests (`__tests__/`)

Test suite for the configuration management module using Vitest.

## Overview

Comprehensive test coverage for ConfigManager class and TOML update utilities. All tests use mocked filesystem operations.

## Test Files

- `ConfigManager.initialization.test.js` - Tests ConfigManager initialization and template copying
- `ConfigManager.read-write.test.js` - Tests read, write, and update operations
- `ConfigManager.utilities.test.js` - Tests utility methods (backup, reset, validate)
- `updateTomlValue.test.js` - Tests single value update utility with comment preservation
- `updateTomlFromObject.test.js` - Tests bulk config update from object

## Test Coverage

- **Initialization**: Directory creation, template copying, error handling
- **Read/Write**: TOML parsing, file operations, error cases
- **Updates**: Single value updates, bulk updates, comment preservation
- **Utilities**: Backup creation, template reset, validation

## Running Tests

Run tests with:
npm test## Dependencies

- `vitest` - Testing framework
- `fs` - Mocked filesystem module

## Notes

- All filesystem operations are mocked using Vitest's `vi.mock()`
- Tests verify comment and formatting preservation
- Error handling and edge cases are covered
- Tests use isolated test data to avoid side effects

## See Also

- [../configManager.js](../configManager.js) - Implementation being tested
- [../configInstance.js](../configInstance.js) - Singleton wrapper
