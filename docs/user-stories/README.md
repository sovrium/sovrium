# User Stories

> User stories organized by role, describing real needs and behaviors when building and managing applications with Sovrium.

## Roles

| Role                                       | Description                                             | Features                                                                   |
| ------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| [**Developer**](./as-developer/)           | Technical builders creating apps with Sovrium           | Authentication, Tables, Records API, Pages, Theming, i18n, CLI, Migrations |
| [**Business Admin**](./as-business-admin/) | Administrators managing users, activity, and operations | User Management, Activity Monitoring                                       |

## Structure

```
docs/user-stories/
├── as-developer/
│   ├── authentication/     # Sign-up, sign-in, 2FA, sessions, security
│   ├── tables/             # Table definitions, field types, permissions
│   ├── records-api/        # CRUD operations, batch, filtering
│   ├── pages/              # Routes, layouts, components, SEO
│   ├── theming/            # Design tokens, responsive, animations
│   ├── internationalization/  # Multi-language support
│   ├── cli/                # Server start, static build
│   ├── templates/          # Landing page templates
│   ├── app-schema/         # App metadata
│   ├── api/                # Health check
│   └── migrations/         # Schema evolution, versioning
└── as-business-admin/
    ├── user-management/    # Admin bootstrap, user CRUD, roles, sessions, impersonation
    └── activity-monitoring/  # Activity logs, audit trail
```

## User Story Format

Each user story follows this format:

````markdown
## US-{FEATURE}-{NUMBER}: {Title}

**As a** {role},
**I want to** {goal/desire},
**so that** {benefit/value}.

### Configuration

```yaml
# Example YAML configuration
```
````

### Acceptance Criteria

| ID     | Criterion               | E2E Spec    |
| ------ | ----------------------- | ----------- |
| AC-001 | {Criterion description} | `{SPEC-ID}` |

```

## Traceability

- Each acceptance criterion links to an E2E spec ID
- E2E specs are located in `specs/` directory
- Schema definitions are in `src/domain/models/app/`
- Total spec coverage: **2,018 spec IDs** across all features
```
