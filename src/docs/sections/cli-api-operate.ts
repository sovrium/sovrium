/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import backupBody from '@/cli/commands/backup.docs.md' with { type: 'file' }
import bundleBody from '@/cli/commands/bundle.docs.md' with { type: 'file' }
import cliAdminBody from '@/cli/commands/cli-admin.docs.md' with { type: 'file' }
import clientBody from '@/cli/commands/client.docs.md' with { type: 'file' }
import deployBody from '@/cli/commands/deploy.docs.md' with { type: 'file' }
import envBody from '@/cli/commands/env.docs.md' with { type: 'file' }
import initFromBundleBody from '@/cli/commands/init/from-bundle.docs.md' with { type: 'file' }
import initFromUrlBody from '@/cli/commands/init/from-url.docs.md' with { type: 'file' }
import loginBody from '@/cli/commands/login.docs.md' with { type: 'file' }
import previewBody from '@/cli/commands/preview.docs.md' with { type: 'file' }
import reindexBody from '@/cli/commands/reindex.docs.md' with { type: 'file' }
import usageBody from '@/cli/commands/usage.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The operating commands, as articles of the CLI section.
 *
 * Administering a deployment, backing it up, bundling it (and opening a bundle
 * or a published config back as a project), shipping it to a cloud and writing a typed client for it live in their own module
 * rather than in `cli-api.ts` because that file reached its line ceiling. They stay part of the CLI section, in their
 * published order, and the section assembles them by spread — the same split
 * `fields-derived.ts` makes for the Fields section.
 */
export const operateCliArticles: readonly DocArticle[] = [
  defineArticle({
    slug: 'cli-client',
    title: 'Call the API from Your Own Front-End',
    description:
      'Write one typed, dependency-free TypeScript client for the records API with sovrium client, and call your app from a React site, a mobile app or a script.',
    keywords: [
      'sovrium client',
      'typed client',
      'front-end',
      'fetch',
      'SDK',
      'records API',
      'SOVRIUM_CORS_ORIGINS',
      'x-api-key',
      '--check',
    ],
    order: 1423,
    sidebarLabel: 'Typed API Client',
    body: clientBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-CLIENT'],
  }),
  defineArticle({
    slug: 'cli-reindex',
    title: 'Rebuilding the AI Knowledge Index',
    description:
      'Re-embed the knowledge documents and agent knowledge tables from the command line with sovrium reindex, on an app with or without auth.',
    keywords: [
      'sovrium reindex',
      'knowledge index',
      'RAG',
      'embeddings',
      'AI_KNOWLEDGE_DIR',
      'rebuild',
    ],
    order: 1426,
    sidebarLabel: 'Rebuilding the AI Index',
    body: reindexBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-REINDEX'],
  }),
  defineArticle({
    slug: 'cli-admin',
    title: 'Admin & Maintenance',
    description:
      'Operate a deployment from the CLI: create the first admin and reset its password, generate secrets, adopt an existing encryption key, keep the binary current.',
    keywords: [
      'sovrium admin create',
      'sovrium admin reset-password',
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
    slug: 'backup-restore',
    title: 'Back Up and Restore',
    description:
      'Write the database, the encryption key, the config tree and the uploads into one archive with sovrium backup, and put it back with sovrium restore.',
    keywords: [
      'sovrium backup',
      'sovrium restore',
      'backup',
      'restore',
      'pg_dump',
      'encryption-key',
      '--data-dir',
      '--force',
    ],
    order: 1435,
    sidebarLabel: 'Back Up & Restore',
    body: backupBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-BACKUP-RESTORE'],
  }),
  defineArticle({
    slug: 'usage',
    title: 'Measure an Install',
    description:
      'Print how many bytes an install holds with sovrium usage: the database with its write-ahead log or its PostgreSQL size, and the stored files. Changes nothing.',
    keywords: [
      'sovrium usage',
      'usage',
      'database size',
      'storage size',
      'pg_database_size',
      '--json',
      '--report',
    ],
    order: 1436,
    sidebarLabel: 'Measure an Install',
    body: usageBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-USAGE'],
  }),
  defineArticle({
    slug: 'bundle',
    title: 'Bundle an App',
    description:
      'Package an app for deployment with sovrium bundle: the config resolved and validated into JSON, static files and seed data, each checksummed in one archive.',
    keywords: [
      'sovrium bundle',
      'bundle',
      'deploy',
      'deployment archive',
      'manifest.json',
      'project/app.json',
      'sha256',
      '--output',
    ],
    order: 1437,
    sidebarLabel: 'Bundle',
    body: bundleBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-BUNDLE'],
  }),
  defineArticle({
    slug: 'cli-init-from-bundle',
    title: 'Opening a Bundle',
    description:
      'Turn a sovrium bundle archive back into an editable project, from a link, a file: URL or a path, checked end to end before a single file is written.',
    keywords: [
      'sovrium init --from-bundle',
      'bundle',
      'starter',
      'import a project',
      'verified publisher',
      '--inspect',
      '--expect-sha256',
      '--with-demo-data',
    ],
    order: 1421,
    sidebarLabel: 'Opening a Bundle',
    body: initFromBundleBody,
    documents: [],
    stories: [],
  }),
  defineArticle({
    slug: 'cli-init-from-url',
    title: 'Forking a Published Config',
    description:
      'Create a project from one YAML or JSON config published over HTTPS: fetched once, checked before a single file is written, and recorded with where it came from.',
    keywords: [
      'sovrium init --from-url',
      'fork',
      'published config',
      '.sovrium-template.json',
      'provenance',
      'redirects',
      '--inspect',
      '--expect-sha256',
    ],
    order: 1420.5,
    sidebarLabel: 'Forking a Config',
    body: initFromUrlBody,
    documents: [],
    stories: [],
  }),
  defineArticle({
    slug: 'login',
    title: 'Sign In to a Sovrium Cloud',
    description:
      'Sign the CLI in with sovrium login: approve a short code in the browser and keep an API key here for sovrium deploy, or paste a key, check it and sign out.',
    keywords: [
      'sovrium login',
      'sign in',
      'device code',
      'API key',
      'credentials.json',
      '--api-key',
      '--status',
      '--logout',
    ],
    order: 1438,
    sidebarLabel: 'Sign In',
    body: loginBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-LOGIN'],
  }),
  defineArticle({
    slug: 'deploy',
    title: 'Deploy to a Sovrium Cloud',
    description:
      'Ship an app with sovrium deploy: the app found or created by name, its required variables checked, the bundle uploaded once, each state printed until it is up.',
    keywords: [
      'sovrium deploy',
      'deploy',
      'deployment',
      'Sovrium Cloud',
      'Idempotency-Key',
      '--app',
      '--no-wait',
      '--yes',
      '--env',
      'waking up',
      '.sovrium/cloud.json',
      'requiredEnv',
      '--seed',
      'sovrium seed --app',
      '--from-preview',
    ],
    order: 1439,
    sidebarLabel: 'Deploy',
    body: deployBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-DEPLOY', 'US-CLI-COMMANDS-SEED-REMOTE'],
  }),
  defineArticle({
    slug: 'cloud-env',
    title: "A Hosted App's Variables",
    description:
      "Set, list and remove an app's environment variables on Sovrium Cloud with sovrium env: from a file, names only, secret by default, never a value printed.",
    keywords: [
      'sovrium env',
      'sovrium env push',
      'sovrium env list',
      'sovrium env unset',
      'environment variables',
      'secrets',
      '--overwrite',
      '--plain',
      '--redeploy',
    ],
    order: 1441,
    sidebarLabel: 'Cloud variables',
    body: envBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-ENV'],
  }),
  defineArticle({
    slug: 'preview',
    title: 'Share a Preview',
    description:
      'Put a change online with sovrium preview, at its own share address until it expires, while the live app stays as it is; promote it with deploy --from-preview.',
    keywords: [
      'sovrium preview',
      'preview',
      'share',
      'share address',
      'feedback',
      'Expires',
      '--from-preview',
      'sovrium deploy --from-preview',
      '--app',
      '--no-wait',
      '--env',
    ],
    order: 1442,
    sidebarLabel: 'Preview',
    body: previewBody,
    documents: [],
    stories: ['US-CLI-COMMANDS-PREVIEW'],
  }),
]
