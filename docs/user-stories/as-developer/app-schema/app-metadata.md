# App Metadata Configuration

> **Feature Area**: App Schema - Metadata Properties
> **Schema**: `src/domain/models/app/name.ts`, `src/domain/models/app/version.ts`, `src/domain/models/app/description.ts`, `src/domain/models/app/common/`
> **E2E Specs**: `specs/app/name.spec.ts`, `specs/app/version.spec.ts`, `specs/app/description.spec.ts`

---

## Overview

Sovrium applications have core metadata properties that define the app's identity: name, version, and description. These properties are displayed on the homepage and affect the overall branding and SEO of the application.

---

## US-APP-METADATA-001: App Name

**As a** developer,
**I want to** define a name for my application,
**so that** users can identify the application and the name appears in the page title and heading.

### Configuration

```yaml
name: my-awesome-app # Required, kebab-case
```

### Acceptance Criteria

| ID     | Criterion                                          | E2E Spec              | Status |
| ------ | -------------------------------------------------- | --------------------- | ------ |
| AC-001 | App name displays in h1 heading                    | `APP-NAME-001`        | ✅     |
| AC-002 | App name shows in page title with Sovrium branding | `APP-NAME-002`        | ✅     |
| AC-003 | Single-character name displays correctly           | `APP-NAME-003`        | ✅     |
| AC-004 | Long name (214 chars) displays without truncation  | `APP-NAME-004`        | ✅     |
| AC-005 | Exactly one h1 element exists on page              | `APP-NAME-005`        | ✅     |
| AC-006 | h1 is the first heading level on page              | `APP-NAME-006`        | ✅     |
| AC-007 | h1 heading is centered horizontally                | `APP-NAME-007`        | ✅     |
| AC-008 | h1 heading is visible and not hidden               | `APP-NAME-008`        | ✅     |
| AC-009 | Text content exactly matches input                 | `APP-NAME-009`        | ✅     |
| AC-010 | Uses TypographyH1 component styling                | `APP-NAME-010`        | ✅     |
| AC-011 | Different app names display in independent runs    | `APP-NAME-011`        | ✅     |
| AC-012 | Complex name meets all display requirements        | `APP-NAME-012`        | ✅     |
| AC-013 | User can complete full name workflow (regression)  | `APP-NAME-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/name.ts`
- **E2E Spec**: `specs/app/name.spec.ts`

---

## US-APP-METADATA-002: App Version

**As a** developer,
**I want to** specify a version for my application,
**so that** users can see the current version and track releases.

### Configuration

```yaml
name: my-app
version: 1.0.0 # Optional, SemVer format
# version: 1.0.0-beta.1  # Pre-release version
# version: 1.0.0+build.123  # Version with build metadata
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                 | Status |
| ------ | -------------------------------------------------------- | ------------------------ | ------ |
| AC-001 | Version badge displays correct version for simple SemVer | `APP-VERSION-001`        | ✅     |
| AC-002 | No version badge when version property is missing        | `APP-VERSION-002`        | ✅     |
| AC-003 | Pre-release version displays exactly as specified        | `APP-VERSION-003`        | ✅     |
| AC-004 | Version with build metadata displays intact              | `APP-VERSION-004`        | ✅     |
| AC-005 | Complete version string with pre-release and build       | `APP-VERSION-005`        | ✅     |
| AC-006 | Badge displays before (above) the app name heading       | `APP-VERSION-006`        | ✅     |
| AC-007 | Version badge has proper accessibility attributes        | `APP-VERSION-007`        | ✅     |
| AC-008 | User can complete full version workflow (regression)     | `APP-VERSION-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/version.ts`
- **E2E Spec**: `specs/app/version.spec.ts`

---

## US-APP-METADATA-003: App Description

**As a** developer,
**I want to** provide a description for my application,
**so that** users understand the purpose of the application at a glance.

### Configuration

```yaml
name: my-app
description: A powerful application for managing tasks and projects
```

### Acceptance Criteria

| ID     | Criterion                                                | E2E Spec                     | Status |
| ------ | -------------------------------------------------------- | ---------------------------- | ------ |
| AC-001 | Description displays below app name                      | `APP-DESCRIPTION-001`        | ✅     |
| AC-002 | No description element when property is missing          | `APP-DESCRIPTION-002`        | ✅     |
| AC-003 | Description renders AFTER h1 title in DOM order          | `APP-DESCRIPTION-003`        | ✅     |
| AC-004 | Special characters display correctly                     | `APP-DESCRIPTION-004`        | ✅     |
| AC-005 | Unicode characters and emojis display correctly          | `APP-DESCRIPTION-005`        | ✅     |
| AC-006 | Long description wraps properly and remains visible      | `APP-DESCRIPTION-006`        | ✅     |
| AC-007 | No description element when description is empty         | `APP-DESCRIPTION-007`        | ✅     |
| AC-008 | Description renders as a paragraph element               | `APP-DESCRIPTION-008`        | ✅     |
| AC-009 | Description is centered horizontally                     | `APP-DESCRIPTION-009`        | ✅     |
| AC-010 | Description displays in viewport                         | `APP-DESCRIPTION-010`        | ✅     |
| AC-011 | Text displays exactly as input without transformation    | `APP-DESCRIPTION-011`        | ✅     |
| AC-012 | Elements display in order: version - title - description | `APP-DESCRIPTION-012`        | ✅     |
| AC-013 | Full description displays without truncation             | `APP-DESCRIPTION-013`        | ✅     |
| AC-014 | HTML tags are escaped and display as text                | `APP-DESCRIPTION-014`        | ✅     |
| AC-015 | Appropriate spacing between title and description        | `APP-DESCRIPTION-015`        | ✅     |
| AC-016 | User can complete full description workflow (regression) | `APP-DESCRIPTION-REGRESSION` | ✅     |

### Implementation References

- **Schema**: `src/domain/models/app/description.ts`
- **E2E Spec**: `specs/app/description.spec.ts`

---

## Regression Tests

| Spec ID                      | Workflow                                        | Status |
| ---------------------------- | ----------------------------------------------- | ------ |
| `APP-NAME-REGRESSION`        | App name displays correctly in all scenarios    | ✅     |
| `APP-VERSION-REGRESSION`     | Version badge displays with all version formats | ✅     |
| `APP-DESCRIPTION-REGRESSION` | Description displays with various content types | ✅     |

---

## Coverage Summary

| User Story          | Title           | Spec Count | Status   |
| ------------------- | --------------- | ---------- | -------- |
| US-APP-METADATA-001 | App Name        | 13         | Complete |
| US-APP-METADATA-002 | App Version     | 8          | Complete |
| US-APP-METADATA-003 | App Description | 16         | Complete |
| **Total**           |                 | **37**     |          |
