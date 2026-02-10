# Starting Server

> **Feature Area**: CLI - Development Server
> **Schema**: `src/domain/models/cli/`
> **E2E Specs**: `specs/cli/start/`

---

## Overview

Sovrium provides a CLI command `sovrium start` to start a development server from a configuration file. The command supports multiple configuration formats (YAML, JSON), automatic format detection, environment variable configuration, and watch mode for live reloading during development.

---

## US-CLI-START-001: Start with YAML Configuration

**As a** developer,
**I want to** start my Sovrium application using a YAML configuration file,
**so that** I can use a human-readable format with comments for my app configuration.

### Configuration

```yaml
# app.yaml - Example Sovrium configuration
name: My Application
version: 1.0.0

# Tables configuration
tables:
  - id: 1
    name: users
    fields:
      - id: 1
        name: email
        type: email
        required: true
        unique: true
      - id: 2
        name: name
        type: text
        required: true

# Pages configuration
pages:
  - id: 1
    name: home
    path: /
    meta:
      title: Welcome

# Theme configuration (optional)
theme:
  colors:
    primary: '#3b82f6'
```

### CLI Usage

```bash
# Start with YAML config
sovrium start app.yaml

# Start with .yml extension
sovrium start config.yml
```

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                    | Status |
| ------ | --------------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Server starts with valid YAML config file                       | `CLI-START-YAML-001`        | ✅     |
| AC-002 | Supports .yml file extension                                    | `CLI-START-YAML-002`        | ✅     |
| AC-003 | Invalid YAML syntax returns clear error message                 | `CLI-START-YAML-003`        | ✅     |
| AC-004 | Schema validation errors are reported                           | `CLI-START-YAML-004`        | ✅     |
| AC-005 | YAML-specific features work (comments, anchors)                 | `CLI-START-YAML-005`        | ✅     |
| AC-006 | Comprehensive YAML config with all features works               | `CLI-START-YAML-006`        | ✅     |
| AC-007 | File not found error is reported for YAML config                | `CLI-START-YAML-007`        | ✅     |
| AC-008 | User can complete full YAML configuration workflow (regression) | `CLI-START-YAML-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/cli/start/yaml-config.spec.ts`

---

## US-CLI-START-002: Start with JSON Configuration

**As a** developer,
**I want to** start my Sovrium application using a JSON configuration file,
**so that** I can use a standard format compatible with other tools and APIs.

### Configuration

```json
{
  "name": "My Application",
  "version": "1.0.0",
  "tables": [
    {
      "id": 1,
      "name": "users",
      "fields": [
        { "id": 1, "name": "email", "type": "email", "required": true, "unique": true },
        { "id": 2, "name": "name", "type": "text", "required": true }
      ]
    }
  ],
  "pages": [{ "id": 1, "name": "home", "path": "/", "meta": { "title": "Welcome" } }]
}
```

### CLI Usage

```bash
# Start with JSON config
sovrium start app.json
```

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                    | Status |
| ------ | --------------------------------------------------------------- | --------------------------- | ------ |
| AC-001 | Server starts with valid JSON config file                       | `CLI-START-JSON-001`        | ✅     |
| AC-002 | Invalid JSON syntax returns clear error message                 | `CLI-START-JSON-002`        | ✅     |
| AC-003 | Schema validation errors are reported                           | `CLI-START-JSON-003`        | ✅     |
| AC-004 | File not found error is reported with helpful message           | `CLI-START-JSON-004`        | ✅     |
| AC-005 | JSON config with all app schema features works                  | `CLI-START-JSON-005`        | ✅     |
| AC-006 | Environment variable overrides work with JSON                   | `CLI-START-JSON-006`        | ✅     |
| AC-007 | User can complete full JSON configuration workflow (regression) | `CLI-START-JSON-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/cli/start/json-config.spec.ts`

---

## US-CLI-START-003: Automatic Format Detection

**As a** developer,
**I want to** have the CLI automatically detect the configuration format,
**so that** I don't need to specify the format manually.

### CLI Usage

```bash
# Format auto-detected from extension
sovrium start app.json      # Detects JSON
sovrium start app.yaml      # Detects YAML
sovrium start app.yml       # Detects YAML
sovrium start config.JSON   # Case-insensitive detection
```

### Acceptance Criteria

| ID     | Criterion                                                     | E2E Spec                      | Status |
| ------ | ------------------------------------------------------------- | ----------------------------- | ------ |
| AC-001 | Auto-detects JSON format from .json extension                 | `CLI-START-FORMAT-001`        | ✅     |
| AC-002 | Auto-detects YAML format from .yaml extension                 | `CLI-START-FORMAT-002`        | ✅     |
| AC-003 | Auto-detects YAML format from .yml extension                  | `CLI-START-FORMAT-003`        | ✅     |
| AC-004 | Reports error for unsupported file extensions                 | `CLI-START-FORMAT-004`        | ✅     |
| AC-005 | Handles mixed case extensions correctly                       | `CLI-START-FORMAT-005`        | ✅     |
| AC-006 | User can complete full format detection workflow (regression) | `CLI-START-FORMAT-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/cli/start/format-detection.spec.ts`

---

## US-CLI-START-004: Environment Variable Configuration

**As a** developer,
**I want to** configure my application via environment variables,
**so that** I can deploy to different environments without changing config files.

### Configuration

```bash
# Inline JSON schema
export APP_SCHEMA='{"name": "My App", "tables": []}'
sovrium start

# Inline YAML schema
export APP_SCHEMA='name: My App\ntables: []'
sovrium start

# Remote URL (JSON)
export APP_SCHEMA='https://config.example.com/app.json'
sovrium start

# Remote URL (YAML)
export APP_SCHEMA='https://config.example.com/app.yaml'
sovrium start
```

### Acceptance Criteria

| ID     | Criterion                                                       | E2E Spec                   | Status |
| ------ | --------------------------------------------------------------- | -------------------------- | ------ |
| AC-001 | Loads inline JSON from APP_SCHEMA environment variable          | `CLI-START-ENV-001`        | ✅     |
| AC-002 | Loads inline YAML from APP_SCHEMA environment variable          | `CLI-START-ENV-002`        | ✅     |
| AC-003 | Loads schema from remote JSON URL                               | `CLI-START-ENV-003`        | ✅     |
| AC-004 | Loads schema from remote YAML URL                               | `CLI-START-ENV-004`        | ✅     |
| AC-005 | File path argument takes priority over environment variable     | `CLI-START-ENV-005`        | ✅     |
| AC-006 | Invalid JSON in environment variable returns clear error        | `CLI-START-ENV-006`        | ✅     |
| AC-007 | Invalid YAML in environment variable returns clear error        | `CLI-START-ENV-007`        | ✅     |
| AC-008 | Unreachable URL returns clear error message                     | `CLI-START-ENV-008`        | ✅     |
| AC-009 | URL returning non-schema content returns clear error            | `CLI-START-ENV-009`        | ✅     |
| AC-010 | Auto-detects JSON format from Content-Type header               | `CLI-START-ENV-010`        | ✅     |
| AC-011 | Auto-detects YAML format from file extension in URL             | `CLI-START-ENV-011`        | ✅     |
| AC-012 | User can complete full environment config workflow (regression) | `CLI-START-ENV-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/cli/start/env-schema.spec.ts`

---

## US-CLI-START-005: Watch Mode

**As a** developer,
**I want to** run the server in watch mode,
**so that** the server automatically reloads when I change the configuration file.

### CLI Usage

```bash
# Watch mode with --watch flag
sovrium start app.yaml --watch

# Watch mode with -w short flag
sovrium start app.yaml -w
```

### Acceptance Criteria

| ID     | Criterion                                               | E2E Spec                     | Status |
| ------ | ------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Activates watch mode with --watch flag                  | `CLI-START-WATCH-001`        | ✅     |
| AC-002 | Activates watch mode with -w short flag                 | `CLI-START-WATCH-002`        | ✅     |
| AC-003 | Reloads server when JSON config file changes            | `CLI-START-WATCH-003`        | ✅     |
| AC-004 | Reloads server when YAML config file changes            | `CLI-START-WATCH-004`        | ✅     |
| AC-005 | Keeps old server running when new config is invalid     | `CLI-START-WATCH-005`        | ✅     |
| AC-006 | Displays watch status messages in correct sequence      | `CLI-START-WATCH-006`        | ✅     |
| AC-007 | Watch mode is not activated without --watch or -w flag  | `CLI-START-WATCH-007`        | ✅     |
| AC-008 | User can complete full watch mode workflow (regression) | `CLI-START-WATCH-REGRESSION` | ✅     |

### Implementation References

- **E2E Spec**: `specs/cli/start/watch-mode.spec.ts`

---

## Regression Tests

| Spec ID                       | Workflow                                          | Status |
| ----------------------------- | ------------------------------------------------- | ------ |
| `CLI-START-YAML-REGRESSION`   | Developer starts server with YAML configuration   | `[x]`  |
| `CLI-START-JSON-REGRESSION`   | Developer starts server with JSON configuration   | `[x]`  |
| `CLI-START-FORMAT-REGRESSION` | Format detection works for all file types         | `[x]`  |
| `CLI-START-ENV-REGRESSION`    | Developer uses environment variable in production | `[x]`  |
| `CLI-START-WATCH-REGRESSION`  | Developer develops with live config reloading     | `[x]`  |

---

## Coverage Summary

| User Story       | Title              | Spec Count            | Status   |
| ---------------- | ------------------ | --------------------- | -------- |
| US-CLI-START-001 | YAML Configuration | 7                     | Complete |
| US-CLI-START-002 | JSON Configuration | 6                     | Complete |
| US-CLI-START-003 | Format Detection   | 5                     | Complete |
| US-CLI-START-004 | Environment Config | 11                    | Complete |
| US-CLI-START-005 | Watch Mode         | 7                     | Complete |
| **Total**        |                    | **36 + 5 regression** |          |
