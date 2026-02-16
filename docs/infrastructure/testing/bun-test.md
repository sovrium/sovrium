# Bun Test Runner (Unit Tests)

## Overview

**Purpose**: Built-in fast test runner for unit testing isolated functions, classes, and utilities. Bun Test runs unit tests, while Playwright handles end-to-end (E2E) tests.

## Test File Patterns (Unit Tests)

Bun Test supports multiple test file patterns:

- `*.test.ts`, `*.test.tsx` (RECOMMENDED for unit tests)
- `*.spec.ts`, `*.spec.tsx`
- `*_test.ts`, `*_test.tsx`
- Files in `__tests__` directories

## IMPORTANT: Test File Location

- **Unit Tests (Bun)**: Place `*.test.ts` or `*.test.tsx` files alongside source code (e.g., `src/calculator.test.ts`)
- **E2E Tests (Playwright)**: Place `*.spec.ts` files in `specs/` directory (e.g., `specs/login.spec.ts`)
- **Script Tests (Bun)**: Place `*.test.ts` files alongside scripts (e.g., `scripts/export-schema.test.ts`)

## Test File Naming Convention

**File naming convention is CRITICAL for avoiding test runner conflicts**:

| Test Type        | Extension  | Location               | Example                         |
| ---------------- | ---------- | ---------------------- | ------------------------------- |
| **Unit Tests**   | `.test.ts` | Co-located with source | `src/calculator.test.ts`        |
| **Script Tests** | `.test.ts` | Co-located with script | `scripts/export-schema.test.ts` |
| **E2E Tests**    | `.spec.ts` | `specs/` directory     | `specs/login.spec.ts`           |

**Why this convention is REQUIRED**:

- **Pattern Filtering**: Bun test command uses `.test.ts` as a **pattern filter** (NOT a file path)
- **Automatic Separation**: `.test.ts` matches ONLY unit tests, `.spec.ts` matches ONLY E2E tests
- **No Conflicts**: Playwright spec files (`.spec.ts`) are automatically excluded from Bun test runs
- **Tool Compatibility**: Bun recognizes both patterns, Playwright defaults to `.spec.ts`
- **Industry Standard**: Matches patterns used by Jest, Vitest, Playwright
- **Searchability**: Easy to find all unit tests (`**/*.test.ts`) or E2E tests (`specs/**/*.spec.ts`)

**DO NOT use `.spec.ts` for unit tests** - This will cause Bun to discover Playwright E2E test files and fail with "test.describe is not a function" errors.

## Test Commands

### ✅ Pattern Filter Approach (RECOMMENDED)

**CORRECT - Use pattern filters to match only unit test files:**

```bash
bun test:unit                        # Runs ONLY .test.ts and .test.tsx files (project-wide)
bun test:unit:watch                  # Watch mode for unit tests
CLAUDECODE=1 bun test:unit           # AI-optimized output (failures only)
```

**Why this works**: The command `bun test .test.ts .test.tsx` uses `.test.ts` and `.test.tsx` as **pattern filters** (NOT file paths or directory paths). Bun searches the entire project and ONLY runs files whose names contain these patterns.

**Pattern Matching Behavior**:

- `bun test .test.ts` → Matches `calculator.test.ts`, `utils.test.ts`, etc.
- Pattern filters exclude `.spec.ts` files → No Playwright conflicts ✅
- Searches entire project → Finds tests in src/, scripts/, and subdirectories automatically
- Automatic separation → Unit tests (`.test.ts`) vs E2E tests (`.spec.ts`)
- Clean results → 681 unit tests pass, 0 Playwright spec files loaded

**Alternative approaches (also safe):**

```bash
bun test src/calculator.test.ts      # ✅ Specific file path (safe)
bun test --concurrent .test.ts .test.tsx  # ✅ Pattern filters with concurrency (safe)
bun test scripts/                    # ✅ Specific directory (safe if no .spec.ts files)
```

**❌ AVOID - Using `bun test` without pattern filters:**

```bash
bun test                             # ❌ Discovers ALL test files including .spec.ts
                                     # ❌ Result: "test.describe is not a function" errors
```

### Native Command vs Script Wrapper

`bun test` is a **native Bun command** that directly invokes Bun's built-in test runner. The `bun test:unit` script wrapper uses pattern filters to ensure ONLY unit test files are discovered.

**Pattern Filter Command (Recommended)**:

```bash
bun test --concurrent .test.ts .test.tsx   # Pattern filters (NOT directory paths)
```

**Additional commands:**

```bash
# Coverage (with pattern filters)
bun test:unit:coverage               # Generate coverage report

# Filtering by test name (with pattern filters)
bun test --grep "calculator" .test.ts .test.tsx

# Bail on first failure (built into test:unit via check-quality.ts)
bun test --bail --concurrent .test.ts .test.tsx

# Timeout (with pattern filters)
bun test --timeout 5000 .test.ts .test.tsx
```

## AI-Assisted Development Optimization

### Recommended Command for AI Workflows

**For Claude Code (AI-assisted development)**:

```bash
CLAUDECODE=1 bun test:unit
```

**For humans (manual testing)**:

```bash
bun test:unit
```

These commands use a package.json script that automatically runs tests with pattern filters (`bun test .test.ts .test.tsx`) with optimized flags (`--concurrent` for parallel execution).

**Why use pattern filters instead of directory paths?**

1. **Automatic separation** - `.test.ts` pattern matches ONLY unit tests, excludes `.spec.ts` (Playwright E2E)
2. **No Playwright conflicts** - Pattern filters prevent Bun from discovering Playwright spec files
3. **Consistent behavior** - Same command works everywhere (development, CI/CD)
4. **Future-proof** - Easy to update flags globally without changing every command
5. **Simpler command** - No need to list all directories (`src/`, `scripts/`, etc.)

### `--concurrent` Flag

**Purpose**: Run all tests concurrently within their respective files for maximum speed.

**Behavior**:

- Tests within each file execute in parallel
- Dramatically reduces total test execution time
- Safe for independent unit tests (no shared state)
- Maintains test isolation within files

**Example**:

```bash
# Sequential (default) - manual command
bun test .test.ts .test.tsx              # ~5 seconds for 50 tests

# Concurrent - manual command
bun test --concurrent .test.ts .test.tsx # ~1.5 seconds for 50 tests

# With script (includes --concurrent automatically)
bun test:unit                            # ~1.5 seconds for 50 tests
```

**When to Use**:

- ✅ Unit tests with no shared state
- ✅ Pure function tests
- ✅ Script tests in `scripts/` directory
- ❌ Tests that share mutable global state
- ❌ Tests that modify the same files/database

### `CLAUDECODE=1` Environment Variable

**Purpose**: Reduce test output verbosity for AI context efficiency while maintaining visibility into failures.

**Behavior**:

- ✅ **Test failures are displayed in detail** (full error messages, stack traces, diffs)
- ✅ **Summary statistics remain intact** (total tests, passed, failed, duration)
- ❌ **Passing test indicators are hidden** (no green checkmarks for each passing test)
- ❌ **Skipped test indicators are hidden** (no yellow indicators for skipped tests)
- ❌ **Todo test indicators are hidden** (no cyan indicators for todo tests)

**Why This Matters for AI Development**:

1. **Context Efficiency**: AI assistants have limited context windows. Hiding passing test noise preserves context for actual failures.
2. **Signal-to-Noise Ratio**: Only failures matter during development. Passing tests provide no actionable information.
3. **Faster Analysis**: Claude Code can immediately focus on failures without parsing hundreds of passing test lines.
4. **Token Conservation**: Reduced output means more tokens available for code analysis and fixes.

**Output Comparison**:

```bash
# WITHOUT CLAUDECODE=1 (verbose)
✓ calculator.add should add two numbers
✓ calculator.add should handle negative numbers
✓ calculator.add should handle zero
✓ calculator.subtract should subtract numbers
✗ calculator.divide should throw on division by zero
  Expected error to be thrown

  at divide (calculator.ts:15:10)
  at Object.<anonymous> (calculator.test.ts:28:12)

✓ calculator.divide should divide numbers
✓ calculator.multiply should multiply numbers
~ calculator.power is not implemented yet (skipped)
⏭ calculator.sqrt (todo)

Tests: 6 passed, 1 failed, 1 skipped, 1 todo, 9 total
Time: 145ms
```

```bash
# WITH CLAUDECODE=1 (focused)
✗ calculator.divide should throw on division by zero
  Expected error to be thrown

  at divide (calculator.ts:15:10)
  at Object.<anonymous> (calculator.test.ts:28:12)

Tests: 6 passed, 1 failed, 1 skipped, 1 todo, 9 total
Time: 145ms
```

**Notice**: Only the failure is shown, but the summary still reports all test counts. This gives Claude Code exactly what it needs: the failure to fix and confirmation that other tests passed.

### Combined Usage

**For Claude Code (AI-assisted development)**:

```bash
# Run all unit tests with AI optimization
CLAUDECODE=1 bun test:unit

# Run specific file with optimization
CLAUDECODE=1 bun test --concurrent ./src/calculator.test.ts

# Watch mode with optimization (continuous TDD)
CLAUDECODE=1 bun test:unit:watch
```

**For humans (manual testing)**:

```bash
# Run all unit tests
bun test:unit

# Run specific file
bun test --concurrent ./src/calculator.test.ts

# Watch mode
bun test:unit:watch
```

### Required package.json Scripts

The project uses **pattern filters** to ensure ONLY unit test files are discovered:

```json
{
  "scripts": {
    "test:unit": "bun test --concurrent .test.ts .test.tsx",
    "test:unit:watch": "bun test --concurrent --watch .test.ts .test.tsx",
    "test:unit:coverage": "bun test --concurrent --coverage .test.ts .test.tsx"
  }
}
```

**Why pattern filters instead of directory paths or glob patterns?**

- **Pattern matching** - `.test.ts` and `.test.tsx` are treated as **pattern filters**, NOT file paths
- **Automatic separation** - Matches ONLY files containing `.test.ts` or `.test.tsx` in their names
- **Excludes .spec.ts** - Playwright spec files automatically excluded (no conflicts) ✅
- **Simpler syntax** - No need to list all directories or use glob patterns
- **Project-wide search** - Finds tests in src/, scripts/, and all subdirectories
- **Future-proof** - Works even if new directories are added

**For AI-assisted development**, Claude Code will use:

```bash
CLAUDECODE=1 bun test:unit  # Optimized output for AI context efficiency
```

**For human development**, you'll use:

```bash
bun test:unit  # Full verbose output for human review
```

### When NOT to Use CLAUDECODE=1

Avoid `CLAUDECODE=1` when:

- **Debugging passing tests**: You need to see all test output to verify test behavior
- **CI/CD pipelines**: Full output provides better visibility in logs (though it's still safe to use)
- **Test development**: Writing new tests and want to see all output
- **Human-only review**: Developers may prefer seeing all passing tests

For these scenarios, use standard commands:

```bash
# Standard output (all tests visible)
bun test:unit

# Specific directory without script
bun test --concurrent src/

# Pattern filters with full verbosity
bun test --concurrent --verbose .test.ts .test.tsx
```

## Test Structure

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test'

describe('Feature', () => {
  beforeEach(() => {
    // Setup before each test
  })

  test('should do something', () => {
    expect(2 + 2).toBe(4)
    expect(value).toEqual(expectedObject)
    expect(fn).toThrow()
  })

  test.skip('skipped test', () => {})
  test.only('focused test', () => {})
  test.todo('future test')
})
```

## Assertions

Built-in Jest-compatible matchers:

```typescript
// Equality
expect(value).toBe(42)
expect(value).toEqual({ key: 'value' })
expect(value).not.toBe(null)

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(10)
expect(value).toBeLessThan(100)
expect(value).toBeCloseTo(3.14, 2)

// Strings
expect(text).toMatch(/pattern/)
expect(text).toContain('substring')

// Arrays and iterables
expect(array).toContain(item)
expect(array).toHaveLength(5)

// Objects
expect(object).toHaveProperty('key')
expect(object).toMatchObject({ key: 'value' })

// Functions
expect(fn).toThrow()
expect(fn).toThrow(Error)
expect(fn).toThrow('error message')

// Snapshots
expect(value).toMatchSnapshot()
```

## Mocking

### Function Mocks and Spies (Safe)

```typescript
import { mock, spyOn } from 'bun:test'

// Mock functions
const mockFn = mock((x: number) => x * 2)
mockFn(5)
expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith(5)

// Spy on object methods
const spy = spyOn(object, 'method')
spy.mockReturnValue(42)
spy.mockResolvedValue('async value')
spy.mockRejectedValue(new Error('error'))
```

### ⚠️ CRITICAL: mock.module() Process-Global Contamination

**DO NOT USE `mock.module()` IN TESTS** - It causes process-global module cache contamination.

> **📖 See Also**: For the architectural decision and recommended dependency injection patterns, see [Test Mocking Strategy](../../architecture/testing-strategy/16-test-mocking-dependency-injection-over-mock-module.md).

#### The Problem

Bun's `mock.module()` (from `bun:test`) is **process-global**, NOT file-scoped. When `file-A.test.ts` calls `mock.module('@/some/module', ...)`, ALL subsequent test files that import `@/some/module` get the mocked version, even after `mock.restore()`.

**Why This Happens**:

1. `mock.module()` replaces module entries in Bun's internal module resolution cache
2. `mock.restore()` clears mock factory registrations but does NOT evict already-cached module evaluations
3. All test files share the same Bun process (even with sequential execution)
4. The mock persists in the module cache for the lifetime of the test process

#### Linux vs macOS Gotcha

This contamination manifests differently on macOS (local) vs Linux (CI):

- **macOS (HFS+/APFS)**: Files iterated alphabetically → Contamination happens in predictable order
- **Linux (ext4)**: Files iterated by inode order → Contamination appears random/non-deterministic
- **Result**: Tests pass locally on macOS but fail randomly on GitHub Actions (Linux)

**Real-World Impact**: 24 test failures on Linux CI (all tests passed locally on macOS) caused by 2 "polluter" test files using `mock.module()`.

#### Failed Mitigation Strategies

These approaches **DO NOT** fix the contamination:

❌ **mock.restore() in afterEach()** - Clears factory registrations but NOT cached module evaluations
❌ **Sequential test execution** - Tests still share the same process and module cache
❌ **Isolated describe blocks** - Module cache is process-global, not scope-scoped
❌ **Dynamic imports** - Module cache contamination persists regardless of import style

#### Safe Solution: Dependency Injection Pattern

**Instead of** `mock.module()`, use dependency injection parameters:

```typescript
// ❌ DANGEROUS: mock.module() contaminates process-global module cache
import { mock } from 'bun:test'
import { deleteHelpers } from './delete-helpers'

test('deletes user', async () => {
  mock.module('./delete-helpers', () => ({
    buildConditions: mock(() => ({ id: 1 })),
  }))

  // This mock persists in ALL subsequent test files!
})

// ✅ SAFE: Dependency injection for test control
function deleteUser(
  userId: number,
  { buildConditionsFn = buildConditions }: { buildConditionsFn?: typeof buildConditions } = {}
) {
  const conditions = buildConditionsFn(userId)
  // Use conditions...
}

test('deletes user', async () => {
  const mockBuildConditions = mock(() => ({ id: 1 }))

  await deleteUser(1, { buildConditionsFn: mockBuildConditions })

  expect(mockBuildConditions).toHaveBeenCalledWith(1)
})
```

**Benefits**:

- ✅ No module cache contamination
- ✅ Tests remain isolated
- ✅ Works identically on macOS and Linux
- ✅ Explicit dependencies make code more testable
- ✅ Allows testing with real implementations OR mocks

#### The ONE Safe Exception: Database Barrel Mock

The ONLY safe use of `mock.module()` in Sovrium is for the `@/infrastructure/database` barrel:

```typescript
// Safe because ONLY the database connection object is replaced
// No other test file depends on re-importing specific database module shapes
import { mock } from 'bun:test'

beforeEach(() => {
  mock.module('@/infrastructure/database', () => ({
    db: {
      insert: mock(async () => [mockRecord]),
      select: mock(() => ({ from: mock(() => ({ where: mock(async () => [mockRecord]) })) })),
      update: mock(() => ({ set: mock(() => ({ where: mock(async () => [mockRecord]) })) })),
      delete: mock(() => ({ where: mock(async () => [mockRecord]) })),
    },
  }))
})

afterEach(() => {
  mock.restore()
})
```

**Why this is safe**:

- Database connection is an opaque object (no specific shape dependencies)
- Tests only care about mock call tracking (`.toHaveBeenCalled()`)
- No other test file expects to re-import specific database module exports

#### Real-World Contamination Example

**Polluter File**: `crud.test.ts`

```typescript
// This contaminated delete-helpers.test.ts (23 failures)
beforeEach(() => {
  mock.module('./delete-helpers', () => ({
    buildDeleteConditions: mock(() => ({ id: 1 })),
  }))
})
```

**Victim File**: `delete-helpers.test.ts`

```typescript
// These tests failed because buildDeleteConditions always returned { id: 1 }
test('buildDeleteConditions with multiple filters', () => {
  const result = buildDeleteConditions({ id: 1, status: 'active' })
  expect(result).toEqual({ id: 1, status: 'active' }) // ❌ Failed: got { id: 1 }
})
```

**Fix**: Removed `mock.module()` from `crud.test.ts`, used call-counter mock `tx` pattern with real helper functions.

#### How We Discovered This

1. All tests passed locally (macOS)
2. 24 tests failed on GitHub Actions (Linux)
3. Failures were in different files than the polluter files
4. `mock.restore()` was present but ineffective
5. File iteration order was different on Linux (inode-based) vs macOS (alphabetical)
6. Tracked contamination source to `mock.module()` calls

#### Action Items for Developers

**DO**:

- ✅ Use dependency injection parameters for test control
- ✅ Test with real helper functions when possible
- ✅ Use `mock()` for function call tracking (NOT `mock.module()`)
- ✅ Only mock the database barrel (`@/infrastructure/database`)

**DON'T**:

- ❌ Use `mock.module()` for application modules
- ❌ Rely on `mock.restore()` to fix contamination (it doesn't)
- ❌ Assume tests passing locally means they'll pass in CI
- ❌ Mock helper functions or utilities with `mock.module()`

#### Testing Contamination

If you suspect contamination:

1. Run tests locally: `bun test:unit`
2. Check CI logs for Linux-specific failures
3. Search for `mock.module()` calls in test files: `grep -r "mock.module" src/`
4. Replace with dependency injection pattern
5. Re-run tests on Linux CI to confirm fix

#### References

- Bun issue: https://github.com/oven-sh/bun/issues (process-global mock.module behavior)
- Sovrium resolution: Removed all `mock.module()` calls except database barrel mock
- Affected tests: 24 failures across 2 polluter files (fixed January 2025)

## Test Execution Approach

- **`bun test:unit`**: Script that runs unit tests using pattern filters (`.test.ts` and `.test.tsx`)
- **`bun test:e2e`**: Script that runs Playwright E2E tests in `specs/` directory
- **`bun test:all`**: Script that runs both unit and E2E tests sequentially

## Unit vs E2E Test Execution

```bash
# Unit tests only (fast, run frequently) - ALWAYS USE SCRIPT
bun test:unit                        # ✅ CORRECT (pattern filters: .test.ts .test.tsx)
bun test                             # ❌ WRONG (discovers ALL test files including .spec.ts)

# E2E tests only (slow, run before commits)
bun test:e2e                         # Playwright tests in specs/
bun test:e2e:spec                    # Spec tests (@spec tag) - development
bun test:e2e:regression              # Regression tests (@regression tag) - CI/CD

# Both tests sequentially (recommended before commits)
bun test:all                         # Unit tests THEN E2E regression tests
```

### Why Pattern Filters Are the Correct Approach

**The Problem with `bun test` (no filters)**: Discovers ALL test files in the project, including:

- ✅ `**/*.test.ts` (Bun unit tests) ✅
- ✅ `**/*.test.tsx` (Bun unit tests) ✅
- ❌ `**/*.spec.ts` (Playwright E2E tests - INCOMPATIBLE with Bun test runner) ❌

**Error when mixing test runners**:

```
Playwright Test did not expect test.describe() to be called here
```

This happens because Bun Test tries to run Playwright spec files, which use incompatible APIs.

**The Solution - Pattern Filters**: Use `.test.ts` and `.test.tsx` as pattern filters (NOT directory paths).

**How Pattern Filters Work**:

- Command: `bun test .test.ts .test.tsx`
- Bun treats these as **pattern filters** (NOT file paths or directories)
- Searches entire project tree (all directories)
- ONLY runs files whose names contain `.test.ts` or `.test.tsx`
- Automatically excludes `.spec.ts` files (Playwright E2E tests)

**Result**:

- ✅ 681 unit tests pass
- ✅ 0 Playwright spec files loaded
- ✅ No "test.describe is not a function" errors
- ✅ Clean separation between unit and E2E tests

## When to Use Unit Tests (Bun Test)

- Testing individual functions, classes, utilities
- Validating business logic and algorithms
- Testing edge cases and error handling
- Verifying data transformations
- Testing pure functions (no side effects)
- Fast iteration during development
- TDD (Test-Driven Development) workflow

## Unit Tests vs E2E Tests

| Aspect              | Bun Test (Unit)                                | Playwright (E2E)                                      |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **Purpose**         | Test isolated functions, classes, utilities    | Test complete user workflows, UI, full app behavior   |
| **Speed**           | Very fast (milliseconds)                       | Slower (seconds to minutes)                           |
| **Scope**           | Single units of code                           | Entire application stack                              |
| **Browser**         | No browser required                            | Real browsers (Chromium, Firefox, WebKit)             |
| **Dependencies**    | Tests pure logic, mocked dependencies          | Tests real integrations, actual dependencies          |
| **When to Run**     | Frequently (every change)                      | Less frequently (before commits, in CI/CD)            |
| **Test Files**      | `*.test.ts` (in src/ and scripts/)             | `*.spec.ts` (in specs/ directory)                     |
| **Command**         | `bun test:unit` (script with directory filter) | `playwright test` or `bun test:e2e`                   |
| **Feedback Loop**   | Immediate (watch mode)                         | Slower (full app startup)                             |
| **What It Catches** | Logic bugs, function correctness               | UI bugs, integration issues, user experience problems |

## Why Both Test Types Are Needed

- **Unit Tests (Bun)**: Fast feedback on code correctness, test edge cases, validate logic
- **E2E Tests (Playwright)**: Verify real user workflows, catch integration issues, ensure UI works
- **Complementary**: Unit tests catch most bugs quickly, E2E tests ensure everything works together
- **Cost-Effectiveness**: Fast unit tests run constantly, expensive E2E tests run selectively

## Example Unit Test

```typescript
// src/calculator.test.ts
import { test, expect, describe } from 'bun:test'
import { add, subtract, divide } from './calculator'

describe('Calculator', () => {
  describe('add', () => {
    test('should add two numbers', () => {
      expect(add(2, 3)).toBe(5)
      expect(add(-1, 1)).toBe(0)
      expect(add(0, 0)).toBe(0)
    })
  })

  describe('divide', () => {
    test('should divide two numbers', () => {
      expect(divide(10, 2)).toBe(5)
      expect(divide(9, 3)).toBe(3)
    })

    test('should throw error when dividing by zero', () => {
      expect(() => divide(10, 0)).toThrow('Division by zero')
    })
  })
})
```

## Testing Scripts in `scripts/` Directory

The `scripts/` directory contains TypeScript utility scripts executed by Bun (e.g., build tools, code generators, data exporters). These scripts should have colocated unit tests to ensure reliability.

### Script Structure

```
scripts/
├── export-schema.ts       # Script implementation
├── export-schema.test.ts  # Unit tests for the script
└── split-docs.ts          # Another TypeScript script
```

### Script Testing Guidelines

1. **Colocate tests**: Place `*.test.ts` files alongside scripts (e.g., `scripts/my-script.test.ts`)
2. **Test pure functions**: Extract testable logic into pure functions
3. **Mock file system**: Use Bun's built-in mocking for `fs` operations
4. **Test edge cases**: Validate error handling, missing files, invalid inputs
5. **Executable scripts**: Scripts should have shebang `#!/usr/bin/env bun` and be executable

### Script Test Example

```typescript
// scripts/string-utils.ts
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()
}

export function getVersion(pkg: { version: string }): string {
  if (!pkg.version) {
    throw new Error('Package version is required')
  }
  return pkg.version
}
```

```typescript
// scripts/string-utils.test.ts
import { test, expect, describe } from 'bun:test'
import { sanitizeFilename, getVersion } from './string-utils.ts'

describe('string-utils', () => {
  describe('sanitizeFilename', () => {
    test('should sanitize filename with special characters', () => {
      expect(sanitizeFilename('My File!@#$%^&*().txt')).toBe('my-file--------.txt')
    })

    test('should preserve hyphens and underscores', () => {
      expect(sanitizeFilename('my-awesome_file.txt')).toBe('my-awesome_file.txt')
    })

    test('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('')
    })
  })

  describe('getVersion', () => {
    test('should return version from package object', () => {
      expect(getVersion({ version: '1.0.0' })).toBe('1.0.0')
    })

    test('should throw error when version is missing', () => {
      expect(() => getVersion({ version: '' })).toThrow('Package version is required')
    })
  })
})
```

### Running Script Tests

```bash
# Run all unit tests (including scripts)
bun test:unit                        # ✅ CORRECT (pattern filters: .test.ts .test.tsx)

# Run only script tests (specific directory if needed)
bun test scripts/                    # ✅ Safe (specific directory)

# Run specific script test
bun test scripts/export-schema.test.ts  # ✅ Safe (specific file)

# Watch mode for script development
bun test:unit:watch                  # ✅ CORRECT (pattern filters with watch mode)
bun test --watch scripts/            # ✅ Safe (specific directory)
```

**Note**: The `bun test:unit` command automatically discovers script tests (`.test.ts` files in `scripts/` directory) using pattern filters, so you don't need to specify directories.

### Mocking File System Operations

```typescript
import { test, expect, mock } from 'bun:test'
import { writeFile, mkdir } from 'fs/promises'

test('should create directory and write file', async () => {
  // Mock filesystem operations
  const mockMkdir = mock(mkdir)
  const mockWriteFile = mock(writeFile)

  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)

  // Test your script logic
  await mockMkdir('/output')
  await mockWriteFile('/output/file.txt', 'content')

  expect(mockMkdir).toHaveBeenCalledWith('/output', { recursive: true })
  expect(mockWriteFile).toHaveBeenCalledWith('/output/file.txt', 'content')
})
```

### Best Practices for Script Testing

1. **Extract logic from main execution**: Separate testable functions from script entry point
2. **Test helpers separately**: Unit test utility functions independent of main script
3. **Mock external dependencies**: Use mocks for file system, network, external APIs
4. **Test error paths**: Verify error handling for missing files, invalid data, etc.
5. **Keep tests fast**: Scripts tests should run in milliseconds like other unit tests

### Example: Testing a Build Script

```typescript
// scripts/build-helpers.ts
export function calculateBuildHash(files: string[]): string {
  return files.sort().join('|')
}

export function validateBuildConfig(config: any): void {
  if (!config.outDir) {
    throw new Error('outDir is required in build config')
  }
}
```

```typescript
// scripts/build-helpers.test.ts
import { test, expect, describe } from 'bun:test'
import { calculateBuildHash, validateBuildConfig } from './build-helpers.ts'

describe('build-helpers', () => {
  test('calculateBuildHash should sort files and create hash', () => {
    expect(calculateBuildHash(['c.ts', 'a.ts', 'b.ts'])).toBe('a.ts|b.ts|c.ts')
  })

  test('validateBuildConfig should throw on missing outDir', () => {
    expect(() => validateBuildConfig({})).toThrow('outDir is required')
  })

  test('validateBuildConfig should pass with valid config', () => {
    expect(() => validateBuildConfig({ outDir: './dist' })).not.toThrow()
  })
})
```

## Watch Mode for Continuous Testing

```bash
# Watch mode (auto-runs tests on file changes)
bun test:unit:watch                  # ✅ CORRECT (pattern filters: .test.ts .test.tsx)
CLAUDECODE=1 bun test:unit:watch     # AI-optimized output (failures only)

# Raw watch command with pattern filters
bun test --watch --concurrent .test.ts .test.tsx  # ✅ Safe (pattern filters)
```

**Note**: The `bun test:unit:watch` command uses pattern filters (`.test.ts` and `.test.tsx`) to automatically discover ONLY unit tests, preventing Playwright conflicts.

Watch mode is perfect for TDD (Test-Driven Development):

1. Write a failing test
2. Save the file
3. Test automatically runs and fails
4. Write implementation
5. Save the file
6. Test automatically runs and passes

## Coverage Reports

```bash
# Generate coverage report
bun test:unit:coverage               # ✅ CORRECT (pattern filters: .test.ts .test.tsx)

# Raw coverage command with pattern filters
bun test --coverage --concurrent .test.ts .test.tsx  # ✅ Safe (pattern filters)

# Coverage output shows:
# - % of statements covered
# - % of branches covered
# - % of functions covered
# - % of lines covered
```

**Note**: Coverage reports use pattern filters to ensure ONLY unit tests are included in coverage metrics.

## Performance Benefits

- **Native Execution**: Bun executes TypeScript tests directly (no compilation)
- **Fast Startup**: 4x faster than Node.js-based test runners
- **Parallel Execution**: Tests run in parallel by default
- **Efficient Mocking**: Built-in mocking without external libraries

## Integration with Bun

- **Native command**: `bun test` is built into Bun runtime
- **No additional setup**: Test runner included with Bun installation
- **TypeScript support**: Direct TypeScript execution without transpilation
- **Jest compatibility**: Familiar API for developers coming from Jest

## Best Practices

1. **Co-locate tests with source code** - Place `*.test.ts` next to implementation
2. **Test behavior, not implementation** - Focus on what code does, not how
3. **Use descriptive test names** - Clearly state what is being tested
4. **Keep tests focused** - One assertion per test when possible
5. **Use watch mode during development** - Get immediate feedback
6. **Mock external dependencies** - Unit tests should be isolated
7. **Test edge cases** - Zero, negative, null, undefined, empty arrays
8. **Run tests before committing** - Ensure all tests pass
9. **Use `describe` blocks** - Group related tests together
10. **Avoid test interdependence** - Each test should be independent

## Common Pitfalls

- ❌ Testing implementation details instead of behavior
- ❌ Not cleaning up after tests (side effects)
- ❌ Tests that depend on execution order
- ❌ Not testing edge cases and error conditions
- ❌ Overly complex test setup
- ❌ Testing third-party library code

## When to Run Unit Tests

1. **During Development** (continuous):

   ```bash
   bun test:unit:watch              # Auto-run on file changes (pattern filters)
   CLAUDECODE=1 bun test:unit:watch # AI-optimized output
   ```

2. **Before Committing** (critical):

   ```bash
   bun test:unit                    # Ensure all tests pass (pattern filters)
   ```

3. **In CI/CD Pipeline** (critical):

   ```bash
   bun test:unit                    # Fail builds if tests fail (pattern filters)
   ```

4. **After Refactoring** (recommended):
   ```bash
   bun test:unit                    # Verify behavior unchanged (pattern filters)
   ```

**Note**: All `bun test:unit` commands use pattern filters (`.test.ts` and `.test.tsx`) to automatically discover ONLY unit tests and prevent Playwright conflicts.

## References

- Bun test documentation: https://bun.sh/docs/cli/test
- Jest matchers (compatible): https://jestjs.io/docs/expect
- Testing best practices: https://bun.sh/guides/test/lifecycle
