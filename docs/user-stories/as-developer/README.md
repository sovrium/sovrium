# Developer User Stories

> User stories for developers building applications with Sovrium.

## Persona

**Role**: Developer
**Description**: Technical builders who create, configure, and deploy Sovrium applications
**Goals**:

- Build data-driven applications without complex backend development
- Configure authentication, data models, and permissions declaratively
- Deploy applications with minimal operational overhead

## Feature Areas

| Area                                                | Description                                                | Stories |
| --------------------------------------------------- | ---------------------------------------------------------- | ------- |
| [**Authentication**](./authentication/)             | User sign-up, sign-in, 2FA, sessions, admin management     | 7 files |
| [**Tables**](./tables/)                             | Table definitions, field types, relationships, permissions | 6 files |
| [**Records API**](./records-api/)                   | CRUD operations, batch processing, filtering, soft-delete  | 5 files |
| [**Activity API**](./activity-api/)                 | Activity logging, audit trail, rate limiting               | 1 file  |
| [**Pages**](./pages/)                               | Routes, layouts, scripts, common schemas, SEO metadata     | 6 files |
| [**Theming**](./theming/)                           | Design tokens, responsive design, animations               | 3 files |
| [**Internationalization**](./internationalization/) | Multi-language application support                         | 1 file  |
| [**CLI**](./cli/)                                   | Server commands, static site generation                    | 2 files |
| [**Migrations**](./migrations/)                     | Schema evolution, migration versioning                     | 2 files |

## Quick Links

### Authentication

- [Email & Password Auth](./authentication/email-password-auth.md) - Sign-up and sign-in flows
- [Two-Factor Auth](./authentication/two-factor-auth.md) - TOTP-based 2FA
- [Magic Link Auth](./authentication/magic-link-auth.md) - Passwordless email links
- [Password Recovery](./authentication/password-recovery.md) - Reset and change password
- [Session Management](./authentication/session-management.md) - Sessions, sign-out, revocation
- [Admin User Management](./authentication/admin-user-management.md) - Admin CRUD, ban, impersonate
- [Admin Bootstrap](./authentication/admin-bootstrap.md) - Automatic admin account on first startup

### Tables

- [Creating Tables](./tables/creating-tables.md) - Define tables and basic configuration
- [Field Types](./tables/field-types.md) - All 45+ field types (text, number, email, etc.)
- [Relationships](./tables/relationships.md) - Linked records, lookups, rollups
- [Permissions](./tables/permissions.md) - RBAC, field-level, record-level access
- [Views](./tables/views.md) - Filtered and sorted views
- [Unique Constraints](./tables/unique-constraints.md) - Composite unique indexes

### Records API

- [CRUD Operations](./records-api/crud-operations.md) - Create, read, update, delete
- [Batch Operations](./records-api/batch-operations.md) - Bulk create, update, delete
- [Filtering & Sorting](./records-api/filtering-sorting.md) - Query parameters
- [Soft Delete & Restore](./records-api/soft-delete-restore.md) - Trash and recovery
- [Record History](./records-api/record-history.md) - Audit trail, comments

### Pages

- [Creating Pages](./pages/creating-pages.md) - Routes, layouts, layout components (sidebar, footer, banner)
- [Page Blocks](./pages/page-blocks.md) - Content blocks
- [Navigation](./pages/navigation.md) - Menus, links, routing
- [SEO Meta](./pages/seo-meta.md) - Title, description, OpenGraph, structured data types
- [Client-Side Scripts](./pages/scripts.md) - Feature flags, external/inline scripts
- [Common Schemas](./pages/common-schemas.md) - Primitive definitions, props, responsive, variables

### Theming

- [Design Tokens](./theming/design-tokens.md) - Colors, fonts, spacing
- [Responsive Design](./theming/responsive-design.md) - Breakpoints, mobile-first
- [Animations](./theming/animations.md) - Transitions, keyframes

### Internationalization

- [Multi-Language Apps](./internationalization/multi-language-apps.md) - i18n configuration

### CLI

- [Starting Server](./cli/starting-server.md) - `sovrium start` command
- [Building Static](./cli/building-static.md) - `sovrium build` command

### Activity API

- [Activity Logging](./activity-api/activity-logging.md) - List activity, details, rate limiting

### Migrations

- [Schema Evolution](./migrations/schema-evolution.md) - Adding/removing/modifying fields
- [Migration System](./migrations/migration-system.md) - Versioning, rollback, audit
