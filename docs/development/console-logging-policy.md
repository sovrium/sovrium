# Console Logging Policy

## Overview

This document defines when `console.*` methods are allowed in Sovrium's codebase and when to use the Effect Logger service instead.

## General Rule

**Default**: Use `Logger` service from `@/infrastructure/logging/logger` for all production logging.

**Exceptions**: Console methods are allowed in specific contexts documented below.

## Allowed Console Usage

### 1. CLI Output (User-Facing Messages)

**Location**: `src/cli.ts`

**Why**: CLI commands output directly to user terminal, not application logs.

**Examples**:

```typescript
console.log(`\n👀 Watching ${filePath} for changes...\n`)
console.log(`✅ Server reloaded successfully\n`)
console.error(`❌ Reload failed: ${error.message}\n`)
```

**Pattern**: CLI feedback uses emojis and formatting for user experience.

---

### 2. JSDoc Code Examples

**Location**: All `*.ts` files with JSDoc comments

**Why**: Documentation examples demonstrating API usage to developers.

**Examples**:

````typescript
/**
 * @example
 * ```typescript
 * const server = await start(app)
 * console.log(`Server running at ${server.url}`)
 * ```
 */
````

**Pattern**: Console statements inside JSDoc `@example` blocks.

---

### 3. Client-Side Browser Runtime

**Location**: `src/application/use-cases/server/static-content-generators.ts`

**Why**: Code runs in browser, not Node.js/Bun runtime.

**Example**:

```typescript
// Minimal hydration script for static sites
console.log('Sovrium: Client-side hydration enabled')
```

**Pattern**: Client-side JavaScript embedded in HTML.

---

### 4. Development Warnings (Explicitly Commented)

**Location**: `src/presentation/components/sections/`

**Why**: Runtime warnings for developer debugging during development.

**Examples**:

```typescript
// DEVELOPMENT WARNING: Keep console.warn for development debugging
if (process.env.NODE_ENV !== 'production') {
  console.warn(`Block not found: ${blockName}`)
}
```

**Pattern**: Must include `// DEVELOPMENT WARNING:` comment explaining why kept.

---

### 5. Logger Service Implementation

**Location**: `src/infrastructure/logging/logger.ts`, `src/infrastructure/logging/effect-logger.ts`

**Why**: Logger service implementation itself uses console methods internally.

**Example**:

```typescript
export const LoggerLive = Layer.succeed(Logger, {
  error: (message, error) =>
    Effect.sync(() => {
      console.error(`[ERROR] ${message}`, error)
    }),
})
```

**Pattern**: Logger service wraps console methods with structured logging.

---

### 6. Test Code (Intentional Output)

**Location**: `*.test.ts`, `*.test.tsx` files

**Why**: Test assertions may verify console output or use console for test debugging.

**Example**:

```typescript
expect(html).toBe('<script>console.log("test");</script>')
```

**Pattern**: Console in test code or test data.

---

### 7. Middleware Error Logging

**Location**: `src/infrastructure/server/route-setup/*.ts`, `src/presentation/api/middleware/*.ts`

**Why**: Hono middleware uses async/await (not Effect programs). Operational error monitoring for infrastructure failures.

**Examples**:

```typescript
// MIDDLEWARE LOGGING: Operational error monitoring (Hono middleware uses async/await, not Effect)
console.error('[Auth Middleware] Session check error:', error)

// MIDDLEWARE LOGGING: Security monitoring for session hijacking attempts (Hono middleware uses async/await, not Effect)
console.warn('[AUTH] Session binding validation failed', {
  sessionId: sessionResult.session.id,
  expectedIP: sessionResult.session.ipAddress,
  currentIP,
})
```

**Pattern**: Must include `// MIDDLEWARE LOGGING:` comment explaining operational nature and why Effect Logger is not used.

**Rationale**:
- Middleware is infrastructure layer, not business logic
- Operational monitoring (server health) vs business events (user actions)
- Hono middleware uses async/await, not Effect.gen programs
- Converting to Effect would require wrapping entire middleware (architectural change)

---

## Prohibited Console Usage

### ❌ Production Application Logging

**Wrong**:

```typescript
// ❌ DON'T: Direct console in production code
export const CreateRecord = (input) =>
  Effect.gen(function* () {
    console.log('[DEBUG] Creating record:', input)
    const record = yield* repository.create(input)
    return record
  })
```

**Correct**:

```typescript
// ✅ DO: Use Logger service
import { Logger } from '@/infrastructure/logging/logger'

export const CreateRecord = (input) =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* logger.debug('Creating record', input)
    const record = yield* repository.create(input)
    return record
  })
```

---

### ❌ Debug Statements

**Wrong**:

```typescript
// ❌ DON'T: Debug console statements
console.log('[DEBUG] About to call runEffect with fields:', fields)
```

**Correct**: Remove debug statements entirely or use Logger.debug with conditional output.

---

### ❌ Error Logging in Effect Programs

**Wrong**:

```typescript
// ❌ DON'T: Console for errors in Effect programs
yield *
  bootstrapAdmin(app).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        console.error('Bootstrap error:', error)
      })
    )
  )
```

**Correct**:

```typescript
// ✅ DO: Use Logger service
const logger = yield * Logger
yield *
  bootstrapAdmin(app).pipe(
    Effect.catchAll((error) => logger.warn('Admin bootstrap error', error.message))
  )
```

---

## Logger Service Usage

### Importing Logger

```typescript
import { Logger, LoggerLive, LoggerSilent } from '@/infrastructure/logging/logger'
```

### Providing Logger in Layers

**Production** (already configured in `AppLayer`):

```typescript
export const createAppLayer = (authConfig?: AuthConfig) =>
  Layer.mergeAll(
    // ... other layers
    LoggerLive
  )
```

**Tests**:

```typescript
const TestLayer = Layer.mergeAll(
  MockServerFactory,
  MockPageRenderer,
  LoggerSilent // Silent logger for tests
)
```

### Using Logger in Effect Programs

```typescript
export const SomeUseCase = (input: Input) =>
  Effect.gen(function* () {
    const logger = yield* Logger

    yield* logger.debug('Starting use case', input)

    try {
      const result = yield* someOperation(input)
      yield* logger.info('Use case completed successfully')
      return result
    } catch (error) {
      yield* logger.error('Use case failed', error)
      return yield* Effect.fail(new UseCaseError())
    }
  })
```

### Log Levels

| Level   | Method         | When to Use                                |
| ------- | -------------- | ------------------------------------------ |
| `debug` | `logger.debug` | Detailed diagnostic information (dev only) |
| `info`  | `logger.info`  | General informational messages             |
| `warn`  | `logger.warn`  | Warning messages for potential issues      |
| `error` | `logger.error` | Error messages for failures                |

**Debug Level Control**:

- Debug logs only appear when `LOG_LEVEL=debug` or `NODE_ENV=development`
- Production builds with `NODE_ENV=production` suppress debug logs

---

## Migration Guide

### Converting Existing Console Statements

**Step 1**: Identify console statement type

```typescript
console.log('[DEBUG] User created:', user) // Debug statement
console.error('Failed to create user:', error) // Error logging
console.warn('Deprecated API used') // Warning
```

**Step 2**: Determine if allowed exception

- Is it CLI output? → Keep
- Is it JSDoc example? → Keep
- Is it client-side code? → Keep
- Is it development warning with comment? → Keep
- Otherwise → Convert to Logger

**Step 3**: Convert to Logger

```typescript
// Before
console.log('[DEBUG] User created:', user)
console.error('Failed to create user:', error)
console.warn('Deprecated API used')

// After
const logger = yield * Logger
yield * logger.debug('User created', user)
yield * logger.error('Failed to create user', error)
yield * logger.warn('Deprecated API used')
```

**Step 4**: Add Logger to test layers if needed

```typescript
const TestLayer = Layer.mergeAll(
  // ... existing mocks
  LoggerSilent
)
```

---

## Enforcement

### ESLint Rule (Future)

Consider adding ESLint rule to detect console.\* in production code:

```javascript
{
  rules: {
    'no-console': ['error', {
      allow: [] // No console methods allowed
    }]
  }
}
```

With exceptions configured for:

- `src/cli.ts`
- `src/infrastructure/logging/*.ts`
- `*.test.ts` files

### Code Review Checklist

- [ ] No `console.*` in `src/application/` (use Logger)
- [ ] No `console.*` in `src/domain/` (pure functions, no logging)
- [ ] No `console.*` in `src/infrastructure/` except logger implementation
- [ ] No `console.*` in `src/presentation/api/` except explicitly commented warnings
- [ ] CLI output in `src/cli.ts` is user-facing (not debug logs)
- [ ] All Effect programs use Logger service for logging

---

## Summary

**Golden Rule**: If it's production application code and not an explicitly documented exception, use the Logger service.

**When in Doubt**: Ask "Is this output for users (CLI) or developers (logs)?" Users get console, developers get Logger.

**Benefits of Logger Service**:

- Structured logging with levels
- Conditional debug output
- Silent mode for tests
- Centralized log format
- Future extensibility (file logging, remote logging)
