/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import backupBody from '@/cli/commands/backup.docs.md' with { type: 'file' }
import bundleBody from '@/cli/commands/bundle.docs.md' with { type: 'file' }
import cliAdminBody from '@/cli/commands/cli-admin.docs.md' with { type: 'file' }
import deployBody from '@/cli/commands/deploy.docs.md' with { type: 'file' }
import envBody from '@/cli/commands/env.docs.md' with { type: 'file' }
import loginBody from '@/cli/commands/login.docs.md' with { type: 'file' }
import { defineArticle } from './define'
import type { DocArticle } from './define'

/**
 * The operating commands, as articles of the CLI section.
 *
 * Administering a deployment, backing it up, bundling it and shipping it to a
 * cloud live in their own module rather than in `cli-api.ts` because that file
 * reached its line ceiling. They stay part of the CLI section, in their
 * published order, and the section assembles them by spread — the same split
 * `fields-derived.ts` makes for the Fields section.
 */
export const operateCliArticles: readonly DocArticle[] = [
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
    slug: 'bundle',
    title: 'Bundle an App',
    description:
      'Package an app for deployment with sovrium bundle: the config resolved and validated into JSON, the static files and the seed data, every entry checksummed in one archive.',
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
    slug: 'login',
    title: 'Sign In to a Sovrium Cloud',
    description:
      'Sign the CLI in with sovrium login: approve a short code in the browser and keep an API key on this machine for sovrium deploy, or paste a key, check it and sign out.',
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
      'Ship an app with sovrium deploy: the app found or created from the config name, its required variables checked, the bundle uploaded with an idempotency key, and every state printed until its address answers.',
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
      'Set, list and remove the environment variables of an app on a Sovrium Cloud with sovrium env: from a file you name, names only, secret by default, never a value printed.',
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
]
