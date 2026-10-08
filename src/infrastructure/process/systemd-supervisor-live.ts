/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Effect, Layer } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
  type InstanceUnitStatus,
} from '@/application/ports/services/instance-supervisor'
import { ProcessRunner } from '@/application/ports/services/process-runner'
import { INSTANCE_LOGS_SINCE_PATTERN } from '@/domain/models/app/automations/actions/instance/logs'
import {
  resolveJournalctlPath,
  resolveSystemctlPath,
} from '@/domain/models/process-env/host-actions'
import {
  checkedSlug,
  discard,
  fail,
  fsStep,
  GROUP_READABLE_MODE,
  instanceDir,
  isMissing,
  probeInstance,
  readBundleEntries,
  readRelease,
  removeRelease,
  rollbackRelease,
  writeRelease,
} from './instance-releases'

/**
 * `InstanceSupervisor` over systemd (`systemctl`, `journalctl`) and the
 * instances directory (`instance-releases.ts`).
 *
 * The host defines, per supervised app `<slug>`: `sovrium-app@<slug>.service`
 * (the app), `sovrium-app@<slug>.socket` (wakes it on the first request),
 * `sovrium-proxy@<slug>.service` (the idle-exit proxy between them), and the
 * one-shot `sovrium-backup@<slug>.service` / `sovrium-restore@<slug>.service`,
 * which run `sovrium backup` / `sovrium restore` as the app's own user. The
 * host's polkit rule grants this process `start`, `stop` and `restart` on those
 * units and nothing else, which is why no other verb is ever asked.
 *
 * Every command is an argv — never a shell line — whose only caller value is
 * the slug, re-checked here before it is used.
 */

type Runner = Effect.Success<typeof ProcessRunner>

/** Time limit of a unit command that only queues or reads a job. */
const UNIT_COMMAND_TIMEOUT_MS = 60_000

/** Output kept from `systemctl`, whose answers are a few lines. */
const UNIT_COMMAND_MAX_OUTPUT = 64 * 1024

/** Output kept from `journalctl`: 1000 lines of a few kilobytes at most. */
const JOURNAL_MAX_OUTPUT = 4 * 1024 * 1024

const UNIT_ACTIVE_STATES: ReadonlySet<string> = new Set([
  'active',
  'inactive',
  'failed',
  'activating',
  'deactivating',
])

const unit = {
  app: (slug: string) => `sovrium-app@${slug}.service`,
  socket: (slug: string) => `sovrium-app@${slug}.socket`,
  proxy: (slug: string) => `sovrium-proxy@${slug}.service`,
  backup: (slug: string) => `sovrium-backup@${slug}.service`,
  restore: (slug: string) => `sovrium-restore@${slug}.service`,
} as const

/** Parse `systemctl show` output, `Key=Value` per line, in whatever order systemd prints them. */
const parseShow = (stdout: string): InstanceUnitStatus => {
  const fields = new Map(
    stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)] as const)
  )
  const integer = (key: string): number | undefined => {
    const raw = fields.get(key) ?? ''
    return /^\d+$/.test(raw) ? Number(raw) : undefined
  }
  const active = fields.get('ActiveState') ?? ''
  const mainPid = integer('MainPID')
  const memory = integer('MemoryCurrent')
  return {
    active: UNIT_ACTIVE_STATES.has(active) ? active : 'unknown',
    sub: fields.get('SubState') ?? 'unknown',
    ...(mainPid !== undefined && mainPid > 0 ? { mainPid } : {}),
    restarts: integer('NRestarts') ?? 0,
    // systemd prints 2^64-1 for "no figure" on some versions, `[not set]` on others.
    ...(memory !== undefined && memory < Number.MAX_SAFE_INTEGER ? { memoryBytes: memory } : {}),
  }
}

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

const control = (runner: Runner, slug: string, verb: 'start' | 'stop' | 'restart') =>
  checkedSlug(slug).pipe(
    Effect.flatMap((s) =>
      verb === 'start'
        ? systemctl(runner, ['start', unit.socket(s)])
        : verb === 'stop'
          ? // Socket first: while it listens, the next request would start the app again.
            systemctl(runner, ['stop', unit.socket(s), unit.proxy(s), unit.app(s)])
          : systemctl(runner, ['restart', unit.app(s)])
    ),
    Effect.asVoid,
    Effect.withSpan('instance.control', { attributes: { 'instance.verb': verb } })
  )

const status = (runner: Runner, slug: string) =>
  checkedSlug(slug).pipe(
    Effect.flatMap((s) =>
      systemctl(runner, [
        'show',
        '--property=ActiveState,SubState,MainPID,NRestarts,MemoryCurrent',
        unit.app(s),
      ])
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

const backup = Effect.fn('instance.backup')(function* (
  runner: Runner,
  slug: string,
  timeoutMs: number
) {
  const dir = yield* instanceDir(slug)
  const s = yield* checkedSlug(slug)
  const archivePath = join(dir, 'backup', 'backup.tar.gz')
  yield* systemctl(runner, ['start', unit.backup(s)], timeoutMs)
  const bytes = yield* fsStep(`read ${archivePath}`, () =>
    readFile(archivePath).catch((cause: unknown) => {
      if (isMissing(cause)) return undefined
      throw cause
    })
  )
  yield* discard(archivePath)
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
    yield* fsStep(`write ${archivePath}`, async () => {
      await mkdir(dirname(archivePath), { recursive: true })
      await writeFile(archivePath, archive, { mode: GROUP_READABLE_MODE })
      await chmod(archivePath, GROUP_READABLE_MODE)
    })
    yield* control(runner, s, 'stop')
    // A failed restore unit ends the step here: the app stays stopped, never half-restored.
    yield* systemctl(runner, ['start', unit.restore(s)], timeoutMs)
    yield* control(runner, s, 'start')
  }).pipe(Effect.ensuring(discard(archivePath)))
})

export const SystemdSupervisorLive = Layer.effect(
  InstanceSupervisor,
  Effect.gen(function* () {
    const runner = yield* ProcessRunner
    return InstanceSupervisor.of({
      status: (slug) => status(runner, slug),
      control: (slug, verb) => control(runner, slug, verb),
      logs: (slug, options) => logs(runner, slug, options),
      backup: (slug, timeoutMs) => backup(runner, slug, timeoutMs),
      restore: (slug, archive, timeoutMs) => restore(runner, slug, archive, timeoutMs),
      readRelease,
      writeRelease,
      rollbackRelease,
      removeRelease,
      probe: probeInstance,
      readBundleEntries,
    })
  })
)
