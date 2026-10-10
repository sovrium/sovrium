/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Layer } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import { ProcessRunner } from '@/application/ports/services/process-runner'
import { INSTANCE_LOGS_SINCE_PATTERN } from '@/domain/models/app/automations/actions/instance/logs'
import {
  resolveJournalctlPath,
  resolveSystemctlPath,
} from '@/domain/models/process-env/host-actions'
import { handFileToUnit, readFileFromUnit, readJsonFromUnit } from './instance-handover'
import {
  CRASH_JOURNAL_LINES,
  CRASH_JOURNAL_MAX_BYTES,
  CRASH_JOURNAL_TIMEOUT_MS,
  crashJournalRead,
  crashJournalReleaseTime,
  keepNewestJournalLines,
  nothingStartedLine,
  unitSummaryLine,
  type CrashJournalRead,
  type UnitRunFacts,
} from './instance-journal'
import { probeInstance } from './instance-probe'
import {
  checkedSlug,
  discard,
  fail,
  fsStep,
  instanceDir,
  isMissing,
  readBundleEntries,
  readRelease,
  removeRelease,
  rollbackRelease,
  writeRelease,
} from './instance-releases'
import { RUN_PROPERTIES, STATUS_PROPERTIES, parseRunFacts, parseShow } from './systemd-unit-show'

/**
 * `InstanceSupervisor` over systemd (`systemctl`, `journalctl`) and the
 * instances directory (`instance-releases.ts`).
 *
 * The host defines, per supervised app `<slug>`: `sovrium-app@<slug>.service`
 * (the app), `sovrium-app@<slug>.socket` (wakes it on the first request),
 * `sovrium-proxy@<slug>.service` (the idle-exit proxy between them), and the
 * one-shot `sovrium-backup@<slug>.service` / `sovrium-restore@<slug>.service` /
 * `sovrium-seed@<slug>.service`, which run `sovrium backup` / `sovrium restore`
 * / `sovrium seed` as the app's own user. The
 * host's polkit rule grants this process `start`, `stop` and `restart` on those
 * units and nothing else, which is why no other verb is ever asked.
 *
 * Every command is an argv — never a shell line — whose only caller value is
 * the slug, re-checked here before it is used.
 */

type Runner = Effect.Success<typeof ProcessRunner>

/** Time limit of a unit command that only queues or reads a job. */
const UNIT_COMMAND_TIMEOUT_MS = 60_000

/**
 * Time limit of the `start` that ends a restart. `systemctl start` waits for
 * the job, so it must outlast the unit's own `TimeoutStartSec=60` plus the stop
 * of the old process the job may still be waiting on: the step then reports
 * systemd's verdict, never its own impatience.
 */
export const UNIT_START_TIMEOUT_MS = 150_000

/** Output kept from `systemctl`, whose answers are a few lines. */
const UNIT_COMMAND_MAX_OUTPUT = 64 * 1024

/** Output kept from `journalctl`: 1000 lines of a few kilobytes at most. */
const JOURNAL_MAX_OUTPUT = 4 * 1024 * 1024

const unit = {
  app: (slug: string) => `sovrium-app@${slug}.service`,
  socket: (slug: string) => `sovrium-app@${slug}.socket`,
  proxy: (slug: string) => `sovrium-proxy@${slug}.service`,
  backup: (slug: string) => `sovrium-backup@${slug}.service`,
  restore: (slug: string) => `sovrium-restore@${slug}.service`,
  seed: (slug: string) => `sovrium-seed@${slug}.service`,
} as const

/** Run a host tool; a non-zero exit fails with the command and what it printed. */
const runTool = (
  runner: Runner,
  argv: readonly [string, ...string[]],
  options: { readonly timeoutMs: number; readonly maxOutputBytes: number }
) =>
  runner.run(argv, options).pipe(
    Effect.mapError(
      (error) => new InstanceSupervisorError({ message: error.message, cause: error })
    ),
    Effect.filterOrElse(
      (result) => result.exitCode === 0,
      (result) =>
        fail(
          `${argv.join(' ')} failed (exit ${String(result.exitCode)}): ${result.stderr.trim() || result.stdout.trim()}`
        )
    )
  )

const systemctl = (runner: Runner, args: readonly string[], timeoutMs = UNIT_COMMAND_TIMEOUT_MS) =>
  runTool(runner, [resolveSystemctlPath(process.env), ...args], {
    timeoutMs,
    maxOutputBytes: UNIT_COMMAND_MAX_OUTPUT,
  })

/** One `systemctl` call: its arguments and how long it may take. */
interface UnitCommand {
  readonly args: readonly string[]
  readonly timeoutMs: number
  /** What a failure of this call leaves behind, said before systemctl's own answer. */
  readonly failureContext?: string
}

/**
 * The calls a verb makes, in order; each runs only if the one before succeeded.
 *
 * A restart is never `systemctl restart`: the proxy `Requires=` the app, so
 * restarting the app restarts the proxy, whose `ExecStopPost` (its idle-exit
 * stop of the app) queues a stop that cancels the app's own restart job —
 * `Job … canceled.`, on every restart of an app whose proxy runs. Stopping the
 * proxy and the app in ONE call puts both stops in one transaction, into which
 * the proxy's stop of the app merges; the app is then started alone, and the
 * proxy comes back with the next request through the socket.
 */
export const unitCommands = (
  slug: string,
  verb: 'start' | 'stop' | 'restart'
): readonly UnitCommand[] =>
  verb === 'start'
    ? [{ args: ['start', unit.socket(slug)], timeoutMs: UNIT_COMMAND_TIMEOUT_MS }]
    : verb === 'stop'
      ? // Socket first: while it listens, the next request would start the app again.
        [
          {
            args: ['stop', unit.socket(slug), unit.proxy(slug), unit.app(slug)],
            timeoutMs: UNIT_COMMAND_TIMEOUT_MS,
          },
        ]
      : [
          { args: ['stop', unit.proxy(slug), unit.app(slug)], timeoutMs: UNIT_COMMAND_TIMEOUT_MS },
          {
            args: ['start', unit.app(slug)],
            timeoutMs: UNIT_START_TIMEOUT_MS,
            // The stop went through: the app is down until the next request reaches its socket.
            failureContext: `${unit.app(slug)} was stopped for the restart, and starting it again failed`,
          },
        ]

const control = (runner: Runner, slug: string, verb: 'start' | 'stop' | 'restart') =>
  checkedSlug(slug).pipe(
    Effect.flatMap((s) =>
      Effect.forEach(unitCommands(s, verb), ({ args, timeoutMs, failureContext }) =>
        systemctl(runner, args, timeoutMs).pipe(
          Effect.mapError((error) =>
            failureContext === undefined
              ? error
              : new InstanceSupervisorError({
                  message: `${failureContext}: ${error.message}`,
                  cause: error,
                })
          )
        )
      )
    ),
    Effect.asVoid,
    Effect.withSpan('instance.control', { attributes: { 'instance.verb': verb } })
  )

const status = (runner: Runner, slug: string) =>
  checkedSlug(slug).pipe(
    Effect.flatMap((s) =>
      systemctl(runner, ['show', `--property=${STATUS_PROPERTIES}`, unit.app(s)])
    ),
    Effect.map((result) => parseShow(result.stdout)),
    Effect.withSpan('instance.status')
  )

const logs = Effect.fn('instance.logs')(function* (
  runner: Runner,
  slug: string,
  options: { readonly lines: number; readonly since?: string }
) {
  const s = yield* checkedSlug(slug)
  if (!Number.isInteger(options.lines) || options.lines < 1 || options.lines > 1000) {
    return yield* fail(`lines must be a whole number from 1 to 1000 (got ${String(options.lines)})`)
  }
  if (options.since !== undefined && !INSTANCE_LOGS_SINCE_PATTERN.test(options.since)) {
    return yield* fail(`since must be an ISO 8601 date or date and time (got "${options.since}")`)
  }
  const since = options.since === undefined ? [] : [`--since=${options.since}`]
  const result = yield* runTool(
    runner,
    [
      resolveJournalctlPath(process.env),
      '-u',
      unit.app(s),
      '--no-pager',
      '-n',
      String(options.lines),
      ...since,
    ],
    { timeoutMs: UNIT_COMMAND_TIMEOUT_MS, maxOutputBytes: JOURNAL_MAX_OUTPUT }
  )
  return result.stdout.split('\n').filter((line) => line !== '')
})

/** The journalctl filter of a crash journal read, from the decision `crashJournalRead` made. */
const crashJournalFilter = (
  s: string,
  read: Exclude<CrashJournalRead, { readonly _tag: 'NothingSince' }>
): readonly string[] =>
  read._tag === 'Invocation'
    ? // The process's own lines and systemd's lines about that run. Not `-u` plus a
      // field: `-u` expands to an OR of several unit fields, which a term would not narrow.
      [`_SYSTEMD_INVOCATION_ID=${read.invocationId}`, '+', `INVOCATION_ID=${read.invocationId}`]
    : ['-u', unit.app(s)]

const crashJournal = Effect.fn('instance.crash-journal')(function* (runner: Runner, slug: string) {
  const s = yield* checkedSlug(slug)
  const releaseTime = yield* crashJournalReleaseTime(readRelease(s))
  const facts = yield* systemctl(
    runner,
    ['show', '--timestamp=unix', `--property=${RUN_PROPERTIES}`, unit.app(s)],
    CRASH_JOURNAL_TIMEOUT_MS
  ).pipe(
    Effect.map((result) => parseRunFacts(result.stdout)),
    Effect.tapCause((cause) =>
      Effect.logWarning('instance: systemctl show failed, reading the journal by time', cause)
    ),
    // The journal still explains a crash without the summary line: read it by time instead.
    Effect.orElseSucceed((): UnitRunFacts | undefined => undefined)
  )
  const summary = facts === undefined ? [] : [unitSummaryLine(unit.app(s), facts)]
  const read = crashJournalRead(facts, releaseTime)
  if (read._tag === 'NothingSince') {
    return [...summary, nothingStartedLine(unit.app(s), read.releaseTime)]
  }
  const result = yield* runTool(
    runner,
    [
      resolveJournalctlPath(process.env),
      ...crashJournalFilter(s, read),
      '--no-pager',
      '-n',
      String(CRASH_JOURNAL_LINES),
      ...(read._tag === 'Window' ? [`--since=${read.since}`] : []),
    ],
    // Read under the generous cap, then trim from the oldest end: a cut at the
    // byte limit would keep the head and lose the exit line.
    { timeoutMs: CRASH_JOURNAL_TIMEOUT_MS, maxOutputBytes: JOURNAL_MAX_OUTPUT }
  )
  const lines = result.stdout.split('\n').filter((line) => line !== '')
  const summaryBytes = summary.reduce((bytes, line) => bytes + Buffer.byteLength(line) + 1, 0)
  return [...summary, ...keepNewestJournalLines(lines, CRASH_JOURNAL_MAX_BYTES - summaryBytes)]
})

const backup = Effect.fn('instance.backup')(function* (
  runner: Runner,
  slug: string,
  timeoutMs: number
) {
  const dir = yield* instanceDir(slug)
  const s = yield* checkedSlug(slug)
  const archivePath = join(dir, 'backup', 'backup.tar.gz')
  yield* systemctl(runner, ['start', unit.backup(s)], timeoutMs)
  // Read without following a link: the backup unit, running as the app, wrote
  // this directory, and an archive the agent uploads is restored back to the app.
  const bytes = yield* readFileFromUnit(archivePath).pipe(Effect.ensuring(discard(archivePath)))
  if (bytes === undefined) {
    return yield* fail(`${unit.backup(s)} left no archive at ${archivePath}`)
  }
  return new Uint8Array(bytes)
})

const restore = Effect.fn('instance.restore')(function* (
  runner: Runner,
  slug: string,
  archive: Uint8Array,
  timeoutMs: number
) {
  const dir = yield* instanceDir(slug)
  const s = yield* checkedSlug(slug)
  const archivePath = join(dir, 'restore', 'restore.tar.gz')
  yield* Effect.gen(function* () {
    yield* handFileToUnit(archivePath, archive)
    yield* control(runner, s, 'stop')
    // A failed restore unit ends the step here: the app stays stopped, never half-restored.
    yield* systemctl(runner, ['start', unit.restore(s)], timeoutMs)
    yield* control(runner, s, 'start')
  }).pipe(Effect.ensuring(discard(archivePath)))
})

/** Whether the current release of the app ships a `seed/` folder. */
const hasSeedFolder = (seedDir: string) =>
  fsStep(`read ${seedDir}`, () =>
    stat(seedDir).then(
      (found) => found.isDirectory(),
      (cause: unknown) => {
        if (isMissing(cause)) return false
        throw cause
      }
    )
  )

/** The most a seed report may weigh: a line per table and per invitation, far below this. */
const SEED_REPORT_MAX_BYTES = 4 * 1024 * 1024

const seed = Effect.fn('instance.seed')(function* (
  runner: Runner,
  slug: string,
  request: Readonly<Record<string, unknown>>,
  timeoutMs: number
) {
  const dir = yield* instanceDir(slug)
  const s = yield* checkedSlug(slug)
  if (!(yield* hasSeedFolder(join(dir, 'current', 'seed')))) {
    return yield* fail(
      `instance: the release ${s} runs has no seed/ folder; add seed files beside its config and deploy it again`
    )
  }
  const requestPath = join(dir, 'seed', 'request.json')
  const reportPath = join(dir, 'seed', 'report.json')
  return yield* Effect.gen(function* () {
    // Same hand-over directory rules as a restore: the unit runs as the app's user, in its group.
    // A report left by an earlier run must not stand for this one.
    yield* discard(reportPath)
    yield* handFileToUnit(requestPath, new TextEncoder().encode(JSON.stringify(request)))
    const ran = yield* Effect.result(systemctl(runner, ['start', unit.seed(s)], timeoutMs))
    const report = yield* readJsonFromUnit(reportPath, SEED_REPORT_MAX_BYTES)
    return { report, ...(ran._tag === 'Failure' ? { unitError: ran.failure.message } : {}) }
  }).pipe(Effect.ensuring(Effect.andThen(discard(requestPath), discard(reportPath))))
})

export const SystemdSupervisorLive = Layer.effect(
  InstanceSupervisor,
  Effect.gen(function* () {
    const runner = yield* ProcessRunner
    return InstanceSupervisor.of({
      status: (slug) => status(runner, slug),
      control: (slug, verb) => control(runner, slug, verb),
      logs: (slug, options) => logs(runner, slug, options),
      crashJournal: (slug) => crashJournal(runner, slug),
      backup: (slug, timeoutMs) => backup(runner, slug, timeoutMs),
      restore: (slug, archive, timeoutMs) => restore(runner, slug, archive, timeoutMs),
      seed: (slug, request, timeoutMs) => seed(runner, slug, request, timeoutMs),
      readRelease,
      writeRelease,
      rollbackRelease,
      removeRelease,
      probe: probeInstance,
      readBundleEntries,
    })
  })
)
