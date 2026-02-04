# User Stories

> User stories organized by role, describing real developer needs and behaviors when building applications with Sovrium.

## Roles

| Role                             | Description                                   | Features                                                                   |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| [**Developer**](./as-developer/) | Technical builders creating apps with Sovrium | Authentication, Tables, Records API, Pages, Theming, i18n, CLI, Migrations |

## Structure

```
docs/user-stories/
└── as-developer/
    ├── authentication/     # Sign-up, sign-in, 2FA, sessions
    ├── tables/             # Table definitions, field types, permissions
    ├── records-api/        # CRUD operations, batch, filtering
    ├── pages/              # Routes, layouts, blocks, SEO
    ├── theming/            # Design tokens, responsive, animations
    ├── internationalization/  # Multi-language support
    ├── cli/                # Server start, static build
    └── migrations/         # Schema evolution, versioning
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
