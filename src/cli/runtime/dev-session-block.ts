/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two blocks `sovrium dev` prints — the session it booted, and the session
 * a second run found already serving. Pure: every row is a fixed label an agent
 * reads, so the wording lives here, beside its unit test, and the command only
 * gathers the facts.
 */

import type { DevSessionFile } from '@/cli/runtime/dev-session'
import type { CliBlock, CliLine } from '@/infrastructure/logging/cli-output'
import type { LockFileData } from '@/infrastructure/server/lock-file'

/** The `Data` row's account of what this run did to the data. */
export interface DataOutcome {
  readonly kept: boolean
  readonly adminCreated: boolean
  readonly seed: 'loaded' | 'failed' | 'none'
}

/** `fresh: admin created, seed loaded`, `fresh: no seed/ folder`, `kept: DATABASE_URL is set, …`. */
export const dataOutcomeText = (outcome: DataOutcome): string => {
  if (outcome.kept) {
    const tail = { loaded: 'empty tables seeded', failed: 'seed failed', none: 'no seed/ folder' }
    return `kept: DATABASE_URL is set, ${tail[outcome.seed]}`
  }
  if (outcome.seed === 'none') return 'fresh: no seed/ folder'
  const seed = outcome.seed === 'loaded' ? 'seed loaded' : 'seed failed'
  return `fresh: ${outcome.adminCreated ? `admin created, ${seed}` : seed}`
}

/** Why the `Open` row's page was, or was not, opened. */
export type OpenOutcome = 'opened' | 'not opened: --no-open' | 'not opened: headless'

/** A live instance of the same project under `sovrium start`, from its own lock. */
export interface OtherInstance {
  readonly pid: number
  readonly port?: number | undefined
  readonly socketPath?: string | undefined
}

/** `sovrium start on port 3001 (PID n), data in .sovrium/ — a separate database`. */
const alsoServingLine = (other: OtherInstance): CliLine => ({
  glyph: 'at',
  text: `Also serving: sovrium start ${other.socketPath === undefined ? `on port ${String(other.port)}` : `on the socket ${other.socketPath}`} (PID ${String(other.pid)}), data in .sovrium/ — a separate database`,
})

/** Everything the session block prints, gathered once the server serves. */
export interface DevSessionFacts {
  readonly appName: string
  readonly url: string
  readonly adminUrl?: string | undefined
  readonly openUrl: string
  readonly open: OpenOutcome
  readonly signIn?: { readonly email: string; readonly password: string } | undefined
  readonly devDir: string
  readonly data: DataOutcome
  readonly configPath: string
  readonly statusPath: string
  readonly statusTool: string
  readonly other?: OtherInstance | undefined
}

const POSTGRES_WARNING =
  'DATABASE_URL is set — dev did not reset this database (only empty tables were seeded); `sovrium seed --mode replace` resets the seeded tables; set SOVRIUM_ENCRYPTION_KEY so dev and start read one key'

/** The block a booted session prints, its warnings in a second block. */
export const formatDevSessionBlock = (facts: DevSessionFacts): readonly CliBlock[] => {
  const rows: readonly CliLine[] = [
    { glyph: 'ok', text: `Dev session: ${facts.appName} — Ctrl-C stops it` },
    { glyph: 'at', text: `App: ${facts.url}` },
    ...(facts.adminUrl === undefined ? [] : [{ glyph: 'at', text: `Admin: ${facts.adminUrl}` }]),
    { glyph: 'at', text: `Open: ${facts.openUrl} (${facts.open})` },
    ...(facts.signIn === undefined
      ? []
      : [{ glyph: 'at', text: `Sign in: ${facts.signIn.email} / ${facts.signIn.password}` }]),
    { glyph: 'at', text: `Data: ${facts.devDir} (${dataOutcomeText(facts.data)})` },
    { glyph: 'at', text: `Config: ${facts.configPath}` },
    { glyph: 'at', text: `Status: ${facts.statusPath}` },
    {
      glyph: 'at',
      text: `Next: edit the config, then read status.json (or \`${facts.statusTool}\`) until \`seq\` advances`,
    },
    ...(facts.other === undefined ? [] : [alsoServingLine(facts.other)]),
  ] as readonly CliLine[]
  const warnings: readonly CliLine[] = [
    ...(facts.data.seed === 'failed'
      ? [{ glyph: 'warn' as const, text: 'Seed: failed — booted without seed data' }]
      : []),
    ...(facts.data.kept ? [{ glyph: 'warn' as const, text: POSTGRES_WARNING }] : []),
  ]
  return [rows, warnings]
}

/** What a second run prints about the session already serving. */
export interface RunningSessionFacts {
  readonly lock: LockFileData
  readonly session: DevSessionFile | undefined
  readonly statusPath: string
  readonly status?: { readonly state: string; readonly seq: number } | undefined
  /** The config this run was given, when it is not the one the session serves. */
  readonly otherConfig?: string | undefined
  readonly other?: OtherInstance | undefined
}

/** `http://localhost:<port>`, or `the socket <path>` — `restart`'s rule. */
export const instanceUrl = (lock: Readonly<Pick<LockFileData, 'port' | 'socketPath'>>): string =>
  lock.socketPath !== undefined
    ? `the socket ${lock.socketPath}`
    : `http://localhost:${String(lock.port)}`

/** The block a second run prints, from the session file rather than a decode of the config. */
export const formatRunningSessionBlock = (facts: RunningSessionFacts): readonly CliBlock[] => {
  const { session } = facts
  const signIn =
    session === undefined
      ? 'Sign in: run sovrium dev after stopping it'
      : session.email !== undefined && session.password !== undefined
        ? `Sign in: ${session.email} / ${session.password}`
        : undefined
  const status =
    facts.status === undefined
      ? facts.statusPath
      : `${facts.statusPath} — ${facts.status.state}, seq ${String(facts.status.seq)}`
  const rows: readonly CliLine[] = [
    { glyph: 'ok', text: `Already serving this project (PID ${String(facts.lock.pid)})` },
    { glyph: 'at', text: `App: ${session?.url ?? instanceUrl(facts.lock)}` },
    ...(signIn === undefined ? [] : [{ glyph: 'at' as const, text: signIn }]),
    { glyph: 'at', text: `Status: ${status}` },
    ...(facts.other === undefined ? [] : [alsoServingLine(facts.other)]),
  ]
  const warnings: readonly CliLine[] = [
    {
      glyph: 'warn',
      text: 'Data kept — stop it (Ctrl-C, or SOVRIUM_DATA_DIR=.sovrium/dev sovrium stop) and run sovrium dev again for a fresh state',
    },
    ...(facts.otherConfig === undefined
      ? []
      : [
          {
            glyph: 'warn' as const,
            text: `It serves ${facts.lock.configPath}, not ${facts.otherConfig} — one dev session per project; stop it to switch`,
          },
        ]),
  ]
  return [rows, warnings]
}
