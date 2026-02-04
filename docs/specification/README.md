# Sovrium Specification Documentation

> **Source of Truth** for all feature behavior and requirements via User Stories.

## Purpose

This documentation serves as the **PRIMARY source of truth** for:

- **What features should do** (User Stories with Acceptance Criteria)
- **How they are implemented** (Effect Schemas)
- **How they are validated** (E2E test coverage)

## Source of Truth Hierarchy

| Priority       | Location                 | Purpose                                  |
| -------------- | ------------------------ | ---------------------------------------- |
| 1️⃣ **PRIMARY** | `docs/specification/`    | WHAT features should do (User Stories)   |
| 2️⃣             | `src/domain/models/app/` | HOW it's implemented (Effect Schemas)    |
| 3️⃣             | `specs/`                 | VALIDATES it works correctly (E2E tests) |

## User Story Structure

Each domain follows a nested structure:

```
docs/specification/{domain}/
├── README.md                           # Domain overview
├── {feature-area}/
│   ├── as-developer.md                 # Developer user stories
│   ├── as-app-administrator.md         # Admin user stories
│   └── as-{role}.md                    # Role-specific stories
```

### User Story ID Format

- **User Story ID**: `US-{DOMAIN}-{FEATURE}-{NNN}` (e.g., `US-AUTH-METHOD-001`)
- **Spec Test ID**: `API-{DOMAIN}-{FEATURE}-{NNN}` or `APP-{DOMAIN}-{FEATURE}-{NNN}`
- **Acceptance Criteria ID**: `AC-{NNN}` (local to each user story)

## Domain Specifications

| Domain                                | Feature Areas                                              | Roles                                        |
| ------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| [Auth](./auth/README.md)              | authentication-methods, session-management, authorization  | developer, app-administrator, end-user       |
| [Tables](./tables/README.md)          | table-definition, data-manager, bulk-operations, fields    | developer, app-administrator                 |
| [Pages](./pages/README.md)            | page-definition, layouts, content-blocks, navigation       | developer, app-administrator                 |
| [Theme](./theme/README.md)            | visual-editor, colors, typography, branding, dark-mode     | developer, app-administrator                 |
| [API](./api/README.md)                | rest-api, auth-endpoints, webhooks, security, docs         | developer, api-consumer, app-administrator   |
| [Forms](./forms/README.md)            | form-definition, form-fields, responses, spam-protection   | developer, app-administrator                 |
| [Admin Space](./admin-space/README.md)| dashboard, app-editor, schema-versioning, settings         | developer, app-administrator, business-user  |
| [Automations](./automations/README.md)| workflow-definition, triggers, actions, monitoring         | developer, app-administrator                 |
| [Integrations](./integrations/README.md)| oauth, connected-accounts, capabilities, services        | developer, end-user, app-administrator       |
| [Analytics](./analytics/README.md)    | traffic, sources, journey, performance, activity, privacy  | developer, app-administrator                 |

## User Story Template

Each user story file follows this structure:

```markdown
# {Domain} > {Feature Area} > As {Role}

> **Domain**: {domain}
> **Feature Area**: {feature-area}
> **Role**: {Role Name}
> **Schema Path**: `src/domain/models/app/{domain}/`
> **Spec Path**: `specs/api/{domain}/`

---

## User Stories

### US-{DOMAIN}-{FEATURE}-{NNN}: {Title}

**Story**: As a {role}, I want to {action} so that {benefit}.

**Status**: `[ ]` Not Started | `[~]` Partial | `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion               | Spec Test ID               | Schema      | Status |
|--------|-------------------------|----------------------------|-------------|--------|
| AC-001 | {criterion description} | `API-{DOMAIN}-{FEATURE}-001`| `{schema}` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/{domain}/` `[ ] Needs Creation`
- **E2E Spec**: `specs/api/{domain}/{feature}/` `[ ] Needs Creation`
- **API Route**: `/api/{domain}/{feature}` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID                  | Title   | Status            | Criteria Met |
|---------------------------|---------|-------------------|--------------|
| US-{DOMAIN}-{FEATURE}-001 | {Title} | `[ ]` Not Started | 0/N          |
```

## How to Use This Documentation

### 1. Before Implementing a Feature

1. Find the relevant domain directory (e.g., `auth/`, `tables/`)
2. Locate the feature area and role-specific file
3. Read the user story and acceptance criteria
4. Check schema and spec test mappings

### 2. Before Writing Tests

1. Reference the Spec Test ID from acceptance criteria
2. Follow GIVEN-WHEN-THEN structure matching the user story
3. Use `@spec` for exhaustive tests, `@regression` for workflows

### 3. Before Code Review

1. Cross-reference implementation with user story acceptance criteria
2. Verify all criteria have corresponding spec tests
3. Check that schemas match specification requirements

## Quick Reference

### Test Tags

| Tag           | Purpose                     | Location              |
| ------------- | --------------------------- | --------------------- |
| `@spec`       | Exhaustive unit-level tests | Individual test cases |
| `@regression` | Workflow integration tests  | Combined scenarios    |

### Schema Locations

| Domain        | Schema Path                              |
| ------------- | ---------------------------------------- |
| Auth          | `src/domain/models/app/auth/*.ts`        |
| Tables        | `src/domain/models/app/table/*.ts`       |
| Pages         | `src/domain/models/app/page/*.ts`        |
| Theme         | `src/domain/models/app/theme/*.ts`       |
| Forms         | `src/domain/models/app/form/*.ts`        |
| Admin Space   | `src/domain/models/app/admin/*.ts`       |
| Automations   | `src/domain/models/app/automation/*.ts`  |
| Integrations  | `src/domain/models/app/integration/*.ts` |
| Analytics     | `src/domain/models/app/analytics/*.ts`   |

## Related Documentation

- [SPEC-PROGRESS.md](../../SPEC-PROGRESS.md) - Detailed test progress tracking
- [VISION.md](../../VISION.md) - Product vision and roadmap
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [Architecture](../architecture/) - Technical architecture patterns
