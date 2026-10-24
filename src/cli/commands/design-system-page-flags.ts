/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The flags that draw a `--pages` export as people see the app:
 *
 * - `--seed <dir>` draws the pages from that seed folder, resolved against the
 *   working directory, instead of the synthetic sample. Files only: the folder
 *   is read as `sovrium seed` reads it, plus `auth/<list>.yaml` and
 *   `system/<name>.yaml`, and no database is opened;
 * - `--records <n>` (with `--seed`) how many boards a routed record page gets;
 * - `--now <instant>` the instant relative times are drawn against;
 * - `--state <page>:<key>=<value>` one more board of a page, at that state;
 * - `--prototype[=app]` clickable Claude Design boards.
 *
 * Each is refused, naming it, where it changes nothing (without `--pages`) or
 * names nothing (a folder that is not there, a page or a state the config does
 * not have), and a refused export writes nothing.
 */

import { stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { pageSeedOf } from '@/application/use-cases/admin/design-system-page-seed-folder'
import {
  checkPageState,
  type PageStateRequest,
} from '@/application/use-cases/admin/design-system-page-states'
import { getFlagValue, getFlagValues } from '@/cli/runtime/flag-vocabulary'
import { SPECIMEN_INSTANT } from '@/domain/models/app/pages/specimen-sample-service'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { discoverSeedFiles, loadSeedFiles, parseSeedText } from './seed-load'
import type { PageDrawOptions } from '@/application/use-cases/admin/design-system-page-boards'
import type { App } from '@/domain/models/app'

/** The drawing flags as typed: each RAW value, and whether the flag was given at all. */
export interface PageDrawFlags {
  readonly seed?: string | undefined
  readonly seedRequested?: boolean
  readonly records?: string | undefined
  readonly recordsRequested?: boolean
  readonly now?: string | undefined
  readonly nowRequested?: boolean
  readonly states?: readonly string[]
  /** `''` for a bare `--prototype`, the value after `=` otherwise; absent without the flag. */
  readonly prototype?: string | undefined
}

/** The drawing flags of an argv, as typed. */
export const drawFlagsOf = (argv: readonly string[]): PageDrawFlags => {
  const prototype = argv.find((arg) => arg === '--prototype' || arg.startsWith('--prototype='))
  return {
    seed: getFlagValue(argv, '--seed'),
    seedRequested: argv.includes('--seed'),
    records: getFlagValue(argv, '--records'),
    recordsRequested: argv.includes('--records'),
    now: getFlagValue(argv, '--now'),
    nowRequested: argv.includes('--now'),
    states: getFlagValues(argv, '--state'),
    prototype: prototype === undefined ? undefined : prototype.slice('--prototype='.length),
  }
}

/** What a `--pages` export is drawn with, every flag read. */
export interface PageDrawRequest extends PageDrawOptions {
  readonly states: readonly PageStateRequest[]
  readonly prototype?: 'board' | 'app' | undefined
}

/** An RFC 3339 instant: a date, a time, and an offset or `Z`. */
const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i

const refuse = (message: string): never => {
  printStderr(`Error: ${message}\n\n  Nothing was written.`)
  return process.exit(1)
}

/** The flags given, in the order they are refused without `--pages`. */
const givenFlags = (flags: PageDrawFlags): readonly string[] => [
  ...(flags.seedRequested === true ? ['--seed'] : []),
  ...(flags.recordsRequested === true ? ['--records'] : []),
  ...(flags.nowRequested === true ? ['--now'] : []),
  ...((flags.states ?? []).length > 0 ? ['--state'] : []),
  ...(flags.prototype === undefined ? [] : ['--prototype']),
]

/** Whether an `--now` value is an RFC 3339 instant a date can read. */
const isInstant = (raw: string): boolean => RFC_3339.test(raw) && !Number.isNaN(Date.parse(raw))

/** One refusal of the drawing flags that needs no config: when it applies, and its sentence. */
interface FlagRefusal {
  readonly when: (flags: PageDrawFlags, pages: boolean) => boolean
  readonly says: (flags: PageDrawFlags) => string
}

/** The refusals of the drawing flags, in the order they are checked. */
const FLAG_REFUSALS: readonly FlagRefusal[] = [
  {
    when: (flags, pages) => !pages && givenFlags(flags).length > 0,
    says: (flags) => {
      const given = givenFlags(flags)
      const verb =
        given.length === 1
          ? 'draws the app’s pages, so it needs'
          : 'draw the app’s pages, so they need'
      return `${given.join(', ')} ${verb} --pages (with --format bundle).`
    },
  },
  {
    when: (flags) => flags.seedRequested === true && (flags.seed ?? '') === '',
    says: () => '--seed names the seed folder to draw from: --seed <dir>.',
  },
  {
    when: (flags) => flags.recordsRequested === true && flags.seedRequested !== true,
    says: () =>
      '--records counts the seeded records a page is drawn for, so it needs --seed <dir>.',
  },
  {
    when: (flags) => flags.recordsRequested === true && !/^[1-9]\d*$/.test(flags.records ?? ''),
    says: (flags) => `--records takes a number of boards, 1 or more, not "${flags.records ?? ''}".`,
  },
  {
    when: (flags) => flags.nowRequested === true && !isInstant(flags.now ?? ''),
    says: (flags) =>
      `--now takes an RFC 3339 instant, such as 2026-10-22T12:00:00Z, not "${flags.now ?? ''}".`,
  },
  {
    when: (flags) => flags.prototype !== undefined && !['', 'app'].includes(flags.prototype),
    says: (flags) =>
      `--prototype=${flags.prototype ?? ''} is no prototype: --prototype makes the boards ` +
      'clickable, and --prototype=app adds one board whose changes carry across pages.',
  },
]

/**
 * Refuse a drawing flag that changes nothing, before the config is read: any
 * of them without `--pages`, `--records` without `--seed`, a count, an instant
 * or a prototype kind that is not one.
 */
export const refuseDrawFlags = (flags: PageDrawFlags, pages: boolean): void => {
  const refusal = FLAG_REFUSALS.find((candidate) => candidate.when(flags, pages))
  if (refusal !== undefined) refuse(refusal.says(flags))
}

/** Whether a path names a folder. */
const isFolder = async (path: string): Promise<boolean> =>
  (await stat(path).catch(() => undefined))?.isDirectory() === true

/** The records of every file of a sub-folder (`auth/`, `system/`), by file name. */
const readLists = async (folder: string): Promise<Readonly<Record<string, readonly unknown[]>>> => {
  if (!(await isFolder(folder))) return {}
  const names = await discoverSeedFiles(folder)
  const lists = await Promise.all(
    names.map(async (name) => {
      const path = join(folder, name)
      const text = await Bun.file(path)
        .text()
        .catch((error: unknown) =>
          refuse(
            `--seed: ${path} cannot be read (${error instanceof Error ? error.message : String(error)}).`
          )
        )
      const parsed = parseSeedText(name, text)
      if (!parsed.ok) return refuse(`--seed: ${parsed.error}`)
      const records = (parsed.value as { readonly records?: unknown } | null)?.records
      return [name.replace(/\.[^.]+$/, ''), Array.isArray(records) ? records : []] as const
    })
  )
  return Object.fromEntries(lists)
}

/** Read the seed folder `--seed` named, refusing one that is missing or does not read. */
const readSeed = async (app: App, configPath: string, raw: string, now: Readonly<Date>) => {
  const folder = resolve(process.cwd(), raw)
  if (!(await isFolder(folder))) {
    return refuse(`--seed ${raw}: there is no such folder (${folder}).`)
  }
  const loaded = await loadSeedFiles(folder)
  if (!loaded.ok) return refuse(`--seed ${raw} does not read:\n\n  ${loaded.errors.join('\n  ')}`)
  return pageSeedOf(
    app,
    {
      dir: relative(dirname(resolve(configPath)), folder),
      files: loaded.files,
      accounts: loaded.accounts,
      auth: await readLists(join(folder, 'auth')),
      system: await readLists(join(folder, 'system')),
    },
    now
  )
}

/** The export's clock: `--now`, else the specimen instant the renderer draws at. */
const clockOf = (raw: string | undefined): Readonly<Date> | undefined =>
  raw === undefined ? undefined : new Date(raw)

/**
 * What a `--pages` export is drawn with: the seed folder read, each state
 * checked against the config. Refuses, naming it, a folder or a state that is
 * not there; `undefined` when no drawing flag was given.
 */
export const pageDrawRequestFor = async (
  app: App,
  configPath: string,
  flags: PageDrawFlags
): Promise<PageDrawRequest | undefined> => {
  if (givenFlags(flags).length === 0) return undefined
  const checks = (flags.states ?? []).map((raw) => checkPageState(app, raw))
  const failed = checks.flatMap((check) => (check.ok ? [] : [check.message]))
  if (failed.length > 0) refuse(failed.join('\n  '))
  const now = clockOf(flags.now)
  const seed =
    flags.seed === undefined
      ? undefined
      : await readSeed(app, configPath, flags.seed, now ?? SPECIMEN_INSTANT)
  return {
    seed,
    now,
    records: flags.records === undefined ? undefined : Number(flags.records),
    states: checks.flatMap((check) => (check.ok ? [check.state] : [])),
    prototype:
      flags.prototype === undefined ? undefined : flags.prototype === 'app' ? 'app' : 'board',
  }
}
