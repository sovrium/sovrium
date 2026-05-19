# Sovrium Example Configurations

Example YAML configuration files for Sovrium applications. Use these as starting points or references when building your own app.

## Examples

| File                  | Description                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **hello-world.yaml**  | Minimal starter config. Just a name, version, and one page. Default template for `sovrium init`.          |
| **landing-page.yaml** | Full bilingual marketing page with i18n, theme customization, reusable components, and multiple sections. |
| **crud-app.yaml**     | CRUD application with tables (contacts, companies), email/password auth, theme, and a dashboard page.     |
| **api-only.yaml**     | Headless API mode with tables (projects, tasks) and auth. No pages -- API endpoints only.                 |

## Quick Start

### Create a new project

```bash
# Default (uses hello-world template)
sovrium init my-app

# Choose a specific template
sovrium init my-app --template crud-app
sovrium init my-app --template landing-page
sovrium init my-app --template api-only
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
