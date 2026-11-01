/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed [config] --baseline` — record, from the host, what the next
 * `app/seed` reset returns each kept account to.
 *
 * It seeds nothing. It records the current profile and sign-in methods of every
 * account a reset keeps — resolved exactly as a reset resolves them: the
 * accounts `seed/users.yaml` lists and the host's administrators — prints each
 * one with what it holds and never a secret, and exits 0. Without a
 * `seed/users.yaml` a reset keeps every account untouched, so there is nothing
 * to record: the command is refused, exit 1.
 *
 * A host act on purpose. On a public demo every act inside the app is open to
 * anyone holding the public password, so no endpoint, automation or console
 * button can move the baseline; only the operator of the machine can.
 */

import { Effect, Layer } from 'effect'
import {
  describeBaseline,
  recordAccountBaselines,
} from '@/application/use-cases/seed/reset-kept-accounts'
import {
  applyDatabaseMigrations,
  discoverConfigFile,
  refuse,
  requireApp,
} from '@/cli/commands/app-prelude'
import { requireSeedDir } from '@/cli/commands/seed'
import { DatabaseUnownedLive } from '@/infrastructure/database/drizzle/layer'
import { SeedResetRepositoryLive } from '@/infrastructure/database/repositories/seed/seed-reset-repository-live'
import { SeedStorageLive } from './database'
import { loadSeedFiles } from './load'
import { report } from './report'
import type { SeedCommandOptions } from '@/cli/commands/seed'

const indent = (lines: readonly string[]): string => lines.map((line) => `  ${line}`).join('\n')

/** Handle `sovrium seed --baseline`. */
export const handleSeedBaseline = async (options: SeedCommandOptions): Promise<void> => {
  const configFile = options.configFile ?? (await discoverConfigFile())
  const { app, authoredTableIds } = await requireApp(configFile)
  const seedDir = await requireSeedDir(options.seedDir, configFile)
  const loaded = await loadSeedFiles(seedDir, options.seedDir === undefined)
  if (!loaded.ok) return refuse(`Error: seed files could not be read:\n${indent(loaded.errors)}`)
  if (!loaded.accountsFile) {
    return refuse(
      `Error: no users.yaml in ${seedDir}: a reset keeps every account untouched without one, so there is no baseline to record.`
    )
  }
  await applyDatabaseMigrations(app, { authoredTableIds })
  // A step of the seed command's async run; the run stays where it is awaited.
  const recorded = await Effect.runPromise(
    Effect.provide(
      recordAccountBaselines(loaded.accounts),
      Layer.provide(SeedResetRepositoryLive, Layer.merge(SeedStorageLive, DatabaseUnownedLive))
    )
  )
  report([
    `baseline recorded for ${recorded.length} account(s) a reset keeps`,
    ...recorded.map(describeBaseline),
  ])
}
