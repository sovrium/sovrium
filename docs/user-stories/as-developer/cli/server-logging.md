# Server Logging

> **Feature Area**: CLI - Server Logging (Startup + Runtime)
> **Schema**: `src/infrastructure/logging/logger.ts`
> **E2E Specs**: `specs/cli/logging/`

---

## Overview

Clean, structured startup output inspired by Vite/Next.js/Astro. Treats logs as a DX product feature with clear phases, timing, and warnings.

### Target Output (minimal app, no DB/auth)

```
  Sovrium v0.2.0

  ✓ CSS compiled (90 KB)
  ✓ Server ready in 320ms

  → http://localhost:3000
```

### Target Output (full app with warnings)

```
  Sovrium v0.2.0

  ⚠ SMTP not configured (using Mailpit at 127.0.0.1:1025)
  ⚠ DATABASE_URL not set (skipping database)

  ✓ CSS compiled (90 KB)
  ✓ Server ready in 320ms

  → http://localhost:3000
```

---

## US-CLI-LOGGING-001: Clean Default Startup Output

**As a** developer using Sovrium CLI,
**I want to** see a clean, structured startup output,
**so that** I can quickly see the server status without reading through noisy debug logs.

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                    | Status |
| ------ | --------------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Displays `Sovrium v{version}` header on startup                 | `CLI-LOG-OUTPUT-001`        | .fixme |
| AC-002 | Shows only completed phases (not internal step-by-step details) | `CLI-LOG-OUTPUT-002`        | .fixme |
| AC-003 | Displays total startup time in human-readable format (ms or s)  | `CLI-LOG-OUTPUT-003`        | .fixme |
| AC-004 | Shows server URL as final prominent line with `→` prefix        | `CLI-LOG-OUTPUT-004`        | .fixme |
| AC-005 | Shows CSS size in KB (not raw bytes)                            | `CLI-LOG-OUTPUT-005`        | .fixme |
| AC-006 | Minimal app (no DB, no auth) shows only relevant phases         | `CLI-LOG-OUTPUT-006`        | .fixme |
| AC-007 | Full app shows all phases (DB, migrations, schema, auth, CSS)   | `CLI-LOG-OUTPUT-007`        | .fixme |
| AC-008 | Regression test covering end-to-end startup workflow            | `CLI-LOG-OUTPUT-REGRESSION` | .fixme |

### Implementation References

- Logger types: `src/infrastructure/logging/logger.ts` (StartupPhase, StartupSummary)
- Server startup: `src/infrastructure/server/server.ts` (createServer, collectInfraPhases)
- Duration formatting: `formatDuration()` in logger.ts

### Notes

- Duration formatted: `<1000ms → "320ms"`, `≥1000ms → "1.2s"`
- Warnings grouped before success phases
- Uses `✓` prefix for success, `⚠` for warnings

---

## US-CLI-LOGGING-002: Warning Display for Missing Config

**As a** developer running Sovrium locally,
**I want to** see clear warnings about missing configuration,
**so that** I know what's running in fallback mode without errors cluttering the output.

### Acceptance Criteria

| ID     | Criterion                                                                   | E2E Spec                      | Status |
| ------ | --------------------------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | SMTP not configured warning appears with ⚠ prefix and Mailpit fallback info | `CLI-LOG-WARNINGS-001`        | .fixme |
| AC-002 | DATABASE_URL not set warning appears when no DB configured                  | `CLI-LOG-WARNINGS-002`        | .fixme |
| AC-003 | Warnings appear before success phases (structured order)                    | `CLI-LOG-WARNINGS-003`        | .fixme |
| AC-004 | Regression test covering warning scenarios                                  | `CLI-LOG-WARNINGS-REGRESSION` | .fixme |

### Implementation References

- Email config: `src/infrastructure/email/email-config.ts` (usingMailpitFallback)
- Phase collection: `src/infrastructure/server/server.ts` (collectInfraPhases)

### Notes

- Warnings are informational, not errors
- Warning text includes the fallback behavior (e.g., "using Mailpit at 127.0.0.1:1025")

---

## US-CLI-LOGGING-003: Verbose Mode (LOG_LEVEL=debug)

**As a** developer debugging startup issues,
**I want to** enable verbose mode that shows detailed diagnostic information,
**so that** I can troubleshoot CSS compilation, schema initialization, and auth bootstrap issues.

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                     | Status |
| ------ | ----------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | LOG_LEVEL=debug shows CSS compiler diagnostics        | `CLI-LOG-VERBOSE-001`        | .fixme |
| AC-002 | LOG_LEVEL=debug shows schema initializer step details | `CLI-LOG-VERBOSE-002`        | .fixme |
| AC-003 | LOG_LEVEL=debug shows bootstrap admin details         | `CLI-LOG-VERBOSE-003`        | .fixme |
| AC-004 | Default log level hides debug messages                | `CLI-LOG-VERBOSE-004`        | .fixme |
| AC-005 | Regression test covering verbose mode                 | `CLI-LOG-VERBOSE-REGRESSION` | .fixme |

### Implementation References

- Logger: `src/infrastructure/logging/logger.ts` (logDebug)
- CSS compiler: `src/infrastructure/css/compiler.ts` (demoted to logDebug)
- Schema init: `src/infrastructure/database/schema/schema-initializer.ts` (demoted to logDebug)
- Bootstrap admin: `src/application/use-cases/auth/bootstrap-admin.ts` (demoted to logDebug)
- Migrations: `src/infrastructure/database/drizzle/migrate.ts` (demoted to logDebug)

### Notes

- Debug output uses existing `logDebug()` which checks `LOG_LEVEL=debug` or `NODE_ENV=development`
- All diagnostic logs (CSS compiler, schema initializer, bootstrap admin, migrations) are demoted to debug level

---

## US-CLI-LOGGING-004: Silent Runtime for Static Assets

**As a** developer using Sovrium CLI,
**I want to** see no console output during normal page browsing,
**so that** the terminal stays clean and only shows meaningful information.

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                     | Status |
| ------ | ---------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | CSS cache hit produces no console output                   | `CLI-LOG-RUNTIME-001`        | .fixme |
| AC-002 | CSS compilation (first compile) logs at debug level only   | `CLI-LOG-RUNTIME-002`        | .fixme |
| AC-003 | JS asset serving produces no console output                | `CLI-LOG-RUNTIME-003`        | .fixme |
| AC-004 | CSS errors still log at error level                        | `CLI-LOG-RUNTIME-004`        | .fixme |
| AC-005 | No "Press Ctrl+C to stop the server" message after startup | `CLI-LOG-RUNTIME-005`        | .fixme |
| AC-006 | Regression test covering runtime silence                   | `CLI-LOG-RUNTIME-REGRESSION` | .fixme |

### Implementation References

- CSS route: `src/infrastructure/server/route-setup/static-assets.ts` (removed Console.log tap)
- JS routes: `src/infrastructure/server/route-setup/static-assets.ts` (migrated to logError)
- Lifecycle: `src/infrastructure/server/lifecycle.ts` (removed "Press Ctrl+C" message)
- CSS compiler: `src/infrastructure/css/compiler.ts` (internal logDebug already handles debug logging)

### Notes

- The CSS compiler (`compileCSS()`) already has internal `logDebug('[CSS] Compiled and cached')` and `logDebug('[CSS] Cache hit')` — no additional logging needed at the route level
- Error logging uses `logError()` for consistent structured format with timestamps
- "Press Ctrl+C" is universal knowledge and adds no value to startup output

---

## US-CLI-LOGGING-005: Development Request Access Log

**As a** developer debugging request routing,
**I want to** optionally see a request access log in the terminal,
**so that** I can trace which routes are being hit and how long they take.

### Acceptance Criteria

| ID     | Criterion                                                             | E2E Spec                    | Status |
| ------ | --------------------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | `LOG_LEVEL=debug` logs method, path, status, and duration per request | `CLI-LOG-ACCESS-001`        | .fixme |
| AC-002 | Static asset paths (`/assets/*`) excluded from access log             | `CLI-LOG-ACCESS-002`        | .fixme |
| AC-003 | Default log level produces no access log                              | `CLI-LOG-ACCESS-003`        | .fixme |
| AC-004 | Format: `<-- METHOD /path STATUS TIMEms`                              | `CLI-LOG-ACCESS-004`        | .fixme |
| AC-005 | Regression test covering access log scenarios                         | `CLI-LOG-ACCESS-REGRESSION` | .fixme |

### Implementation References

- Middleware: `src/infrastructure/server/middleware/request-logger.ts`
- Mount point: `src/infrastructure/server/server.ts` (createHonoApp)
- Logger: `src/infrastructure/logging/logger.ts` (logDebug)

### Notes

- Middleware uses Hono's `MiddlewareHandler` pattern (async with `next()`)
- Excluded prefixes: `/assets/`, `/favicon` — these are high-frequency, low-value for debugging
- Format inspired by Koa/Fastify request loggers: `<-- GET / 200 12ms`

---

## US-CLI-LOGGING-006: Structured Error Logging

**As a** developer investigating server errors,
**I want to** see structured error logs with request context,
**so that** I can quickly identify which request caused the error.

### Acceptance Criteria

| ID     | Criterion                                                  | E2E Spec                   | Status |
| ------ | ---------------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Server 500 errors include method and path in log           | `CLI-LOG-ERROR-001`        | .fixme |
| AC-002 | Page rendering errors use `logError` (not `Console.error`) | `CLI-LOG-ERROR-002`        | .fixme |
| AC-003 | Auth errors don't leak passwords or tokens                 | `CLI-LOG-ERROR-003`        | .fixme |
| AC-004 | Regression test covering error logging scenarios           | `CLI-LOG-ERROR-REGRESSION` | .fixme |

### Implementation References

- Global error handler: `src/infrastructure/server/server.ts` (onError)
- Page routes: `src/infrastructure/server/route-setup/page-routes.ts` (3 catch blocks)
- Logger: `src/infrastructure/logging/logger.ts` (logError)

### Notes

- `logError()` is synchronous internally (uses `Effect.runSync`), so no `.catch()` needed
- Error format: `[timestamp] [ERROR] [SERVER] GET /path → 500`
- Auth error sanitization relies on not passing raw request bodies to log functions
