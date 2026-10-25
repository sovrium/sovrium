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
 * - `--as <email>` (with `--seed`) draws every board as the seeded account
 *   holding that address, instead of the first seeded administrator;
 * - `--state <page>:<key>=<value>` one more board of a page, at that state;
 * - `--prototype[=app]` clickable Claude Design boards.
 *
 * Each is refused, naming it, where it changes nothing (without `--pages`) or
 * names nothing (a folder that is not there, a page or a state the config does
 * not have), and a refused export writes nothing.
 */

import { stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import {
  seededAccountOf,
  type PageDrawOptions,
} from '@/application/use-cases/admin/design-system-page-boards'
import {
  pageSeedOf,
  type PageSeed,
  type PageSeedAccount,
} from '@/application/use-cases/admin/design-system-page-seed-folder'
import {
  checkPageState,
  type PageStateRequest,
} from '@/application/use-cases/admin/design-system-page-states'
import { getFlagValue, getFlagValues } from '@/cli/runtime/flag-vocabulary'
import { SPECIMEN_INSTANT } from '@/domain/models/app/pages/specimen-sample-service'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { discoverSeedFiles, loadSeedFiles, parseSeedText } from './seed-load'
import type { App } from '@/domain/models/app'
import type { CanvasDrawnWith } from '@/domain/models/app/design/adapters/pages/claude-design-canvas-drawn-with'

/** The drawing flags as typed: each RAW value, and whether the flag was given at all. */
export interface PageDrawFlags {
  readonly seed?: string | undefined
  readonly seedRequested?: boolean
  readonly records?: string | undefined
  readonly recordsRequested?: boolean
  readonly now?: string | undefined
  readonly nowRequested?: boolean
  readonly as?: string | undefined
  readonly asRequested?: boolean
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
    as: getFlagValue(argv, '--as'),
    asRequested: argv.includes('--as'),
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
  ...(flags.asRequested === true ? ['--as'] : []),
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

/** The first `--state <page>:role=<value>` asked for, which draws another account. */
const roleStateOf = (flags: PageDrawFlags): string | undefined =>
  (flags.states ?? []).find((state) => /:role=/.test(state))

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
    when: (flags) => flags.asRequested === true && flags.seedRequested !== true,
    says: () =>
      '--as draws the pages as one seeded account, so it needs --seed <dir> to find it in.',
  },
  {
    when: (flags) => flags.asRequested === true && roleStateOf(flags) !== undefined,
    says: (flags) =>
      `--as draws every board as one seeded account, so it cannot be given with --state ` +
      `${roleStateOf(flags) ?? ''}, whose role=<value> board would draw another account.`,
  },
  {
    when: (flags) => flags.asRequested === true && (flags.as ?? '') === '',
    says: () => '--as names the email address of a seeded account: --as <email>.',
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

/**
 * Read the seed folder `--seed` named, refusing one that is missing or does
 * not read; `named` is how a refusal names it.
 */
const readSeed = async (
  app: App,
  configPath: string,
  folder: string,
  seeded: { readonly now: Readonly<Date>; readonly named: string }
) => {
  const { now, named } = seeded
  if (!(await isFolder(folder))) {
    return refuse(`${named}: there is no such folder (${folder}).`)
  }
  const loaded = await loadSeedFiles(folder)
  if (!loaded.ok) return refuse(`${named} does not read:\n\n  ${loaded.errors.join('\n  ')}`)
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

/**
 * The seeded account an `--as` address names, refusing an address no seeded
 * account holds (`named` is how the refusal names the flag); none without one.
 */
const accountOf = (
  seed: PageSeed | undefined,
  email: string | undefined,
  named: string
): PageSeedAccount | undefined => {
  if (email === undefined || seed === undefined) return undefined
  const account = seed.accounts.find(
    (candidate) => candidate.email.toLowerCase() === email.toLowerCase()
  )
  if (account !== undefined) return account
  const held = seed.accounts.map((candidate) => candidate.email)
  return refuse(
    `${named}: no seeded account holds the address ${email}.\n\n  ` +
      (held.length === 0
        ? 'The seed folder declares no account.'
        : `The seeded accounts are: ${held.join(', ')}.`)
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
      : await readSeed(app, configPath, resolve(process.cwd(), flags.seed), {
          now: now ?? SPECIMEN_INSTANT,
          named: `--seed ${flags.seed}`,
        })
  return {
    seed,
    now,
    as: accountOf(seed, flags.as, `--as ${flags.as ?? ''}`),
    records: flags.records === undefined ? undefined : Number(flags.records),
    states: checks.flatMap((check) => (check.ok ? [check.state] : [])),
    prototype:
      flags.prototype === undefined ? undefined : flags.prototype === 'app' ? 'app' : 'board',
  }
}

/**
 * Name the seed folder and the account an import's comparison is drawn from.
 * A recorded folder may sit outside the project (a shared seed): naming it is
 * the safeguard.
 */
const nameComparison = (folder: string, reader: PageSeedAccount | undefined): void =>
  printStderr(
    `Compared against a drawing made from the seed folder ${folder}, ` +
      `as ${reader?.email ?? 'the sample administrator'}.`
  )

/**
 * What the canvas being imported was drawn with, rebuilt from the inputs its
 * export recorded: the seed folder (read relative to the config, as the
 * export named it), the instant, the account, the record count and the
 * prototype kind.
 * Refuses, naming it, a recorded seed folder that is missing or no longer
 * reads, and names on stderr the folder and the account the comparison is
 * drawn as; `undefined` when the canvas recorded nothing.
 */
export const recordedDrawRequestFor = async (
  app: App,
  configPath: string,
  recorded: CanvasDrawnWith | undefined
): Promise<PageDrawRequest | undefined> => {
  if (recorded === undefined) return undefined
  const now = clockOf(recorded.now)
  const folder =
    recorded.seed === undefined ? undefined : resolve(dirname(resolve(configPath)), recorded.seed)
  const seed =
    folder === undefined
      ? undefined
      : await readSeed(app, configPath, folder, {
          now: now ?? SPECIMEN_INSTANT,
          named: `The seed folder "${recorded.seed ?? ''}" the canvas was exported with`,
        })
  const as = accountOf(seed, recorded.as, 'The account the canvas was exported as')
  if (folder !== undefined) nameComparison(folder, as ?? seededAccountOf(seed, 'admin'))
  return {
    seed,
    now,
    as,
    records: recorded.records,
    states: [],
    prototype: recorded.prototype,
  }
}
