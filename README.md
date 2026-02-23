<h3 align="center">Build business apps with config. Own your data forever.</h3>

<p align="center">
  The open-source alternative to Airtable, Retool, and Notion.<br />
  Self-hosted. Configuration-driven. No vendor lock-in.
</p>

<p align="center">
  <a href="https://github.com/sovrium/sovrium/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" /></a>
  <a href="SPEC-PROGRESS.md"><img src="https://img.shields.io/badge/specs-99%25_passing-brightgreen" alt="Specs" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun_1.3-f472b6" alt="Bun" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.9-3178c6" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="VISION.md">Vision</a> &middot;
  <a href="SPEC-PROGRESS.md">Roadmap</a> &middot;
  <a href="CLAUDE.md">Docs</a> &middot;
  <a href="https://github.com/sovrium/sovrium/issues">Issues</a>
</p>

---

## What is Sovrium?

Sovrium turns **configuration files** into full-featured web applications -- database, auth, API, and UI included.

No code generation. No external services. Just config and `sovrium start`.

**Choose your format** -- YAML for readability, TypeScript for type safety:

```yaml
# sovrium.yaml
name: my-crm

tables:
  - id: 1
    name: contacts
    fields:
      - id: 1
        name: email
        type: email
      - id: 2
        name: name
        type: single-line-text
      - id: 3
        name: company
        type: single-line-text

auth:
  emailAndPassword: true

pages:
  - name: home
    path: /
    sections:
      - type: h1
        content: Welcome to My CRM
```

<details>
<summary>Or use TypeScript for IDE completion</summary>

```typescript
// app.ts
import { start } from 'sovrium'

await start({
  name: 'my-crm',
  tables: [
    {
      id: 1,
      name: 'contacts',
      fields: [
        { id: 1, name: 'email', type: 'email' },
        { id: 2, name: 'name', type: 'single-line-text' },
        { id: 3, name: 'company', type: 'single-line-text' },
      ],
    },
  ],
  auth: { emailAndPassword: true },
  pages: [
    {
      name: 'home',
      path: '/',
      sections: [{ type: 'h1', content: 'Welcome to My CRM' }],
    },
  ],
})
```

</details>

```bash
sovrium start sovrium.yaml   # Run with YAML
bun run app.ts               # Or run with TypeScript
# -> http://localhost:3000
```

---

## Why Sovrium?

**The problem**: Organizations pay $10k+/month for 20+ SaaS tools, with data scattered everywhere and zero control.

**The solution**: One self-hosted platform that does what you need, configured in files you own.

|                     |     Sovrium     |  SaaS Tools  |
| ------------------- | :-------------: | :----------: |
| **Data ownership**  |  Your servers   | Vendor cloud |
| **Monthly cost**    | $0 (infra only) | $20-50/user  |
| **Vendor lock-in**  |      None       |   Complete   |
| **Customization**   |    Unlimited    |   Limited    |
| **Version control** |   Git-native    |     None     |

---

## Quick Start

**Requirements**: [Bun](https://bun.sh) 1.3+ and [PostgreSQL](https://www.postgresql.org/) 15+

```bash
# Install
bun add sovrium

# Create config
cat > sovrium.yaml << EOF
name: my-app
pages:
  - name: home
    path: /
    sections:
      - type: h1
        content: Hello World
EOF

# Run
sovrium start sovrium.yaml

# Or use environment variable (JSON, YAML, or URL)
APP_SCHEMA='{"name":"my-app"}' sovrium start
APP_SCHEMA='name: my-app' sovrium start
APP_SCHEMA='https://example.com/app.yaml' sovrium start
```

---

## Features

### Database & Tables

Define your data model in config. Sovrium creates PostgreSQL tables, handles migrations, and exposes a full REST API automatically.

- **44+ field types** -- text, numeric, date/time, selection, media, relational, user tracking, and advanced types (formula, JSON, geolocation, barcode, autonumber, and more)
- **Relationships** -- one-to-many and many-to-many with lookup and rollup fields
- **Views** -- filtered, sorted, and grouped views with field-level visibility
- **Indexes and constraints** -- primary keys, unique constraints, check constraints
- **Soft delete** -- built-in trash with restore capability
- **Permissions** -- role-based table and field-level access control
- **Schema evolution** -- migration system for safe schema changes

### REST API

Every table gets a full CRUD API with no additional code.

- **Records** -- create, read, update, delete with field validation
- **Batch operations** -- bulk create, update, and upsert
- **Filtering and sorting** -- query records with field-based filters
- **Pagination** -- cursor and offset-based pagination
- **Activity logs** -- audit trail for all record changes
- **Rate limiting** -- configurable per-endpoint rate limits

### Authentication

Production-ready auth out of the box.

- **Email/password** -- sign up, sign in, email verification, password reset
- **Magic link** -- passwordless email authentication
- **Two-factor** -- TOTP-based 2FA
- **OAuth** -- social login providers
- **Roles** -- admin, member, viewer with custom roles
- **Admin plugin** -- user management, banning, impersonation
- **Session management** -- list, revoke, and manage active sessions

### Pages & UI

Server-rendered pages with a component-based system.

- **Dynamic routing** -- path-based page routing
- **Sections** -- composable content sections with theming support
- **Reusable components** -- define once with `$ref`, customize with `$vars`
- **SEO metadata** -- title, description, Open Graph, structured data
- **Scripts** -- custom head and body scripts per page

### Theming

Design system configuration for consistent styling.

- **Colors** -- primary, secondary, accent, and semantic color tokens
- **Fonts** -- custom font families with Google Fonts support
- **Spacing, shadows, border-radius** -- design tokens applied globally
- **Animations** -- configurable keyframe animations
- **Breakpoints** -- responsive design breakpoints

### Internationalization

Multi-language support built in.

- **Language configuration** -- define supported languages and default
- **Translation tokens** -- `$t:` syntax for referencing translations in pages
- **Browser detection** -- automatic language detection
- **Persistence** -- remember user language preference

### CLI

- `sovrium start` -- run the application from a config file
- `sovrium build` -- generate a static site from config
- Supports YAML, JSON, and TypeScript config files

---

## Architecture

```
Config File (YAML/JSON/TS)
    |
    v
Effect Schema (validation)
    |
    v
Sovrium Runtime
    |
    +---> PostgreSQL (tables, records, migrations)
    +---> Hono (REST API + SSR)
    +---> Better Auth (sessions, OAuth, 2FA)
    +---> React + Tailwind (server-rendered UI)
```

### Stack

|                                           |                |
| :---------------------------------------- | :------------- |
| [Bun](https://bun.sh)                     | Runtime        |
| [Hono](https://hono.dev)                  | Web framework  |
| [Drizzle](https://orm.drizzle.team)       | Database ORM   |
| [Effect](https://effect.website)          | Type-safe FP   |
| [React 19](https://react.dev)             | UI (SSR)       |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling        |
| [Better Auth](https://better-auth.com)    | Authentication |

### Project Structure

```
src/
  domain/          # Business logic, Effect Schema models
    models/app/    # App configuration schema (tables, auth, pages, theme, ...)
    models/api/    # API contracts (Zod schemas for OpenAPI)
  application/     # Use cases, Effect programs
  infrastructure/  # Database, auth, CSS compiler, email, logging
  presentation/    # API routes, CLI, React components, styling
specs/             # 2,200+ E2E tests (Playwright)
docs/              # Architecture and infrastructure documentation
```

---

## Status

**Sovrium is under active development.**

The specification and testing phase is nearly complete: **2,270 out of 2,283 E2E tests are passing** across 225 spec files, covering 272 user stories with 2,394 acceptance criteria. A TDD automation pipeline handles test implementation, averaging 15+ specs fixed per day.

| Domain     | Spec Files | Tests | Status |
| ---------- | ---------: | ----: | ------ |
| API        |         67 |   627 | 100%   |
| App Schema |        131 | 1,398 | 99%    |
| CLI        |          9 |   108 | 100%   |
| Migrations |         17 |   139 | 100%   |
| Templates  |          1 |    11 | 100%   |

Track progress in detail: [SPEC-PROGRESS.md](SPEC-PROGRESS.md)

---

## Development

```bash
bun install                   # Install dependencies
bun run start                 # Run application
bun run quality --skip-e2e    # Lint, format, typecheck, unit tests
bun test:unit                 # Unit tests only
bun test:e2e:regression       # E2E regression tests
bun run progress              # Spec analysis and progress report
```

---

## Contributing

We welcome contributions! See [CLAUDE.md](CLAUDE.md) for coding standards and architecture details.

```bash
git clone https://github.com/sovrium/sovrium
cd sovrium && bun install
```

---

## License

[BSL-1.1](LICENSE.md) -- Free for internal and non-commercial use. Becomes Apache 2.0 on January 1, 2029.

---

<p align="center">
  <sub><strong>Own your data. Own your tools. Own your future.</strong></sub>
</p>

<p align="center">
  <sub>&copy; 2025 ESSENTIAL SERVICES &middot; <a href="TRADEMARK.md">Trademark</a></sub>
</p>
