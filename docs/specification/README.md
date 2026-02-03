# Sovrium Specification Documentation

> **Source of Truth** for all feature behavior and requirements.

## Purpose

This documentation serves as the **PRIMARY source of truth** for:

- **What features should do** (behavior specifications)
- **How they are implemented** (schema locations)
- **How they are validated** (E2E test coverage)

## Source of Truth Hierarchy

| Priority       | Location                 | Purpose                                  |
| -------------- | ------------------------ | ---------------------------------------- |
| 1️⃣ **PRIMARY** | `docs/specification/`    | WHAT features should do                  |
| 2️⃣             | `src/domain/models/app/` | HOW it's implemented (Effect Schemas)    |
| 3️⃣             | `specs/`                 | VALIDATES it works correctly (E2E tests) |

## Project Status

| Metric               | Value                 | Status             |
| -------------------- | --------------------- | ------------------ |
| **Overall Progress** | 93% (2095/2244 tests) | 🟡 Needs Attention |
| **Quality Score**    | 95%                   | 🟢 Excellent       |
| **Total Spec Files** | 226                   | -                  |
| **Total Tests**      | 2244                  | -                  |
| **Passing**          | 2095                  | ✅                 |
| **Remaining**        | 149                   | ⏸️ fixme           |

## Feature Specifications

| Feature                       | Spec Files | Tests | Progress | Docs                       |
| ----------------------------- | ---------- | ----- | -------- | -------------------------- |
| [App Schema](./app-schema.md) | 3          | ~15   | 🟢 100%  | Root configuration         |
| [Theme](./theme.md)           | 8          | ~40   | 🟢 100%  | Colors, fonts, spacing     |
| [Tables](./tables.md)         | 69         | ~350  | 🟢 100%  | Fields, views, permissions |
| [Pages](./pages.md)           | 28         | ~140  | 🟢 100%  | Layouts, meta, sections    |
| [Blocks](./blocks.md)         | 5          | ~25   | 🟢 100%  | Block system               |
| [Languages](./languages.md)   | 1          | ~5    | 🟢 100%  | i18n configuration         |
| [Auth](./auth.md)             | 34         | ~250  | 🟡 76%   | Authentication             |
| [API](./api.md)               | 69         | ~600  | 🟡 76%   | REST endpoints             |
| [Migrations](./migrations.md) | 17         | ~85   | 🟢 100%  | Schema evolution           |

## Domain Coverage

### App Domain (`specs/app/`) - 🟢 100%

Core schema features for app configuration:

```
specs/app/
├── name.spec.ts              # App name validation
├── version.spec.ts           # Semantic versioning
├── description.spec.ts       # App description
├── theme/                    # 8 specs - Design tokens
├── tables/                   # 69 specs - Data modeling
├── pages/                    # 28 specs - UI configuration
├── blocks/                   # 5 specs - Reusable components
└── languages/                # 1 spec - i18n
```

### API Domain (`specs/api/`) - 🟡 76%

REST API endpoints:

```
specs/api/
├── auth/                     # 34 specs - Authentication
├── tables/                   # 30 specs - CRUD operations
├── activity/                 # 4 specs - Audit logging
└── health/                   # 1 spec - Health check
```

### Migrations Domain (`specs/migrations/`) - 🟢 100%

Schema evolution:

```
specs/migrations/
├── migration-system/         # 4 specs - Core system
└── schema-evolution/         # 13 specs - Field changes
```

## How to Use This Documentation

### 1. Before Implementing a Feature

1. Check the relevant specification file for expected behavior
2. Review schema definitions in `src/domain/models/app/`
3. Understand test coverage mapping

### 2. Before Writing Tests

1. Verify test coverage mapping in the specification
2. Follow GIVEN-WHEN-THEN structure
3. Use @spec for exhaustive tests, @regression for workflows

### 3. Before Code Review

1. Cross-reference implementation with specification
2. Verify all validation rules are implemented
3. Check E2E test coverage

## Quick Reference

### Test Tags

| Tag           | Purpose                     | Location              |
| ------------- | --------------------------- | --------------------- |
| `@spec`       | Exhaustive unit-level tests | Individual test cases |
| `@regression` | Workflow integration tests  | Combined scenarios    |

### Schema Locations

| Feature   | Schema Path                           |
| --------- | ------------------------------------- |
| App Root  | `src/domain/models/app/*.ts`          |
| Theme     | `src/domain/models/app/theme/*.ts`    |
| Tables    | `src/domain/models/app/table/*.ts`    |
| Pages     | `src/domain/models/app/page/*.ts`     |
| Blocks    | `src/domain/models/app/block/*.ts`    |
| Languages | `src/domain/models/app/language/*.ts` |
| Auth      | `src/domain/models/app/auth/*.ts`     |

## Related Documentation

- [SPEC-PROGRESS.md](../../SPEC-PROGRESS.md) - Detailed test progress tracking
- [VISION.md](../../VISION.md) - Product vision and roadmap
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [Architecture](../architecture/) - Technical architecture patterns
