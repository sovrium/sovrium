/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A project's first data: an admin account, then its `seed/`, written into
 * the data directory the environment names (`SOVRIUM_DATA_DIR`).
 *
 * Shared by `sovrium dev`, which recreates its own data directory on every
 * run, and `sovrium init --from-bundle --with-demo-data`, which fills a new
 * project's once. Both verbs run as CHILD processes of this same program:
 * `seed` ends in `process.exit`, and neither may share a SQLite file with a
 * live writer, so each has finished before anything else opens the database.
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isBunfsPath } from '@/infrastructure/process/package-paths'

/** How long `admin create` and `seed` may take, each. */
const CHILD_TIMEOUT_MS = 120_000

/** Run one verb of this same program to its end — `restart`'s argv rule. */
export const runOwnVerb = (
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>
): { readonly ok: boolean; readonly output: string } => {
  const entry = process.argv[1]
  const viaScript = entry !== undefined && !isBunfsPath(entry)
  const result = spawnSync(process.execPath, [...(viaScript ? [entry] : []), ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    timeout: CHILD_TIMEOUT_MS,
  })
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  }
}

/**
 * A random password for an account a command creates or resets on the
 * person's behalf: 24 URL-safe characters (144 bits), longer when the app's
 * password policy asks for more.
 */
export const randomAccountPassword = (minLength: number): string => {
  const length = Math.max(24, minLength)
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length)
}

/** What {@link prepareProjectData} did. */
export type PreparedData =
  | {
      readonly ok: true
      readonly adminCreated: boolean
      /** `none` when the project has no `seed/` directory. */
      readonly seed: 'loaded' | 'failed' | 'none'
      /** The seed run's own output, when it failed. */
      readonly seedOutput: string
    }
  | { readonly ok: false; readonly output: string }

/**
 * Create the admin (when the app declares `auth`), then load `seed/` when the
 * project has one. A refused admin stops here, before any seed runs. A failed
 * seed does not: it is reported, and the admin it follows stays.
 */
export const prepareProjectData = (input: {
  readonly hasAuth: boolean
  readonly configFile: string
  readonly email: string
  readonly password: string
  /** Extra arguments for `seed` (e.g. `--report <file>`). */
  readonly seedArgs?: readonly string[]
  /** Extra environment for `seed` (e.g. `SOVRIUM_SEED_PASSWORD`). */
  readonly seedEnv?: Readonly<Record<string, string>>
}): PreparedData => {
  const { hasAuth, configFile, email, password } = input
  if (hasAuth) {
    const admin = runOwnVerb(['admin', 'create', email, configFile, '--password', password], {})
    if (!admin.ok) return { ok: false, output: admin.output }
  }
  if (!existsSync(join(dirname(configFile), 'seed'))) {
    return { ok: true, adminCreated: hasAuth, seed: 'none', seedOutput: '' }
  }
  const seed = runOwnVerb(['seed', configFile, ...(input.seedArgs ?? [])], input.seedEnv ?? {})
  return {
    ok: true,
    adminCreated: hasAuth,
    seed: seed.ok ? 'loaded' : 'failed',
    seedOutput: seed.ok ? '' : seed.output,
  }
}
