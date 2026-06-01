/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { Effect, Console } from 'effect'
import { ENV_EXAMPLE_CONTENT } from '@/cli/env-example-template'
import {
  embeddedAgentPath,
  embeddedExampleDir,
} from '@/infrastructure/assets/embedded-static-assets'

interface TemplateEntry {
  readonly example: string
  readonly agent?: string
}

const TEMPLATE_MAP: Readonly<Record<string, TemplateEntry>> = {
  'hello-world': { example: 'hello-world' },
  'landing-page': { example: 'landing-page', agent: 'website-editor.md' },
  'crud-app': { example: 'crud-app', agent: 'crud-editor.md' },
  'api-only': { example: 'api-only', agent: 'api-editor.md' },
  'member-portal': { example: 'member-portal', agent: 'portal-editor.md' },
  'mcp-server': { example: 'mcp-server', agent: 'mcp-editor.md' },
  blog: { example: 'blog', agent: 'blog-editor.md' },
  crud: { example: 'crud-app', agent: 'crud-editor.md' },
  api: { example: 'api-only', agent: 'api-editor.md' },
  landing: { example: 'landing-page', agent: 'website-editor.md' },
}

const WEB_FACING_EXAMPLE_NAMES: ReadonlySet<string> = new Set([
  'hello-world',
  'landing-page',
  'crud-app',
  'member-portal',
  'blog',
])

const sanitizeAppName = (dirName: string): string => {
  const sanitized = dirName
    .toLowerCase()
    .replace(/[^a-z0-9-._~]/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
  return sanitized.length > 0 ? sanitized : 'my-app'
}

const generateDefaultAppYaml = (appName: string): string =>
  [`name: ${sanitizeAppName(appName)}`, `description: A Sovrium application`, ''].join('\n')

const generateGitignore = (): string =>
  [
    '# Sovrium runtime data (SQLite database, server lock file, file uploads).',
    '# Relocatable via the SOVRIUM_DATA_DIR env var.',
    '.sovrium/',
    '',
    '# Environment variables (may contain secrets)',
    '.env',
    '.env.local',
    '',
  ].join('\n')

const writeGitignoreIfMissing = async (targetDir: string): Promise<boolean> => {
  const gitignorePath = join(targetDir, '.gitignore')
  if (await Bun.file(gitignorePath).exists()) return false
  await writeFile(gitignorePath, generateGitignore())
  return true
}

const PUBLIC_README_BODY = [
  '# `public/` — static-asset directory',
  '',
  'Files dropped here are served by `sovrium start` at their path relative to',
  'this directory: `public/logo.png` -> `/logo.png`. Same set is copied into the',
  'static output by `sovrium build`.',
  '',
  '## Three rules an author should know',
  '',
  '1. **Anchored to this `app.yaml`** — `./public` is resolved against the',
  "   directory containing `app.yaml`, NOT the shell's current working directory.",
  '   `cd elsewhere && sovrium start ./app.yaml` still serves the same files.',
  '   Override with `--publicDir <path>` or `SOVRIUM_PUBLIC_DIR=<path>`.',
  '   Disable entirely with `--no-publicDir` or `SOVRIUM_PUBLIC_DIR=none`.',
  '',
  '2. **Secret-file blocklist** — these path shapes return 404 even when the',
  '   file exists under `public/`, so an accidental commit cannot leak secrets:',
  '',
  '   - `.env`, `.env.local`, `.env.production`, any `.env.*`',
  '   - `.git/**`, `node_modules/**`, `.sovrium/**` (runtime data dir)',
  '   - `CLAUDE.md` (LLM operator instructions)',
  '   - `*.key`, `*.pem` (SSH / TLS private material)',
  '   - `*.sql`, `*.sqlite`, `*.sqlite-journal` (database dumps + files)',
  '',
  '   Symlinks whose realpath escapes this directory also return 404.',
  '',
  '3. **Routing precedence** — incoming requests are resolved in this order:',
  '',
  '   1. Dynamic SSR page (a route registered by your `pages:` config)',
  '   2. Built-in SEO route (`/sitemap.xml`, `/robots.txt` — generated live)',
  '   3. File under `public/` (this directory)',
  '   4. 404',
  '',
  '   A `public/sitemap.xml` is silently shadowed by the generated route — see',
  '   CLI-SERVE-STATIC-015. Drop SEO overrides into your `pages:` config instead.',
  '',
  '## Suggestions',
  '',
  '- Add `logo.svg`, `favicon.ico`, `og-image.png`, `manifest.webmanifest`,',
  '  product downloads, and any other binary assets you want served at the root.',
  '- Keep `index.html` out unless you really mean to override the framework',
  "  page at `/` — that's a fall-through, not a default, and it loses to any",
  '  page declared in your config.',
  '',
].join('\n')

const writePublicDirIfMissing = async (targetDir: string): Promise<readonly string[]> => {
  const publicDir = join(targetDir, 'public')
  await mkdir(publicDir, { recursive: true })

  const gitkeepPath = join(publicDir, '.gitkeep')
  const readmePath = join(publicDir, 'README.md')
  const [wroteGitkeep, wroteReadme] = await Promise.all([
    Bun.file(gitkeepPath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(gitkeepPath, '')
        return true
      }),
    Bun.file(readmePath)
      .exists()
      .then(async (exists) => {
        if (exists) return false
        await writeFile(readmePath, PUBLIC_README_BODY)
        return true
      }),
  ])
  return [...(wroteGitkeep ? [gitkeepPath] : []), ...(wroteReadme ? [readmePath] : [])]
}

const writeEnvExampleIfMissing = async (targetDir: string): Promise<boolean> => {
  const envExamplePath = join(targetDir, '.env.example')
  if (await Bun.file(envExamplePath).exists()) return false
  await writeFile(envExamplePath, ENV_EXAMPLE_CONTENT)
  return true
}

const CLAUDE_MD_BODY = [
  'A [Sovrium](https://sovrium.com) application — a self-hosted, **configuration-driven**',
  'platform. The entire app (data model, auth, pages, theme, i18n) is declared in one or more',
  'YAML config files (a single `app.yaml` to start, split via `$ref` as the app grows) and',
  'served by the `sovrium` runtime. There is no hand-written',
  'server or UI code to maintain.',
  '',
  '## How to work in this project (read first)',
  '',
  '- **Edit `app.yaml`, not application code.** Features are added declaratively by editing',
  '  the config, not by writing TypeScript/React/SQL. Prefer a schema change over new code.',
  '- **Validate before running:** `sovrium validate app.yaml` checks the config against the',
  '  schema and reports errors with paths. Always validate after editing.',
  '- **Start with the minimum, grow as needed.** The schema supports progressive complexity —',
  '  add tables, pages, auth, and theme incrementally.',
  '- **The authoritative contract is the schema itself:** run `sovrium schema` to print the',
  '  full JSON Schema (Draft-07) for `app.yaml`. When unsure about a property or field type,',
  '  consult the schema rather than guessing.',
  '',
  '## Commands',
  '',
  '```bash',
  'sovrium start app.yaml         # Run the app (dev server)',
  'sovrium start app.yaml --watch # Hot-reload on config changes',
  'sovrium validate app.yaml      # Validate the config against the schema',
  'sovrium schema                 # Print the full JSON Schema for app.yaml',
  'sovrium build app.yaml         # Build static output',
  '```',
  '',
  '## Scaling the config',
  '',
  'Start with a single `app.yaml`. As the app grows, split using `$ref`.',
  "The rule is **one purpose per file** — if you can't describe a file",
  "in one short sentence, it's mixing concerns and wants a split.",
  '',
  'The canonical layout is **one file per entity for collections, one file',
  'per singleton for scoped config**. Reach for it as soon as a collection',
  "has more than one member; don't pre-split a single-table or single-page app.",
  '',
  '```',
  'app.yaml                              # entry point — stays at the project root',
  'config/theme.yaml                     # singleton — all theming',
  'config/auth.yaml                      # singleton — auth config',
  'config/i18n.yaml                      # singleton — all i18n strings',
  'config/analytics.yaml                 # singleton — analytics',
  'config/tables/contacts.yaml           # one file per table',
  'config/tables/orders.yaml',
  'config/pages/landing.yaml             # one file per page',
  'config/pages/dashboard.yaml',
  'config/components/icon-badge.yaml     # one file per reusable component template',
  'config/automations/on-new-order.yaml  # one file per automation',
  'config/forms/contact-us.yaml          # one file per standalone form',
  'config/buckets/uploads.yaml           # one file per bucket',
  'config/connections/stripe.yaml        # one file per connection',
  'config/agents/support-bot.yaml        # one file per AI agent',
  'config/actions/send-slack.yaml        # one file per reusable action template',
  '```',
  '',
  "In `app.yaml`: `theme: { $ref: './config/theme.yaml' }`. Collections list",
  "their entities: `tables: [{ $ref: './config/tables/contacts.yaml' }, …]`.",
  'Paths resolve relative to the file containing the `$ref`.',
  '',
  '**Root keys fall into three shapes** — split accordingly:',
  '',
  '- **Collections** (`tables`, `pages`, `forms`, `components`, `connections`,',
  '  `actions`, `automations`, `agents`, `buckets`, `env`) → one file per entity',
  '  under `config/<collection>/`.',
  '- **Singletons** (`auth`, `theme`, `analytics`, `languages`, `scripts`) →',
  '  one file per singleton at `config/<singleton>.yaml`. Never split',
  '  these by sub-key.',
  '- **Scalars** (`name`, `version`, `description`) → stay inline in `app.yaml`.',
  '',
  '**When to start splitting** — once any collection has 2+ members, move that',
  'collection to per-entity files in the same authoring pass. Below that',
  'threshold (a single table, a single page) keep it inline — the indirection',
  "cost isn't worth it. A single logical entity past ~300 lines is itself a",
  "signal to split sub-concerns (e.g. a complex table's `fields` into a sidecar),",
  "but that's a secondary split, not the primary one.",
  '',
  'Note: reusable **component templates** are root entities (their own files);',
  'page-instance components stay inside the page file.',
  '',
  'Prefer YAML for readability; switch to a `.ts` config with `defineConfig()`',
  'from `@sovrium/types` if you want IDE autocompletion and compile-time',
  'type-checking.',
  '',
  '## The `app.yaml` schema',
  '',
  'Root properties include: `name`, `description`, `tables`, `auth`, `pages`, `theme`,',
  '`i18n`, `analytics`, `connections`, and `agents`. Highlights:',
  '',
  '- **`tables`** — your data model. Each table has `fields`; field `type` spans many',
  '  categories (text, number, date/time, select, relation, attachment, rich-text, code,',
  '  formula, AI-compute, …). The runtime generates the database, REST API, and CRUD UI.',
  '- **`auth`** — authentication (email/password, magic link, OAuth) plus role-based access',
  '  (`admin`, `member`, `viewer`) and field-level permissions.',
  '- **`pages`** — composed from many built-in component types (forms, tables, kanban,',
  '  calendar, charts, rich content, …). Server-rendered.',
  '- **`theme`** — colors, fonts, spacing, radii, shadows, animations, breakpoints.',
  '- **`i18n`** — multi-language content (RTL supported).',
  '',
  '## Runtime data',
  '',
  'On `sovrium start`, runtime artifacts are written under `.sovrium/` (git-ignored):',
  'the zero-config SQLite database (`database.db`), the server lock file, and local file',
  'storage. Set `DATABASE_URL` to use PostgreSQL instead. Relocate the whole folder with',
  'the `SOVRIUM_DATA_DIR` env var. Operator settings live in **environment variables**, not',
  'in `app.yaml`.',
  '',
  '## Documentation',
  '',
  '- Docs: https://sovrium.com/docs',
  '- LLM-oriented overview: https://sovrium.com/llms.txt',
  '- Local schema reference: `sovrium schema`',
  '',
].join('\n')

const generateClaudeMd = (appName: string): string => `# ${appName}\n\n${CLAUDE_MD_BODY}`

const writeScaffoldFiles = async (targetDir: string, appYamlContent: string): Promise<string> => {
  const targetPath = join(targetDir, 'app.yaml')
  const appName = basename(targetDir)
  await writeFile(targetPath, appYamlContent)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(appName))
  return targetPath
}

const resolveTemplate = (templateName: string): TemplateEntry => {
  const entry = TEMPLATE_MAP[templateName]
  if (entry === undefined) {
    Effect.runSync(
      Console.error(
        `Error: Unknown template "${templateName}" — does not exist\n\nAvailable templates: ` +
          Object.keys(TEMPLATE_MAP).join(', ')
      )
    )
    process.exit(1)
  }

  const tree = embeddedExampleDir(entry.example)
  if (Object.keys(tree).length === 0) {
    Effect.runSync(
      Console.error(`Error: Template directory has no embedded files: ${entry.example}`)
    )
    process.exit(1)
  }

  return entry
}

const writeOneTreeFile = async (
  srcEmbeddedPath: string,
  destAbsPath: string,
  clobber: boolean
): Promise<boolean> => {
  if (!clobber && (await Bun.file(destAbsPath).exists())) return false
  await mkdir(dirname(destAbsPath), { recursive: true })
  await Bun.write(destAbsPath, Bun.file(srcEmbeddedPath))
  return true
}

const copyExampleTree = async (
  templateName: string,
  targetDir: string,
  forceFlag: boolean
): Promise<readonly string[]> => {
  const tree = embeddedExampleDir(templateName)
  const relPaths = Object.keys(tree).toSorted()
  const written = await Promise.all(
    relPaths.map((relPath) => {
      const clobber = forceFlag && relPath === 'app.yaml'
      return writeOneTreeFile(tree[relPath]!, join(targetDir, relPath), clobber)
    })
  )
  return relPaths.filter((_, i) => written[i] === true)
}

export interface InitCommandOptions {
  readonly templateName?: string
  readonly outputDir?: string
  readonly positionalDir?: string
  readonly forceFlag?: boolean
  readonly skipAgent?: boolean
  readonly appName?: string
}

const installPairedAgent = async (
  entry: TemplateEntry,
  targetDir: string,
  skipAgent: boolean
): Promise<void> => {
  if (skipAgent || entry.agent === undefined) return

  const agentBasename = entry.agent.replace(/\.md$/, '')
  const sourcePath = embeddedAgentPath(agentBasename)
  if (sourcePath === undefined) {
    Effect.runSync(
      Console.error(`Warning: paired agent "${entry.agent}" not embedded — skipping agent install`)
    )
    return
  }

  const agentsDir = join(targetDir, '.claude', 'agents')
  await mkdir(agentsDir, { recursive: true })

  const destPath = join(agentsDir, entry.agent)
  await Bun.write(destPath, Bun.file(sourcePath))
  Effect.runSync(Console.log(`Installed agent ${destPath}`))
}

const scaffoldFromTemplate = async (
  templateName: string,
  targetDir: string,
  skipAgent: boolean,
  forceFlag: boolean
): Promise<void> => {
  const entry = resolveTemplate(templateName)
  const relPaths = await copyExampleTree(entry.example, targetDir, forceFlag)
  await writeFile(join(targetDir, 'CLAUDE.md'), generateClaudeMd(basename(targetDir)))
  Effect.runSync(
    Console.log(
      `Created ${targetDir}/ from template "${templateName}" (${relPaths.length} file${relPaths.length === 1 ? '' : 's'})`
    )
  )
  await installPairedAgent(entry, targetDir, skipAgent)
}

const scaffoldDefault = async (targetDir: string, appName: string | undefined): Promise<void> => {
  const createdPath = await writeScaffoldFiles(
    targetDir,
    generateDefaultAppYaml(appName || basename(targetDir))
  )
  Effect.runSync(Console.log(`Created ${createdPath}`))
}

const assertNoConflict = async (targetPath: string, forceFlag: boolean): Promise<void> => {
  if (forceFlag) return
  const exists = await Bun.file(targetPath).exists()
  if (!exists) return
  Effect.runSync(Console.error(`Error: ${targetPath} already exists (use --force to overwrite)`))
  process.exit(1)
}

export const handleInitCommand = async (options: InitCommandOptions = {}): Promise<void> => {
  const {
    templateName,
    outputDir,
    positionalDir,
    forceFlag = false,
    skipAgent = false,
    appName,
  } = options
  const targetDir = positionalDir || outputDir || process.cwd()

  await assertNoConflict(join(targetDir, 'app.yaml'), forceFlag)
  await mkdir(targetDir, { recursive: true })

  if (templateName) {
    await scaffoldFromTemplate(templateName, targetDir, skipAgent, forceFlag)
  } else {
    await scaffoldDefault(targetDir, appName)
  }

  const isWebFacing =
    templateName === undefined ||
    (() => {
      const entry = TEMPLATE_MAP[templateName]
      return entry !== undefined && WEB_FACING_EXAMPLE_NAMES.has(entry.example)
    })()
  await scaffoldSupportFiles(targetDir, isWebFacing)
}

const scaffoldSupportFiles = async (targetDir: string, isWebFacing: boolean): Promise<void> => {
  const wroteGitignore = await writeGitignoreIfMissing(targetDir)
  if (wroteGitignore) {
    Effect.runSync(Console.log(`Created ${join(targetDir, '.gitignore')}`))
  }

  const wroteEnvExample = await writeEnvExampleIfMissing(targetDir)
  if (wroteEnvExample) {
    Effect.runSync(Console.log(`Created ${join(targetDir, '.env.example')}`))
  }

  if (isWebFacing) {
    const publicCreated = await writePublicDirIfMissing(targetDir)
    publicCreated.forEach((path) => Effect.runSync(Console.log(`Created ${path}`)))
  }
}
