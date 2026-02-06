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
| [**Authentication**](./authentication/)             | User sign-up, sign-in, 2FA, sessions, security enforcement | 5 files |
| [**Tables**](./tables/)                             | Table definitions, field types, relationships, permissions | 7 files |
| [**Records API**](./records-api/)                   | CRUD operations, batch processing, filtering, soft-delete  | 7 files |
| [**Pages**](./pages/)                               | Routes, layouts, scripts, common schemas, SEO metadata     | 7 files |
| [**Theming**](./theming/)                           | Design tokens, responsive design, animations               | 3 files |
| [**Internationalization**](./internationalization/) | Multi-language application support                         | 1 file  |
| [**CLI**](./cli/)                                   | Server commands, static site generation                    | 2 files |
| [**Migrations**](./migrations/)                     | Schema evolution, migration versioning                     | 2 files |
| [**App Schema**](./app-schema/)                     | Application metadata configuration                        | 1 file  |
| [**API**](./api/)                                   | Health check endpoint                                      | 1 file  |
| [**Templates**](./templates/)                       | Landing page templates                                     | 1 file  |

## Quick Links

### Authentication

- [Email & Password Auth](./authentication/email-password-auth.md) - Sign-up and sign-in flows
- [Two-Factor Auth](./authentication/two-factor-auth.md) - TOTP-based 2FA
- [Magic Link Auth](./authentication/magic-link-auth.md) - Passwordless email links
- [Password Recovery](./authentication/password-recovery.md) - Reset and change password
- [Session Management](./authentication/session-management.md) - Sessions, sign-out, revocation
- [Security Enforcement](./authentication/security-enforcement.md) - Rate limiting, disabled auth

> **Admin-related stories** (bootstrap, user management, impersonation) have been moved to [Business Admin User Stories](../as-business-admin/).

### Tables

- [Creating Tables](./tables/creating-tables.md) - Define tables and basic configuration
- [Field Types](./tables/field-types.md) - All 45+ field types (text, number, email, etc.)
- [Relationships](./tables/relationships.md) - Linked records, lookups, rollups
- [Permissions](./tables/permissions.md) - RBAC, field-level, record-level access
- [Views](./tables/views.md) - Filtered and sorted views
- [Unique Constraints](./tables/unique-constraints.md) - Composite unique indexes
- [Rate Limiting](./tables/rate-limiting.md) - Table endpoint rate limiting

### Records API

- [CRUD Operations](./records-api/crud-operations.md) - Create, read, update, delete
- [Batch Operations](./records-api/batch-operations.md) - Bulk create, update, delete
- [Filtering & Sorting](./records-api/filtering-sorting.md) - Query parameters
- [Soft Delete & Restore](./records-api/soft-delete-restore.md) - Trash and recovery
- [Record History](./records-api/record-history.md) - Audit trail, comments
- [Record Formatting](./records-api/record-formatting.md) - Response formatting
- [Upsert Records](./records-api/upsert-records.md) - Upsert operations

### Pages

- [Creating Pages](./pages/creating-pages.md) - Routes, layouts, layout components (sidebar, footer, banner)
- [Page Blocks](./pages/page-blocks.md) - Content blocks
- [Navigation](./pages/navigation.md) - Menus, links, routing
- [SEO Meta](./pages/seo-meta.md) - Title, description, OpenGraph, structured data types
- [Client-Side Scripts](./pages/scripts.md) - Feature flags, external/inline scripts
- [Common Schemas](./pages/common-schemas.md) - Primitive definitions, props, responsive, variables
- [Interactions](./pages/interactions.md) - Page interactions

### Theming

- [Design Tokens](./theming/design-tokens.md) - Colors, fonts, spacing
- [Responsive Design](./theming/responsive-design.md) - Breakpoints, mobile-first
- [Animations](./theming/animations.md) - Transitions, keyframes

### Internationalization

- [Multi-Language Apps](./internationalization/multi-language-apps.md) - i18n configuration

### CLI

- [Starting Server](./cli/starting-server.md) - `sovrium start` command
- [Building Static](./cli/building-static.md) - `sovrium build` command

### App Schema

- [App Metadata](./app-schema/app-metadata.md) - Application metadata configuration

### API

- [Health Check](./api/health-check.md) - Health check endpoint

### Templates

- [Landing Page](./templates/landing-page.md) - Landing page template

### Migrations

- [Schema Evolution](./migrations/schema-evolution.md) - Adding/removing/modifying fields
- [Migration System](./migrations/migration-system.md) - Versioning, rollback, audit
