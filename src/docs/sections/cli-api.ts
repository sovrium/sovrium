/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import cliAdminBody from '@/cli/commands/cli-admin.docs.md' with { type: 'file' }
import cliFlagsBody from '@/cli/commands/cli-flags.docs.md' with { type: 'file' }
import cliLifecycleBody from '@/cli/commands/cli-lifecycle.docs.md' with { type: 'file' }
import cliMigrateBody from '@/cli/commands/cli-migrate.docs.md' with { type: 'file' }
import cliProjectBody from '@/cli/commands/cli-project.docs.md' with { type: 'file' }
import cliSeedBody from '@/cli/commands/cli-seed.docs.md' with { type: 'file' }
import cliValidateBody from '@/cli/commands/cli-validate.docs.md' with { type: 'file' }
import cliBody from '@/cli/commands/cli.docs.md' with { type: 'file' }
import configSnapshotHistoryBody from '@/cli/commands/config-snapshot-history.docs.md' with { type: 'file' }
import docsBody from '@/cli/commands/docs.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * CLI & API — the section manifest.
 *
 * ─── ARTICLE-SHAPED, NOT VERB-SHAPED ───────────────────────────────────────
 *
 * Nine fragments for nineteen dispatch keys, and the mismatch is the design
 * rather than a shortfall. `stop`, `restart` and `reload` all find the running
 * process through one lock file and are unreadable apart; `schema` and
 * `design-system` are both offline exporters of a config. A file per verb
 * would split prose no reader wants split, and would put the lock file in
 * three places.
 *
 * So coverage here is of the VOCABULARY: `check-doc-coverage.ts` asks whether
 * some fragment NAMES `sovrium <verb>`, not whether a directory holds a file
 * for it. All nineteen keys are named, `--help` and `--version` included.
 *
 * ─── EVERY `documents` LIST IS EMPTY, AND THAT IS CORRECT ──────────────────
 *
 * The CLI surface is not `AppSchema`. Its options live in the flag allowlist
 * in `src/cli/runtime/dispatch.ts` and its help text in the string table in
 * `src/cli/runtime/command-help.ts` — neither of which the option walk can
 * address, because neither is a schema. There is no `sovrium:options`
 * directive that could render a command's flags today.
 *
 * Rather than transcribe those tables and create a second source of truth for
 * them, each fragment quotes the `Usage:` line, says what the options are FOR,
 * and sends the reader to `sovrium <command> --help` for the authoritative
 * list. `cli-flags` keeps one cross-command table, which is the one thing a
 * single `--help` cannot show. A `sovrium:help <verb>` directive reading
 * `COMMAND_HELP` would remove even that.
 *
 * ─── `docs` DOCUMENTS ITSELF ───────────────────────────────────────────────
 *
 * The last article describes the verb that prints this manual, and absorbs
 * what the published LLM-reference page was for. It was written before the
 * verb exists — the prose is what the command will print about itself, and
 * `.docs-cli-ignore` carries a temporary row until it dispatches.
 */
export const section = defineSection({
  slug: 'cli-api',
  title: 'CLI',
  order: 1400,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'cli',
      title: 'CLI Overview',
      description:
        'What the binary does, where it reads configuration from, the command surface at a glance, and how watch mode reloads a running server.',
      keywords: [
        'sovrium',
        'CLI',
        'command line',
        'APP_SCHEMA',
        'APP_SCHEMA_FILE',
        'watch mode',
        'config resolution',
        'hot reload',
      ],
      order: 1400,
      sidebarLabel: 'CLI Overview',
      body: cliBody,
      documents: [],
      stories: [
        'US-CLI-COMMANDS-HELP',
        'US-CLI-COMMANDS-SCHEMA',
        'US-CLI-COMMANDS-SECRET',
        'US-CLI-COMMANDS-SEED',
        'US-CLI-COMMANDS-START',
        'US-CLI-COMMANDS-UPDATE',
        'US-CLI-COMMANDS-VERSION',
        'US-CLI-HELP-COMMAND',
        'US-CLI-SERVER-LOGGING-VERBOSITY',
        'US-CLI-STARTING-SERVER-WATCH-CONFIG-GRAPH',
      ],
    }),
    defineArticle({
      slug: 'cli-lifecycle',
      title: 'Lifecycle Commands',
      description:
        'Run and control a server — start, stop, restart and the zero-downtime reload — plus the lock file that ties the four together and the status file a running instance publishes about itself.',
      keywords: [
        'sovrium start',
        'sovrium stop',
        'sovrium restart',
        'sovrium reload',
        'lock file',
        'status.json',
        'status file',
        'SOVRIUM_LOCK_DIR',
        'SIGTERM',
        'zero downtime',
      ],
      order: 1410,
      sidebarLabel: 'Lifecycle',
      body: cliLifecycleBody,
      documents: [],
      stories: [
        'US-CLI-SERVER-MANAGEMENT',
        'US-CLI-SERVING-STATIC-ASSETS-REQUEST',
        'US-CLI-STARTING-SERVER-LEGACY-HOST-REDIRECT',
        'US-CLI-STARTING-SERVER-RUNTIME-MODES',
        'US-CLI-STARTING-SERVER-STATUS-FILE',
      ],
    }),
    defineArticle({
      slug: 'cli-project',
      title: 'Project Commands',
      description:
        'Scaffold a project, build it to static files, print its schema, check a config before you ship it, and write the types for a TypeScript config.',
      keywords: [
        'sovrium init',
        'sovrium build',
        'sovrium schema',
        'sovrium validate',
        'sovrium types',
        'templates',
        'static site',
        'scaffold',
        '--from-url',
        '--git',
      ],
      order: 1420,
      sidebarLabel: 'Project Commands',
      body: cliProjectBody,
      documents: [],
      stories: [
        'US-CLI-BUILDING-STATIC',
        'US-CLI-CODE-EXAMPLES',
        'US-CLI-COMMANDS-BUILD',
        'US-CLI-COMMANDS-INIT',
        'US-CLI-COMMANDS-INIT-TEMPLATE-BUNDLE',
        'US-CLI-COMMANDS-VALIDATE',
        'US-CLI-INIT-COMMAND',
        'US-CLI-SERVING-STATIC-ASSETS-LLMS',
        'US-CLI-SERVING-STATIC-ASSETS-PRECEDENCE',
        'US-CLI-SERVING-STATIC-ASSETS-SEO',
      ],
    }),
    defineArticle({
      slug: 'undo-and-reset',
      title: 'Undo and Reset',
      description:
        'The config history watch mode keeps for you — what lands in it, what is discarded, how to restore an entry, and the two controls the desktop app puts on top of it.',
      keywords: [
        'undo',
        'config history',
        'config snapshot',
        'reset to template',
        'restore a config',
        'sovrium start --watch',
      ],
      order: 1415,
      sidebarLabel: 'Undo and Reset',
      body: configSnapshotHistoryBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'cli-migrate',
      title: 'Migrating a Database',
      description:
        'Bring a database’s schema forward without booting the app, with `--dry-run` to preview and `--check` as a pre-flight.',
      keywords: [
        'sovrium migrate',
        'database migration',
        'schema migration',
        'dry run',
        'pre-flight check',
        'release phase',
        'DATABASE_URL',
      ],
      order: 1422,
      sidebarLabel: 'Migrating a Database',
      body: cliMigrateBody,
      documents: [],
      stories: ['US-CLI-MIGRATE-COMMAND', 'US-CLI-SCHEMA-EXPORT'],
    }),
    defineArticle({
      slug: 'cli-seed',
      title: 'Seeding Data',
      description:
        'Load relational sample data from files — natural keys for the links, relative dates that stay current, and three replay modes.',
      keywords: [
        'sovrium seed',
        'sample data',
        'seed data',
        'fixtures',
        'relational seeding',
        'mergeOn',
        'upsert',
        'replace',
      ],
      order: 1425,
      sidebarLabel: 'Seeding Data',
      body: cliSeedBody,
      documents: [],
      stories: ['US-CLI-SEEDING-DATA'],
    }),
    defineArticle({
      slug: 'cli-admin',
      title: 'Admin & Maintenance',
      description:
        'Operate a deployment from the CLI — provision the first admin account, generate cryptographic secrets, adopt an existing encryption key, and keep the binary current.',
      keywords: [
        'sovrium admin create',
        'sovrium secret generate',
        'sovrium secret adopt',
        'sovrium update',
        'SOVRIUM_INSTALL_METHOD',
        'AUTH_SECRET',
        'SOVRIUM_ENCRYPTION_KEY',
      ],
      order: 1430,
      sidebarLabel: 'Admin & Maintenance',
      body: cliAdminBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-ADMIN'],
    }),
    defineArticle({
      slug: 'cli-flags',
      title: 'Global Flags & Exit Codes',
      description:
        'Which command each flag belongs to, how an unknown one is rejected, the static-asset fallback, and what the two exit codes mean.',
      keywords: [
        'sovrium',
        'CLI flags',
        '--watch',
        '--output',
        '--template',
        '--publicDir',
        '--force',
        '--json',
        'exit codes',
        'unknown flag',
      ],
      order: 1440,
      sidebarLabel: 'Flags & Exit Codes',
      body: cliFlagsBody,
      documents: [],
      stories: [
        'US-CLI-CLI-FLAGS',
        'US-CLI-SERVER-LOGGING-STARTUP-OUTPUT',
        'US-CLI-SERVING-STATIC-ASSETS-CONFIG',
        'US-CLI-STARTING-SERVER-WATCH-DEV-EXPERIENCE',
        'US-CLI-TEMPLATE-CLAUDE-BUNDLE',
      ],
    }),
    defineArticle({
      slug: 'cli-validate',
      title: 'Validation & Schema Generation',
      description:
        'Checking a config without starting anything, its `--json` report for programs, emitting the JSON Schema that describes every config, and exporting the design system for an agent.',
      keywords: [
        'sovrium validate',
        'sovrium validate --json',
        'machine-readable validation',
        'sovrium schema',
        'sovrium design-system',
        'validateConfig',
        'JSON Schema',
        'config validation',
        'DTCG',
      ],
      order: 1480,
      sidebarLabel: 'Validation & Schema',
      body: cliValidateBody,
      documents: [],
      stories: [
        'US-CLI-CONFIG-VALIDATION',
        'US-CLI-DESIGN-SYSTEM',
        'US-CLI-STARTING-SERVER-CONFIG-SOURCES',
      ],
    }),
    defineArticle({
      slug: 'docs',
      title: 'Reading the Manual Offline',
      description:
        '`sovrium docs` prints this manual out of the binary — offline, with no config file, no database and no network — so what you read describes the engine you are running.',
      keywords: [
        'sovrium docs',
        'offline documentation',
        'llms.txt',
        'llms-full.txt',
        'AI agent',
        'machine-readable documentation',
        'determinism',
      ],
      order: 1490,
      sidebarLabel: 'Reading the Manual',
      body: docsBody,
      documents: [],
      stories: ['US-CLI-DOCS-COMMAND'],
    }),
  ],
})
