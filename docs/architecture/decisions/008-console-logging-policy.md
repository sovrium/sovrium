# ADR 008: Console Logging Policy and Logger Service Usage

**Status**: Accepted
**Date**: 2026-01-29
**Decision Makers**: Architecture Review
**Related**: [Logger Consolidation (commit d692029)](https://github.com/sovrium/sovrium/commit/d692029)

---

## Context

Sovrium uses Effect.ts for functional programming with dependency injection via Context/Layer. The codebase has multiple logging approaches:

1. **Effect Logger Service** (`Logger` Context.Tag) - For Effect programs
2. **Convenience Functions** (`logError`, `logInfo`, etc.) - For non-Effect contexts
3. **Console Methods** (`console.log`, `console.error`) - Direct console access

### Current State (January 2026)

- **22 source files** use `console.*` directly (including infrastructure layer)
- **Logger service** recently consolidated (effect-logger.ts merged into logger.ts, commit d692029)
- **ESLint allows console** via `functional/no-expression-statements` ignore pattern
- **No documented policy** on when to use Logger vs console

### Problem

Without a clear logging policy:

1. **Inconsistent practices** - Some files use Logger, others use console
2. **Testing challenges** - Console output can't be captured/mocked in tests
3. **Production monitoring** - Structured logs (Logger) are easier to aggregate than raw console
4. **Layer violations** - Infrastructure layer should use dependency injection, not globals

---

## Decision

**We establish a structured logging policy based on layer architecture and context type:**

### 1. Effect Contexts (Application/Infrastructure Layers)

**Use Logger Service via Effect Context:**

```typescript
import { Effect } from 'effect'
import { Logger } from '@/infrastructure/logging/logger'

const program = Effect.gen(function* () {
  const logger = yield* Logger
  yield* logger.info('Operation started')
  yield* logger.error('Operation failed', error)
})
```

**Why**: Testable, composable, supports dependency injection

### 2. Non-Effect Contexts (Callbacks, Module Initialization)

**Use Convenience Functions:**

```typescript
import { logInfo, logError } from '@/infrastructure/logging/logger'

async function sendEmail(to: string) {
  try {
    await emailAPI.send(to)
    logInfo('[EMAIL] Sent successfully')
  } catch (error) {
    logError('[EMAIL] Send failed', error)
  }
}
```

**Why**: Thin wrapper around Logger service, maintains consistency

### 3. CLI Output (User-Facing Messages)

**Use Console Methods:**

```typescript
// src/cli.ts
console.log('✓ Database schema initialized successfully')
console.error('✗ Error: Invalid configuration file')
```

**Why**: CLI users expect console output, not structured logs

### 4. Test Files (Unit/E2E)

**Use Console or Test Mocks:**

```typescript
// *.test.ts
console.log('[DEBUG] Test state:', testData)
// OR mock Logger service for assertions
```

**Why**: Test output needs direct console for debugging

### Policy Summary Table

| Context                      | Use                               | Reason                                   |
| ---------------------------- | --------------------------------- | ---------------------------------------- |
| Effect programs              | `Logger` service (yield\*)        | Testable, composable, DI-friendly        |
| Non-Effect callbacks         | `logInfo()`, `logError()`         | Thin wrapper, consistent formatting      |
| CLI user-facing output       | `console.log`, `console.*`        | Expected behavior for CLI tools          |
| Test files                   | `console.*` or mock Logger        | Debugging output                         |
| Development debugging        | `console.*` (remove later)        | Quick debugging (not for commit)         |
| **Forbidden in src/\*\*/\*** | Raw `console.*` in business logic | Use Logger/convenience functions instead |

---

## Rationale

### Why Logger Service for Effect Contexts?

1. **Dependency Injection** - Logger is an Effect Context.Tag, composable with other services
2. **Testability** - Can provide `LoggerSilent` layer in tests to suppress output
3. **Structured Logging** - Consistent format with timestamps: `[2026-01-29T10:29:56.971Z] [INFO] message`
4. **Future-Proof** - Easy to add log aggregation (e.g., Sentry, Datadog) without code changes

### Why Convenience Functions for Non-Effect Contexts?

1. **Bridge Pattern** - Wraps Logger service for non-Effect code (async callbacks, module init)
2. **Consistency** - Same format as Logger service (`[timestamp] [level] message`)
3. **Zero Overhead** - Thin wrapper (`Effect.runSync` + `Effect.provide(LoggerLive)`)
4. **Migration Path** - Easy to refactor to Effect.gen when code becomes Effect-aware

### Why Console for CLI Output?

1. **User Expectations** - CLI tools output to stdout/stderr by default
2. **Simplicity** - No need for structured logs in CLI scripts
3. **Portability** - Works across all JavaScript runtimes without dependencies

### Why Not Console Everywhere?

1. **Not Testable** - Can't easily capture/mock console output in unit tests
2. **No Structure** - Lacks timestamps, log levels, metadata
3. **Global State** - Console is global, violates dependency injection principles
4. **Production Challenges** - Harder to aggregate and analyze in production

---

## Consequences

### Positive Consequences

✅ **Clear Guidelines** - Developers know which logging method to use per context
✅ **Testable Infrastructure** - Logger service can be mocked/silenced in tests
✅ **Consistent Format** - All logs have timestamps and levels
✅ **Future-Proof** - Easy to add log aggregation without refactoring
✅ **Layer Compliance** - Infrastructure/Application layers use dependency injection
✅ **CLI Flexibility** - User-facing CLI output remains simple

### Negative Consequences

❌ **Migration Work** - 22 files currently use console in infrastructure layer
→ **Mitigation**: Gradual migration, prioritize frequently-changed files

❌ **Learning Curve** - Developers must understand when to use Logger vs console
→ **Mitigation**: ESLint enforcement + documentation

❌ **Slightly More Verbose** - `logInfo(msg)` vs `console.log(msg)` (4 extra chars)
→ **Accepted Trade-off**: Consistency worth minor verbosity

### ESLint Enforcement Plan

**Current State**: `eslint/functional.config.ts` allows console via `ignoreCodePattern`

**Proposed Change**:

```typescript
// Restrict console in infrastructure/application layers
{
  files: ['src/infrastructure/**/*.ts', 'src/application/**/*.ts'],
  rules: {
    'no-console': ['error', { allow: [] }], // No console allowed
  },
}

// Allow console in CLI and tests
{
  files: ['src/cli.ts', '**/*.test.ts', '**/*.spec.ts'],
  rules: {
    'no-console': 'off', // Console allowed
  },
}
```

**Implementation**: Defer to separate PR to avoid breaking 22 files

---

## Alternatives Considered

### Alternative A: Console Everywhere

**Approach**: Allow `console.*` in all contexts, no Logger service

**Rejected Because**:

- ❌ Not testable - Console output can't be captured/mocked
- ❌ No structure - Lacks timestamps, levels, metadata
- ❌ Production challenges - Harder to aggregate logs
- ❌ Violates DI principles - Console is global state

### Alternative B: Logger Everywhere (Including CLI)

**Approach**: Use Logger service even for CLI output

**Rejected Because**:

- ❌ Overkill for CLI - Users expect simple console output
- ❌ Structured logs inappropriate - CLI doesn't need timestamps
- ❌ Harder to read - `[2026-01-29T10:29:56.971Z] [INFO] ✓ Success` is verbose

### Alternative C: Pino/Winston/Bunyan Third-Party Logger

**Approach**: Use established logging library instead of custom Logger

**Rejected Because**:

- ❌ External dependency - Adds bundle size, maintenance burden
- ❌ Not Effect-native - Doesn't integrate with Context/Layer
- ❌ Over-engineered - Sovrium's logging needs are simple
- ✅ **Custom Logger Sufficient** - 81 lines, full control, zero dependencies

---

## Implementation Status

### Completed

- ✅ Logger service consolidated (effect-logger.ts → logger.ts, commit d692029)
- ✅ Convenience functions available (`logError`, `logInfo`, `logWarning`, `logDebug`)
- ✅ Timestamp formatting consistent across all logs
- ✅ `createModuleLogger()` helper for prefixed logs (e.g., `[EMAIL]`)

### Pending

- ⏳ **ESLint enforcement** - Restrict console in infrastructure/application layers
- ⏳ **Migration of 22 files** - Gradual refactor from console to Logger
- ⏳ **Documentation updates** - Link this ADR from CLAUDE.md and error-handling-strategy.md

### Out of Scope

- ❌ Log aggregation (Sentry, Datadog) - Future work
- ❌ Log rotation/archiving - Handled by Docker/Kubernetes
- ❌ Performance optimization - Logging overhead negligible

---

## Review Date

**2026-07-29** (6 months)

### Review Questions

1. Has the ESLint enforcement been implemented?
2. How many files still use console in infrastructure layer?
3. Is the Logger service meeting production needs?
4. Should we add log aggregation (Sentry, Datadog)?
5. Are developers following the policy without confusion?

---

## References

- [Logger Service Implementation](../../infrastructure/logging/logger.ts)
- [Console Logging Usage Search](https://github.com/sovrium/sovrium/search?q=console.log+OR+console.error)
- [Effect.ts Documentation](https://effect.website/docs)
- [Commit d692029: Logger Consolidation](https://github.com/sovrium/sovrium/commit/d692029)
