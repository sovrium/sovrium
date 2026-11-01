/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The flags `sovrium seed` reads itself, for a seed of this machine and of a
 * hosted app, and the `--request <file>` a hosting machine passes in their
 * place; the flags it shares with other verbs arrive parsed by the dispatcher.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Option, Schema } from 'effect'
import { refuse } from '@/cli/commands/app-prelude'
import { cloudTargetFlags } from '@/cli/commands/cloud-sign-in'
import { defineFlags, flag, parseFlags, type FlagsOf } from '@/cli/runtime/flag-schema'
import { seedRunRequestSchema } from '@/domain/models/api/automations/cloud/seed-run'
import type { SeedCommandOptions } from '@/cli/commands/seed'

/** Flags that only mean something to a seed of this machine. */
export const LOCAL_ONLY_FLAGS = ['--dir', '--as', '--request', '--report'] as const

/**
 * Whether the command line names a hosted app: `--app`, or `--remote` — in
 * either spelling, `--app=<slug>` included. Read wide on purpose: a hosted seed
 * misread as a local one would write the rows meant for the cloud into this
 * machine's database, a `replace` deleting them first.
 */
export const isRemoteSeed = (flags: RemoteSeedFlags): boolean =>
  flags['--app'].given || flags['--remote'].given

/**
 * The flags a hosted seed reads by their next token, refused when written
 * `--flag=value` or given no value — rather than read as absent. `--app` and
 * `--host` are read in both spellings, by the readers every cloud command
 * shares, which refuse them given no value.
 */
export const VALUE_FLAGS = ['--confirm', '--mode', '--table', '--today'] as const

/**
 * The flags a seed reads, the spelling of each judged by name: the local-only
 * and next-token flags above, and the two that make a seed a hosted one.
 */
export const remoteSeedFlags = defineFlags({
  ...cloudTargetFlags,
  confirm: flag.value('--confirm'),
  yes: flag.switch('--yes'),
  '--app': flag.occurrence('--app'),
  '--remote': flag.occurrence('--remote'),
  '--dir': flag.occurrence('--dir'),
  '--as': flag.occurrence('--as'),
  '--request': flag.occurrence('--request'),
  '--report': flag.occurrence('--report'),
  '--confirm': flag.occurrence('--confirm'),
  '--mode': flag.occurrence('--mode'),
  '--table': flag.occurrence('--table'),
  '--today': flag.occurrence('--today'),
})

/** A seed's flags, as {@link remoteSeedFlags} reads them. */
export type RemoteSeedFlags = FlagsOf<typeof remoteSeedFlags>

/** The flags `sovrium seed` reads itself; the shared ones arrive parsed in the options. */
export const seedFlags = defineFlags({
  ...remoteSeedFlags,
  baseline: flag.switch('--baseline'),
  request: flag.path('--request'),
  dir: flag.value('--dir'),
  tables: flag.values('--table'),
  as: flag.value('--as'),
  today: flag.value('--today'),
  report: flag.path('--report'),
})

/** {@link seedFlags}, read. */
export type SeedFlags = FlagsOf<typeof seedFlags>

/** The flags of a seed run another command starts: none given. */
export const NO_SEED_FLAGS: SeedFlags = parseFlags(seedFlags, [])

/** What a `--request <file>` may carry: the request of a hosted seed, without its app. */
const seedRequestFileSchema = Schema.Struct({
  mode: seedRunRequestSchema.fields.mode,
  tables: seedRunRequestSchema.fields.tables,
  today: seedRunRequestSchema.fields.today,
  dryRun: seedRunRequestSchema.fields.dryRun,
})

/**
 * The options with `--request <file>` read in place of the flags — how the
 * one-shot seed unit of a hosting machine passes them. A file that is missing
 * or is not a request is refused, naming it.
 */
export const withRequestFile = async (
  options: SeedCommandOptions,
  path: string | undefined
): Promise<SeedCommandOptions> => {
  if (path === undefined) return options
  const text = await readFile(path, 'utf-8').catch((error: unknown) =>
    refuse(`Error: could not read the seed request ${resolve(path)}: ${String(error)}`)
  )
  const decoded = Option.flatMap(
    Option.liftThrowable(() => JSON.parse(text) as unknown)(),
    Schema.decodeUnknownOption(seedRequestFileSchema)
  )
  if (Option.isNone(decoded)) {
    return refuse(
      `Error: ${resolve(path)} is not a seed request. Expected { "mode": "if-empty" | "upsert" | "replace", "tables"?: [names], "today"?: "YYYY-MM-DD", "dryRun"?: true | false }.`
    )
  }
  const request = decoded.value
  return {
    ...options,
    mode: request.mode,
    tables: request.tables ?? [],
    dryRun: request.dryRun ?? false,
    today: request.today,
  }
}
