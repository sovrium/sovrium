/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import cliFlagsBody from '@/cli/commands/cli-flags.docs.md' with { type: 'file' }
import cliLifecycleBody from '@/cli/commands/cli-lifecycle.docs.md' with { type: 'file' }
import cliMigrateBody from '@/cli/commands/cli-migrate.docs.md' with { type: 'file' }
import cliProjectBody from '@/cli/commands/cli-project.docs.md' with { type: 'file' }
import cliSeedBody from '@/cli/commands/cli-seed.docs.md' with { type: 'file' }
import cliBody from '@/cli/commands/cli.docs.md' with { type: 'file' }
import configSnapshotHistoryBody from '@/cli/commands/config-snapshot-history.docs.md' with { type: 'file' }
import devBody from '@/cli/commands/dev.docs.md' with { type: 'file' }
import { operateCliArticles } from './cli-api-operate'
import { defineArticle, defineSection } from './define'

/**
 * CLI & API — the section manifest.
 *
 * Why the articles are article-shaped rather than verb-shaped, and why
 * every `documents` list is empty:
 * `[internal ref]`, § `cli-api`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
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
        'Run and control a server with start, stop, restart and reload, which applies an edited config live, plus its lock file and the status file it publishes.',
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
        'US-CLI-STARTING-SERVER-DEGRADED-DATABASE',
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
      slug: 'cli-dev',
      title: 'The Dev Session',
      description:
        'Boot the app for development in one command: fresh seed data, a printed account to sign in with, the sign-in page opened, and a reload on every save.',
      keywords: [
        'sovrium dev',
        'dev mode',
        'development',
        'seed data',
        'fresh state',
        '--no-open',
        'SOVRIUM_DEV_MODE',
        'SOVRIUM_DEV_PASSWORD',
        '.sovrium/dev',
      ],
      order: 1412,
      sidebarLabel: 'Dev Session',
      body: devBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-DEV', 'US-CLI-COMMANDS-DEV-NOTICE'],
    }),
    defineArticle({
      slug: 'undo-and-reset',
      title: 'Undo and Reset',
      description:
        'The config history watch mode keeps: what lands in it, what is discarded, how to restore an entry, and the two controls the desktop app adds on top.',
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
      stories: [
        'US-CLI-SEEDING-DATA',
        'US-CLI-SEEDING-DATA-SCOPED-AND-REPEATED-RUNS',
        'US-CLI-SEEDING-INVITATIONS',
      ],
    }),
    ...operateCliArticles,
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
  ],
})
