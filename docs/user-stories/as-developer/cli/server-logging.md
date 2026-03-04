# Server Startup Logging

> **Feature Area**: CLI - Startup Logging
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
