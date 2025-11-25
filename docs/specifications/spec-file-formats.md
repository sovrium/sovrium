# Specification File Formats

> **Purpose**: This document defines the two specification file formats used across the Sovrium project for E2E test generation.

## Overview

The Sovrium project uses **two distinct specification formats** depending on the domain and purpose:

1. **Full Schema Format** - For domains that require complete JSON Schema or OpenAPI validation
2. **Simple Spec Format** - For domains that only need to list executable test specifications

## Format Comparison

| Aspect              | Full Schema Format                          | Simple Spec Format                                   |
| ------------------- | ------------------------------------------- | ---------------------------------------------------- |
| **File Extension**  | `.schema.json` (app), `.openapi.json` (api) | `.json`                                              |
| **Domains**         | `specs/app/`, `specs/api/`                  | `specs/admin/`, `specs/migrations/`, `specs/static/` |
| **Purpose**         | Define data structures + test specs         | List executable test specs only                      |
| **Structure**       | JSON Schema Draft 7 / OpenAPI 3.1.0         | Title + Description + x-specs                        |
| **Size**            | Large (50-200+ lines)                       | Small (10-50 lines)                                  |
| **Maintainability** | Complex (schema + specs)                    | Simple (specs only)                                  |

---

## 1. Full Schema Format

### Purpose

Used when the specification file serves **dual purposes**:

1. **Data Structure Definition** - Defines TypeScript types, validation rules, and property constraints
2. **Test Specification** - Lists executable E2E test scenarios

### Domains

#### App Domain (`specs/app/**/`)

- **File Extension**: `.schema.json`
- **Standard**: JSON Schema Draft 7
- **Example**: `specs/app/name/name.schema.json`

**Structure**:

```json
{
  "$id": "name.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Application Name",
  "description": "Human-readable application name",
  "type": "string",
  "minLength": 1,
  "maxLength": 214,
  "pattern": "^[a-z0-9-_.~@/]+$",
  "examples": ["my-app", "todo-app", "@myorg/my-app"],
  "x-specs": [
    {
      "id": "APP-NAME-001",
      "given": "app with name 'my-app'",
      "when": "user views homepage",
      "then": "displays 'my-app' in header"
    }
  ]
}
```

**Key Properties**:

- `$id`, `$schema` - JSON Schema metadata
- `type`, `properties`, `required` - Data type definitions
- `minLength`, `maxLength`, `pattern` - Validation constraints
- `examples` - Sample values
- `x-specs` - Test specifications array

#### API Domain (`specs/api/**/`)

- **File Extension**: `.openapi.json`
- **Standard**: OpenAPI 3.1.0
- **Example**: `specs/api/tables/tables.openapi.json`

**Structure**:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Tables API",
    "version": "1.0.0",
    "description": "API endpoints for table management"
  },
  "paths": {
    "/api/tables": {
      "get": {
        "summary": "List all tables",
        "operationId": "listTables",
        "responses": {
          "200": {
            "description": "List of tables",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/TableList" }
              }
            }
          }
        },
        "x-specs": [
          {
            "id": "API-TABLES-001",
            "given": "database with 3 tables",
            "when": "GET /api/tables",
            "then": "returns 200 with array of 3 tables"
          }
        ]
      }
    }
  },
  "components": {
    "schemas": {}
  }
}
```

**Key Properties**:

- `openapi`, `info` - OpenAPI metadata
- `paths` - API endpoints and operations
- `components` - Reusable schemas, responses
- `x-specs` - Test specifications (per operation)

---

## 2. Simple Spec Format

### Purpose

Used when the specification file serves **single purpose**:

- **Test Specification Only** - Lists executable E2E test scenarios without data structure definitions

This format is ideal for:

- Admin UI workflows (no schema needed, only behavioral specs)
- Migration operations (runtime behavior, not data types)
- Static site generation (build process, not data validation)

### Domains

#### Admin Domain (`specs/admin/**/`)

- **File Extension**: `.json`
- **Example**: `specs/admin/connections/connections.json`

#### Migrations Domain (`specs/migrations/**/`)

- **File Extension**: `.json` (was `.schema.json`)
- **Example**: `specs/migrations/migration-system/checksum/checksum.json`

#### Static Domain (`specs/static/`)

- **File Extension**: `.json` (was `.schema.json`)
- **Example**: `specs/static/static-assets.json`

### Structure

**Required Fields**:

```json
{
  "title": "Feature Title",
  "description": "Clear description of what this specification covers",
  "x-specs": [
    {
      "id": "PREFIX-ENTITY-001",
      "given": "preconditions (context/setup)",
      "when": "action or trigger",
      "then": "expected outcome",
      "validation": {
        "setup": {},
        "assertions": []
      }
    }
  ]
}
```

**Field Descriptions**:

- **title** (required) - Human-readable feature name
- **description** (required) - Purpose and scope of specifications
- **x-specs** (required) - Array of test specifications

### Spec ID Prefixes

| Domain     | Prefix    | Example                 |
| ---------- | --------- | ----------------------- |
| Admin      | `ADMIN-`  | `ADMIN-CONNECTIONS-001` |
| Migrations | `MIG-`    | `MIG-CHECKSUM-001`      |
| Static     | `STATIC-` | `STATIC-ASSETS-001`     |

### Example: Admin Spec

```json
{
  "title": "Connection Management (Admin)",
  "description": "Admin-level specifications for connection lifecycle management",
  "x-specs": [
    {
      "id": "ADMIN-CONNECTIONS-001",
      "given": "user is authenticated in a workspace",
      "when": "user navigates to connections page",
      "then": "system displays list of all configured connections with status"
    },
    {
      "id": "ADMIN-CONNECTIONS-002",
      "given": "connection exists with valid OAuth credentials but is not connected",
      "when": "user initiates connection via 'Connect' button",
      "then": "OAuth flow completes successfully and connection status becomes 'connected'"
    }
  ]
}
```

### Example: Migrations Spec

```json
{
  "title": "Checksum Optimization",
  "description": "Runtime SQL migration checksum system for skip-if-unchanged optimization",
  "x-specs": [
    {
      "id": "MIG-CHECKSUM-001",
      "given": "table schema configuration with no previous checksum",
      "when": "runtime migration executes for first time",
      "then": "PostgreSQL saves SHA-256 checksum to _sovrium_schema_checksum table",
      "validation": {
        "setup": {
          "executeQuery": ["CREATE TABLE IF NOT EXISTS ..."]
        },
        "assertions": [
          {
            "description": "Checksum table exists",
            "executeQuery": "SELECT table_name FROM information_schema.tables...",
            "expected": { "table_name": "_sovrium_schema_checksum" }
          }
        ]
      }
    }
  ]
}
```

### Example: Static Spec

```json
{
  "title": "Static Site Generation - Asset Management",
  "description": "Specifications for asset management in static site generation",
  "x-specs": [
    {
      "id": "STATIC-ASSETS-001",
      "given": "a public/ directory with text and binary files",
      "when": "static site is generated",
      "then": "all files should be copied to output directory with correct encoding",
      "application": {
        "useCases": ["Copy favicon, manifest, images from public/ to output"],
        "assertions": [
          "Copy all files from public/ to output root",
          "Preserve file names and extensions exactly"
        ]
      }
    }
  ]
}
```

---

## Migration Guide

### From Full Schema to Simple Spec

If you have an existing `.schema.json` file in admin/migrations/static domains that only lists test specs:

**Before** (unnecessary complexity):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "checksum.schema.json",
  "title": "Checksum Optimization",
  "description": "Runtime SQL migration checksum system",
  "type": "object",
  "properties": { ... },
  "required": ["..."],
  "x-specs": [ ... ]
}
```

**After** (simplified):

```json
{
  "title": "Checksum Optimization",
  "description": "Runtime SQL migration checksum system",
  "x-specs": [ ... ]
}
```

**Migration Script**:

```bash
bun run scripts/refactor-specs-format.ts specs/migrations
bun run scripts/refactor-specs-format.ts specs/static
```

---

## Best Practices

### When to Use Full Schema Format

✅ **Use when**:

- Defining data structures that generate TypeScript types
- Validating input/output schemas at runtime
- Need JSON Schema validation constraints
- Generating API documentation from OpenAPI

❌ **Don't use when**:

- Only listing test scenarios
- No runtime validation needed
- No type generation required

### When to Use Simple Spec Format

✅ **Use when**:

- Listing behavioral test specifications
- Testing UI workflows and interactions
- Testing runtime operations (migrations, builds)
- No data structure definition needed

❌ **Don't use when**:

- Need to generate TypeScript types
- Require JSON Schema validation
- Building API documentation

### File Organization

```
specs/
├── app/                    # Full Schema Format (.schema.json)
│   ├── name/
│   │   ├── name.schema.json       ← JSON Schema Draft 7
│   │   └── name.spec.ts
│   └── theme/
│       ├── theme.schema.json      ← JSON Schema Draft 7
│       └── theme.spec.ts
├── admin/                  # Simple Spec Format (.json)
│   ├── connections/
│   │   ├── connections.json       ← Simple format
│   │   └── connections.spec.ts
│   └── tables/
│       ├── tables.json             ← Simple format
│       └── tables.spec.ts
├── api/                    # Full Schema Format (.openapi.json)
│   └── tables/
│       ├── tables.openapi.json    ← OpenAPI 3.1.0
│       └── tables.spec.ts
├── migrations/             # Simple Spec Format (.json)
│   ├── migration-system/
│   │   └── checksum/
│   │       ├── checksum.json      ← Simple format
│   │       └── checksum.spec.ts
│   └── schema-evolution/
│       └── add-field/
│           ├── add-field.json     ← Simple format
│           └── add-field.spec.ts
└── static/                 # Simple Spec Format (.json)
    ├── static-assets.json          ← Simple format
    ├── static-assets.spec.ts
    ├── static-generation.json      ← Simple format
    └── static-generation.spec.ts
```

---

## Validation

### Full Schema Format

**App Domain**:

```bash
bun run validate:app-specs
```

**API Domain**:

```bash
bun run validate:api-specs
```

### Simple Spec Format

**Admin Domain**:

```bash
bun run validate:admin-specs
```

**Migrations Domain**:

```bash
# No specific validator yet - uses same rules as admin
bun run validate:admin-specs specs/migrations
```

**Static Domain**:

```bash
# No specific validator yet - uses same rules as admin
bun run validate:admin-specs specs/static
```

---

## E2E Test Generation

Both formats generate the same test structure via `generating-e2e-tests` skill:

```typescript
// Invoke programmatically
Skill(skill: "generating-e2e-tests")
```

**Generated Tests**:

- **N @spec tests** - One per x-spec (exhaustive acceptance criteria)
- **1 @regression test** - Optimized integration workflow

**Test File Location**:

- Co-located with specification file
- Same directory, `.spec.ts` extension

---

## Summary

| Domain         | Format      | File Extension  | Purpose                      |
| -------------- | ----------- | --------------- | ---------------------------- |
| **App**        | Full Schema | `.schema.json`  | Data structures + test specs |
| **API**        | Full Schema | `.openapi.json` | API contracts + test specs   |
| **Admin**      | Simple Spec | `.json`         | Test specs only              |
| **Migrations** | Simple Spec | `.json`         | Test specs only              |
| **Static**     | Simple Spec | `.json`         | Test specs only              |

**Key Principle**: Use the **simplest format** that meets your needs. If you don't need schema validation or type generation, use the Simple Spec Format.
