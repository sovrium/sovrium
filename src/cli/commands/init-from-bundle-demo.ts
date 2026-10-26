/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init --from-bundle … --with-demo-data`: the first run of an
 * imported project, its admin and its demo data in place.
 *
 * Unlike `sovrium dev`, whose admin is predictable, the imported project's
 * admin has a fixed address, {@link DEMO_ADMIN_EMAIL}, and a RANDOM password,
 * printed once as JSON on stdout. Nothing writes it to a file: the database
 * keeps only its hash, and whoever reads stdout (the desktop app, a person)
 * decides what to do with it. `sovrium admin reset-password` is the recovery.
 *
 * It is a first run, never a re-run: the data directory must not hold a
 * database yet, and is checked BEFORE the project is written, so a refusal
 * leaves both the directory and the database as they were.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { prepareProjectData, randomAccountPassword } from '@/cli/runtime/project-data'
import { resolvePasswordPolicy } from '@/domain/models/app/auth/password-policy'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import type { AppEncoded } from '@/domain/models/app'

/** The imported project's admin address: local by construction, never a real mailbox. */
export const DEMO_ADMIN_EMAIL = 'admin@localhost.sovrium'

/**
 * The data directory the demo data goes into: `SOVRIUM_DATA_DIR` when the
 * environment names one (the desktop app sets one per project), else the
 * project's own `.sovrium/`, which `sovrium start` run in the project reads.
 */
const demoDataDir = (targetDir: string): string =>
  (process.env['SOVRIUM_DATA_DIR'] ?? '') === '' ? join(targetDir, '.sovrium') : parseDataDir()

/** Why `--with-demo-data` cannot run here, or `undefined`. Checked before anything is written. */
export const demoDataRefusal = (targetDir: string): string | undefined => {
  if ((process.env['DATABASE_URL'] ?? '') !== '') {
    return (
      '--with-demo-data fills a new local database, and DATABASE_URL names a database it cannot tell is empty. ' +
      'Nothing was written. Unset DATABASE_URL, or open the project without --with-demo-data and load its seed with sovrium seed.'
    )
  }
  const dataDir = demoDataDir(targetDir)
  const database = join(dataDir, 'database.db')
  return existsSync(database)
    ? `--with-demo-data loads demo data into a new database, and the data directory ${dataDir} already holds one (${database}). ` +
        'It was left as it was, and nothing was written. Use a new data directory, or open the project without --with-demo-data.'
    : undefined
}

/** What the demo-data run produced: the lines to print and, with auth, the credentials. */
export type DemoDataOutcome =
  | {
      readonly ok: true
      readonly lines: readonly string[]
      readonly credentials: { readonly email: string; readonly password: string } | undefined
      /** The seed run failed: printed in `lines`, and the command exits 1. */
      readonly failed: boolean
    }
  | { readonly ok: false; readonly reason: string }

/**
 * Create the admin and load `seed/` into the project just written at
 * `targetDir`. `config` is the bundle's config, already decoded against the
 * schema by the import.
 */
export const loadDemoData = (targetDir: string, config: unknown): DemoDataOutcome => {
  // The children inherit the environment: point them at the directory checked above.
  process.env['SOVRIUM_DATA_DIR'] = demoDataDir(targetDir)
  const { auth } = config as AppEncoded
  const password = randomAccountPassword(resolvePasswordPolicy(auth).minLength)
  const prepared = prepareProjectData({
    hasAuth: auth !== undefined,
    configFile: join(targetDir, 'app.yaml'),
    email: DEMO_ADMIN_EMAIL,
    password,
  })
  if (!prepared.ok) {
    return {
      ok: false,
      reason: `The project was created in ${targetDir}, but its admin ${DEMO_ADMIN_EMAIL} could not be.\n${prepared.output}`,
    }
  }
  const seedLine = {
    loaded: 'Demo data loaded from seed/.',
    none: 'The bundle carries no demo data (no seed/ folder), so only the admin was created.',
    failed: `The demo data could not be loaded:\n${prepared.seedOutput}`,
  }[prepared.seed]
  const adminLine = prepared.adminCreated
    ? `Created admin ${DEMO_ADMIN_EMAIL}. Its password is printed once below, and stored nowhere but as a hash.`
    : 'The app declares no auth, so no admin was created.'
  return {
    ok: true,
    lines: [seedLine, adminLine],
    credentials: prepared.adminCreated ? { email: DEMO_ADMIN_EMAIL, password } : undefined,
    failed: prepared.seed === 'failed',
  }
}
