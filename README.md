<p align="center">
  <h1 align="center">Sovrium</h1>
</p>

<h3 align="center">Build business apps with config. Own your data forever.</h3>

<p align="center">
  The open-source alternative to Airtable, Retool, and Notion.<br />
  Self-hosted. Configuration-driven. No vendor lock-in.
</p>

<p align="center">
  <a href="https://git.sovrium.com/sovrium/sovrium/src/branch/main/LICENSE.md"><img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun_1.3-f472b6" alt="Bun" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-6.0-3178c6" alt="TypeScript" /></a>
  <a href="https://www.npmjs.com/package/@sovrium/types"><img src="https://img.shields.io/npm/v/@sovrium/types?label=%40sovrium%2Ftypes" alt="@sovrium/types on npm" /></a>
</p>

<p align="center">
  <a href="https://sovrium.com">Website</a> &middot;
  <a href="VISION.md">Vision</a> &middot;
  <a href="SPEC-PROGRESS.md">Roadmap</a> &middot;
  <a href="https://sovrium.com/fr/docs">Docs</a> &middot;
  <a href="https://github.com/sovrium/sovrium/issues">Issues</a>
</p>

<!-- TODO: Add a product screenshot or demo GIF here (recommended: 1200x800px). -->

---

## What is Sovrium?

Sovrium turns a **configuration file** into a complete web application — database, authentication, API, and pages included.

No code generation. No external services. Write a config file, run one command, and your app is live.

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
  strategies:
    - type: emailAndPassword

pages:
  - name: home
    path: /
    sections:
      - type: h1
        content: Welcome to My CRM
```

```bash
sovrium start sovrium.yaml
# -> http://localhost:3000
```

<details>
<summary>Prefer TypeScript? Use it for autocompletion and type checking.</summary>

```typescript
// sovrium.config.ts
import { defineConfig } from '@sovrium/types'

export default defineConfig({
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
  auth: { strategies: [{ type: 'emailAndPassword' }] },
  pages: [
    {
      name: 'home',
      path: '/',
      sections: [{ type: 'h1', content: 'Welcome to My CRM' }],
    },
  ],
})
```

```bash
sovrium start sovrium.config.ts
# -> http://localhost:3000
```

</details>

---

## 🚀 Quick Start

**You need**: [PostgreSQL](https://www.postgresql.org/) 15+ (SQLite also supported for all-in-one deployments)

Install the standalone binary (no Node or Bun required):

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/sovrium/sovrium/main/scripts/install.sh | sh

# Homebrew
brew install sovrium/tap/sovrium

# Docker
docker pull ghcr.io/sovrium/sovrium:latest
```

Then run your app:

```bash
sovrium start sovrium.yaml
# -> http://localhost:3000
```

> The `sovrium` npm package is **deprecated**. Only [`@sovrium/types`](https://www.npmjs.com/package/@sovrium/types) is published — install it as a dev dependency for `defineConfig` autocompletion when using TypeScript configs.

---

## ✨ Features

|     | Feature            | What you get                                                                                                                            |
| :-- | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| 🗄️  | **Tables**         | 41 field types including formulas, lookups, and rollups. Views with filtering and sorting. Trash with restore. Granular access control. |
| 🔌  | **Automatic API**  | Every table gets its own API. Filter, sort, paginate, and track changes — no code needed.                                               |
| 🔐  | **Authentication** | Email/password, magic link, two-factor, social login. Built-in roles (admin, member, viewer) and user management.                       |
| 🖥️  | **Pages**          | Build pages from reusable sections. Define once, customize with variables. SEO-ready out of the box.                                    |
| 🎨  | **Theming**        | Colors, fonts, spacing, shadows, animations, and responsive breakpoints — all defined in your config file.                              |
| 🌐  | **Multi-language** | Built-in translation system with browser language detection and user preference memory.                                                 |
| 🤖  | **AI-native**      | Agents, chat, RAG pipelines, MCP integration, and automations — all configured declaratively alongside your data.                       |
| ⌨️  | **CLI**            | `sovrium start` to run your app. `sovrium build` to export a static site. Supports YAML, JSON, and TypeScript configs.                  |

---

## 💡 Why Sovrium?

Organizations pay **$10k+/month** for 20+ SaaS tools, with data scattered everywhere and zero control.

Sovrium is **one self-hosted platform** that does what you need, configured in files you own.

|                     |     Sovrium     |  SaaS Tools  |
| ------------------- | :-------------: | :----------: |
| **Data ownership**  |  Your servers   | Vendor cloud |
| **Monthly cost**    | $0 (infra only) | $20-50/user  |
| **Vendor lock-in**  |      None       |   Complete   |
| **Customization**   |    Unlimited    |   Limited    |
| **Version control** |   Git-native    |     None     |

---

## 📊 Status

Sovrium is under **active development**. The feature set — tables, API, authentication, pages, theming, i18n, automations, and AI — is defined across **799 user stories** and ~5,500 E2E specs, with **~48% implemented** via an automated TDD pipeline.

📋 [See the full roadmap →](SPEC-PROGRESS.md)

---

## 🤝 Contributing

Development and contributions happen at [git.sovrium.com](https://git.sovrium.com/sovrium/sovrium). The GitHub repository is a read-only mirror for npm releases.

```bash
git clone https://git.sovrium.com/sovrium/sovrium.git
cd sovrium && bun install
bun run start
```

📖 See [CLAUDE.md](CLAUDE.md) for coding standards and architecture details.

---

## 💬 Community & Support

- [Issues](https://git.sovrium.com/sovrium/sovrium/issues) — Bug reports and feature requests
- [Vision](VISION.md) — Where Sovrium is headed

---

<details>
<summary>🛠️ Built with</summary>
<br />

[Bun](https://bun.sh) · [Hono](https://hono.dev) · [Drizzle ORM](https://orm.drizzle.team) · [Effect](https://effect.website) · [React 19](https://react.dev) · [Tailwind CSS 4](https://tailwindcss.com) · [Better Auth](https://better-auth.com)

See [CLAUDE.md](CLAUDE.md) for the full architecture and project structure.

</details>

---

## 📄 License

[BSL-1.1](LICENSE.md) — Free for internal and non-commercial use. Automatically converts to **Apache 2.0** on January 1, 2029.

---

<p align="center">
  <strong>Own your data. Own your tools. Own your future.</strong>
</p>

<p align="center">
  <sub>&copy; 2025 ESSENTIAL SERVICES &middot; <a href="TRADEMARK.md">Trademark</a></sub>
</p>
