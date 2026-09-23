# Quick Start

> From an empty file to a running app — in YAML driven by the CLI, or in TypeScript with full type safety.

This guide takes you from an empty file to a running Sovrium app. Pick the approach that fits your workflow: a YAML file driven by the CLI, or a TypeScript project for full type safety.

## Option A — YAML and the CLI

The simplest path. Install the binary, write a YAML config, and start the server.

**1. Install the CLI.** Homebrew, Docker and Scoop are also available; see **Installation**.

```bash
curl -fsSL https://sovrium.com/install | sh
```

**2. Create a config file.** The simplest valid configuration is just a name.

```yaml
name: my-app
```

**3. Add data tables.** Define your data models with typed fields, options and validation.

```yaml
name: my-app

tables:
  - id: 1
    name: tasks
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: status
        type: single-select
        options: [To Do, In Progress, Done]
```

**4. Start the server.** Run it and visit `http://localhost:3000`.

```bash
sovrium start app.yaml
```

Start small with just tables. Then progressively add design, auth, pages and analytics as your needs grow.

## Option B — TypeScript

Prefer type safety? Author the config in TypeScript with full autocompletion, then run it with the same CLI.

**1. Write the type definitions.** Run this in your project directory. It writes `sovrium.d.ts` and a `tsconfig.json` from the types embedded in the binary. There is no `package.json`, no `node_modules` and nothing to install.

```bash
sovrium types
```

**2. Create `app.ts`.** Export the config as the default export, checked with `satisfies`, starting with just a name. The import carries only the type, so nothing has to resolve at run time.

```typescript
import type { AppConfig } from 'sovrium'

export default {
  name: 'my-app',
} satisfies AppConfig
```

**3. Add data tables.** Extend the configuration with typed fields, options and validation, with full autocompletion.

```typescript
import type { AppConfig } from 'sovrium'

export default {
  name: 'my-app',
  tables: [
    {
      id: 1,
      name: 'tasks',
      fields: [
        { id: 1, name: 'title', type: 'single-line-text', required: true },
        {
          id: 2,
          name: 'status',
          type: 'single-select',
          options: ['To Do', 'In Progress', 'Done'],
        },
      ],
    },
  ],
} satisfies AppConfig
```

**4. Start the server.** Run the same CLI against your `app.ts` and visit `http://localhost:3000`.

```bash
sovrium start app.ts
```

You get autocompletion for every property and type errors on field types as you write, without adding a single dependency to the project. `sovrium init --typescript` scaffolds all three files at once. See **TypeScript Configs**.

## What next?

Now that your app is running, explore the reference to add more capabilities:

- **Core Concepts** — the anatomy of a Sovrium app.
- **Schema Overview** — every root property explained.
- **Tables Overview** — field types, permissions and indexes.
- **Theme** — colours, fonts, spacing and design tokens.
- **Pages Overview** — the component types server-rendered pages are built from.
