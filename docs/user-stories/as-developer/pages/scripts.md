# Client-Side Scripts

> **Feature Area**: Pages - Client-Side Script Management
> **Schema**: `src/domain/models/app/pages/scripts/`
> **E2E Specs**: `specs/app/pages/scripts/`

---

## Overview

Sovrium provides comprehensive client-side script management through a modular schema system. Developers can orchestrate feature flags, external dependencies, inline scripts, and client-side configuration through declarative configuration.

---

## US-PAGES-SCRIPTS-001: Script Orchestration

**As a** developer,
**I want to** orchestrate all client-side script management from a single configuration,
**so that** I can control feature flags, external dependencies, and inline scripts declaratively.

### Configuration

```yaml
pages:
  - path: /dashboard
    scripts:
      features:
        darkMode: true
        analytics:
          enabled: true
          config:
            trackingId: 'UA-123456'
      external:
        - src: 'https://cdn.example.com/lib.js'
          async: true
      inline:
        - code: 'console.log("App initialized")'
          position: 'body-end'
```

### Acceptance Criteria

| ID     | Criterion                                            | E2E Spec                       | Status |
| ------ | ---------------------------------------------------- | ------------------------------ | ------ |
| AC-001 | Orchestrates client-side script management           | `APP-PAGES-SCRIPTS-001`        | ✅     |
| AC-002 | Enables client-side feature toggles                  | `APP-PAGES-SCRIPTS-002`        | ✅     |
| AC-003 | Includes external JavaScript dependencies            | `APP-PAGES-SCRIPTS-003`        | ✅     |
| AC-004 | Injects inline JavaScript code                       | `APP-PAGES-SCRIPTS-004`        | ✅     |
| AC-005 | Provides client-side configuration data              | `APP-PAGES-SCRIPTS-005`        | ✅     |
| AC-006 | Allows pages without client-side scripts             | `APP-PAGES-SCRIPTS-006`        | ✅     |
| AC-007 | Supports flexible client configuration               | `APP-PAGES-SCRIPTS-007`        | ✅     |
| AC-008 | Enables feature-driven configuration                 | `APP-PAGES-SCRIPTS-008`        | ✅     |
| AC-009 | Supports per-page script customization               | `APP-PAGES-SCRIPTS-009`        | ✅     |
| AC-010 | Composes scripts from modular schemas                | `APP-PAGES-SCRIPTS-010`        | ✅     |
| AC-011 | User can complete full scripts workflow (regression) | `APP-PAGES-SCRIPTS-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/pages/scripts/scripts.ts`
- **E2E Spec**: `specs/app/pages/scripts/scripts.spec.ts`

---

## US-PAGES-SCRIPTS-002: Feature Flags

**As a** developer,
**I want to** define client-side feature flags,
**so that** I can enable/disable UI features dynamically and provide runtime feature detection.

### Configuration

```yaml
pages:
  - path: /app
    scripts:
      features:
        darkMode: true
        betaFeatures: false
        analytics:
          enabled: true
          config:
            trackingId: 'GA-123456'
            anonymizeIp: true
```

### Acceptance Criteria

| ID     | Criterion                                             | E2E Spec                        | Status |
| ------ | ----------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Enables simple feature flag                           | `APP-PAGES-FEATURES-001`        | ✅     |
| AC-002 | Disables feature                                      | `APP-PAGES-FEATURES-002`        | ✅     |
| AC-003 | Provides feature with configuration data              | `APP-PAGES-FEATURES-003`        | ✅     |
| AC-004 | Toggles feature via enabled boolean                   | `APP-PAGES-FEATURES-004`        | ✅     |
| AC-005 | Passes configuration to feature implementation        | `APP-PAGES-FEATURES-005`        | ✅     |
| AC-006 | Validates camelCase naming convention                 | `APP-PAGES-FEATURES-006`        | ✅     |
| AC-007 | Supports both simple and complex feature definitions  | `APP-PAGES-FEATURES-007`        | ✅     |
| AC-008 | Supports flexible feature configuration               | `APP-PAGES-FEATURES-008`        | ✅     |
| AC-009 | Enables/disables UI features dynamically              | `APP-PAGES-FEATURES-009`        | ✅     |
| AC-010 | Provides runtime feature detection                    | `APP-PAGES-FEATURES-010`        | ✅     |
| AC-011 | User can complete full features workflow (regression) | `APP-PAGES-FEATURES-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/pages/scripts/features.ts`
- **E2E Spec**: `specs/app/pages/scripts/features.spec.ts`

---

## US-PAGES-SCRIPTS-003: External Scripts

**As a** developer,
**I want to** load external JavaScript dependencies,
**so that** I can include third-party libraries with proper loading behavior and security attributes.

### Configuration

```yaml
pages:
  - path: /checkout
    scripts:
      external:
        - src: 'https://js.stripe.com/v3/'
          async: true
          position: 'head'
        - src: 'https://cdn.example.com/analytics.js'
          defer: true
          integrity: 'sha384-abc123...'
          crossorigin: 'anonymous'
        - src: '/js/local-script.js'
          type: 'module'
          position: 'body-end'
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                        | Status |
| ------ | ------------------------------------------------------------- | ------------------------------- | ------ |
| AC-001 | Loads external JavaScript from CDN                            | `APP-PAGES-EXTERNAL-001`        | ✅     |
| AC-002 | Loads script asynchronously (non-blocking)                    | `APP-PAGES-EXTERNAL-002`        | ✅     |
| AC-003 | Defers script execution until DOM loaded                      | `APP-PAGES-EXTERNAL-003`        | ✅     |
| AC-004 | Loads script with type='module'                               | `APP-PAGES-EXTERNAL-004`        | ✅     |
| AC-005 | Verifies subresource integrity for security                   | `APP-PAGES-EXTERNAL-005`        | ✅     |
| AC-006 | Sets CORS policy for script loading                           | `APP-PAGES-EXTERNAL-006`        | ✅     |
| AC-007 | Inserts script in document head                               | `APP-PAGES-EXTERNAL-007`        | ✅     |
| AC-008 | Inserts script at end of body                                 | `APP-PAGES-EXTERNAL-008`        | ✅     |
| AC-009 | Inserts script at start of body                               | `APP-PAGES-EXTERNAL-009`        | ✅     |
| AC-010 | Loads multiple external scripts in order                      | `APP-PAGES-EXTERNAL-010`        | ✅     |
| AC-011 | Loads local JavaScript file                                   | `APP-PAGES-EXTERNAL-011`        | ✅     |
| AC-012 | Loads script with default settings (sync, body-end)           | `APP-PAGES-EXTERNAL-012`        | ✅     |
| AC-013 | User can complete full external scripts workflow (regression) | `APP-PAGES-EXTERNAL-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/pages/scripts/external-scripts.ts`
- **E2E Spec**: `specs/app/pages/scripts/external-scripts.spec.ts`

---

## US-PAGES-SCRIPTS-004: Inline Scripts

**As a** developer,
**I want to** inject inline JavaScript code,
**so that** I can add custom tracking, initialization code, and configuration scripts.

### Configuration

```yaml
pages:
  - path: /landing
    scripts:
      inline:
        - code: |
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          position: 'head'
        - code: 'console.log("Page loaded")'
          position: 'body-end'
          async: true
        - code: 'window.APP_CONFIG = { apiUrl: "/api" }'
          position: 'body-start'
```

### Acceptance Criteria

| ID     | Criterion                                                   | E2E Spec                      | Status |
| ------ | ----------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Injects inline JavaScript code                              | `APP-PAGES-INLINE-001`        | ✅     |
| AC-002 | Inserts code at end of body                                 | `APP-PAGES-INLINE-002`        | ✅     |
| AC-003 | Inserts code in document head                               | `APP-PAGES-INLINE-003`        | ✅     |
| AC-004 | Inserts code at start of body                               | `APP-PAGES-INLINE-004`        | ✅     |
| AC-005 | Wraps code in async IIFE (async function)                   | `APP-PAGES-INLINE-005`        | ✅     |
| AC-006 | Injects global configuration                                | `APP-PAGES-INLINE-006`        | ✅     |
| AC-007 | Injects multiple inline scripts in order                    | `APP-PAGES-INLINE-007`        | ✅     |
| AC-008 | Injects code with default settings (body-end, sync)         | `APP-PAGES-INLINE-008`        | ✅     |
| AC-009 | Enables custom tracking code                                | `APP-PAGES-INLINE-009`        | ✅     |
| AC-010 | Executes scripts in document order                          | `APP-PAGES-INLINE-010`        | ✅     |
| AC-011 | User can complete full inline scripts workflow (regression) | `APP-PAGES-INLINE-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/pages/scripts/inline-scripts.ts`
- **E2E Spec**: `specs/app/pages/scripts/inline-scripts.spec.ts`

---

## Regression Tests

| Spec ID                         | Workflow                                         | Status |
| ------------------------------- | ------------------------------------------------ | ------ |
| `APP-PAGES-SCRIPTS-REGRESSION`  | Script orchestration completes successfully      | ⏳     |
| `APP-PAGES-FEATURES-REGRESSION` | Feature flags workflow completes successfully    | ⏳     |
| `APP-PAGES-EXTERNAL-REGRESSION` | External scripts workflow completes successfully | ⏳     |
| `APP-PAGES-INLINE-REGRESSION`   | Inline scripts workflow completes successfully   | ⏳     |

---

## Coverage Summary

| User Story           | Title                | Spec Count            | Status      |
| -------------------- | -------------------- | --------------------- | ----------- |
| US-PAGES-SCRIPTS-001 | Script Orchestration | 10                    | Not Started |
| US-PAGES-SCRIPTS-002 | Feature Flags        | 10                    | Not Started |
| US-PAGES-SCRIPTS-003 | External Scripts     | 12                    | Not Started |
| US-PAGES-SCRIPTS-004 | Inline Scripts       | 10                    | Not Started |
| **Total**            |                      | **42 + 4 regression** |             |
