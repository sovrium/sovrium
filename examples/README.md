# Sovrium Example Configurations

Each example is a **directory** containing an `app.yaml` entry point plus a `config/` subtree split per the conventions documented in the scaffolded `CLAUDE.md` (one file per collection entity, one file per singleton, scalars stay inline). Use these as starting points or references when building your own app.

## Examples

| Template          | Paired editor agent | Description                                                                                                                                     |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **hello-world**   | _(none)_            | Minimal starter. One page, no collections. Default template for `sovrium init`. Stays a single `app.yaml` to demonstrate when not to pre-split. |
| **landing-page**  | website-editor      | Bilingual marketing site with i18n, theme, 5 reusable components, and the home page split out for size.                                         |
| **crud-app**      | crud-editor         | CRUD app with tables (contacts, companies), email/password auth, theme, and dashboard + sign-in pages.                                          |
| **api-only**      | api-editor          | Headless API mode with tables (projects, tasks) and auth. No pages.                                                                             |
| **member-portal** | portal-editor       | Public marketing pages + an auth-gated portal area with role-gated sections. Magic-link + password auth.                                        |
| **mcp-server**    | mcp-editor          | Headless MCP server exposing tables to an LLM client via per-entity `aiAccess`. No pages.                                                       |
| **blog**          | blog-editor         | Blog with posts (rich-text), tags, authors, and an index + dynamic `/blog/:slug` detail route.                                                  |

## Quick Start

### Create a new project

```bash
# Default (uses hello-world template, no paired agent)
sovrium init my-app

# Choose a template — also installs the paired editor agent into .claude/agents/
sovrium init my-app --template crud-app
sovrium init my-app --template landing-page
sovrium init my-app --template api-only
sovrium init my-app --template member-portal
sovrium init my-app --template mcp-server
sovrium init my-app --template blog

# Skip the paired agent install
sovrium init my-app --template crud-app --no-agent
```

### Run your app

```bash
# Start the development server
sovrium start app.yaml

# Validate your config without starting
sovrium validate app.yaml

# Print the JSON Schema for reference
sovrium schema
```

### Modify and iterate

Edit your YAML file and restart the server. Sovrium validates your config against the AppSchema on every start, so you get immediate feedback on errors.

## Schema Reference

Run `sovrium schema` to print the full JSON Schema, or see `src/domain/models/app/index.ts` for the Effect Schema source.

### Key sections

- **name** (required) -- App name (npm naming conventions)
- **version** -- SemVer version string
- **description** -- Single-line description
- **auth** -- Authentication strategies, roles, 2FA
- **tables** -- Data models with typed fields and relationships
- **theme** -- Colors, fonts, spacing, shadows, border radius
- **languages** -- i18n with translations and browser detection
- **components** -- Reusable UI component templates
- **pages** -- Server-rendered pages with sections and metadata

### Field types

Tables support these field types: `single-line-text`, `long-text`, `rich-text`, `email`, `phone-number`, `url`, `integer`, `decimal`, `currency`, `percentage`, `checkbox`, `single-select`, `multi-select`, `date`, `duration`, `single-attachment`, `multiple-attachments`, `relationship`, `lookup`, `rollup`, `formula`, `user`, `created-by`, `updated-by`, `created-at`, `updated-at`, `autonumber`, `barcode`, `color`, `geolocation`, `json`, `rating`, `progress`, `status`, `button`, `count`, `array`.
