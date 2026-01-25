<h3 align="center">Build business apps with config. Own your data forever.</h3>

<p align="center">
  The open-source alternative to Zapier, Airtable, Retool, and Notion.<br />
  Self-hosted. Configuration-driven. No vendor lock-in.
</p>

<p align="center">
  <a href="https://github.com/sovrium/sovrium/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" /></a>
  <a href="SPEC-PROGRESS.md"><img src="https://img.shields.io/badge/progress-90%25-blue" alt="Progress" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6" alt="Bun" /></a>
</p>

<p align="center">
  <a href="VISION.md">Vision</a> •
  <a href="SPEC-PROGRESS.md">Roadmap</a> •
  <a href="CLAUDE.md">Docs</a> •
  <a href="https://github.com/sovrium/sovrium/issues">Issues</a>
</p>

---

## What is Sovrium?

Sovrium turns **configuration files** into full-featured web applications—database, auth, API, and UI included.

No code generation. No external services. Just config and `sovrium start`.

**Choose your format**—YAML for readability, TypeScript for type safety:

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

pages:
  - name: home
    path: /
    sections:
      - type: h1
        content: Hello World
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
      ],
    },
  ],
  pages: [
    {
      name: 'home',
      path: '/',
      sections: [{ type: 'h1', content: 'Hello World' }],
    },
  ],
})
```

</details>

```bash
sovrium start sovrium.yaml   # Run with YAML
bun run app.ts               # Or run with TypeScript
# → http://localhost:3000
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

**Requirements**: [Bun](https://bun.sh) 1.3+

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

- ⚡ **Fast** — Bun runtime, zero compilation
- 🔧 **Config-driven** — YAML, JSON, or TypeScript—not drag-and-drop
- 🗄️ **Database included** — PostgreSQL with auto-generated schemas
- 🔐 **Auth built-in** — Sessions, OAuth, SSO ready
- 🎨 **React SSR** — Server-rendered UI with Tailwind
- 🛡️ **Type-safe** — Effect Schema validation
- 📦 **Self-hosted** — Your infra, your rules

---

## Stack

Built on proven open-source tools:

|                                        |                |
| :------------------------------------- | :------------- |
| [Bun](https://bun.sh)                  | Runtime        |
| [Hono](https://hono.dev)               | Web framework  |
| [Drizzle](https://orm.drizzle.team)    | Database ORM   |
| [Effect](https://effect.website)       | Type-safe FP   |
| [React](https://react.dev)             | UI             |
| [Better Auth](https://better-auth.com) | Authentication |

---

## Status

> ⚠️ **Early Development** — Sovrium is in Phase 0 (Foundation).

**Now**: Web server, React SSR, Tailwind CSS, config validation

**Next**: Dynamic routing, CRUD operations, admin dashboards, multi-tenancy

Track progress → [SPEC-PROGRESS.md](SPEC-PROGRESS.md)

---

## Development

```bash
bun install          # Install deps
bun run start        # Run app
bun run lint         # Lint
bun run typecheck    # Type check
bun test:unit        # Tests
```

---

## Contributing

We welcome contributions! See [CLAUDE.md](CLAUDE.md) for coding standards.

```bash
git clone https://github.com/sovrium/sovrium
cd sovrium && bun install
```

---

## License

[BSL-1.1](LICENSE.md) — Free for internal use. Becomes Apache 2.0 on January 1, 2029.

---

<p align="center">
  <sub><strong>Own your data. Own your tools. Own your future.</strong></sub>
</p>

<p align="center">
  <sub>© 2025 ESSENTIAL SERVICES · <a href="TRADEMARK.md">Trademark</a></sub>
</p>
