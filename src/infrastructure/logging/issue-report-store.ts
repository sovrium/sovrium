/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isOperatorFix, type OperatorFix } from '@/domain/errors/operator-fixable-error'
import { parseDataDir } from '@/domain/models/process-env/data-dir'

/**
 * The failures a project keeps so they can be reported after the terminal or
 * the log has scrolled away — `sovrium report --last-error` and
 * `sovrium report --request-id <id>` read them, offline.
 *
 * Everything written here is ALREADY scrubbed by the caller (secrets redacted,
 * paths stripped): this module stores text, it never decides what is safe.
 * Both files live under `<data dir>/reports/` and are bounded — one last CLI
 * failure, and at most {@link SERVER_FAILURE_LIMIT} server errors.
 *
 * Every write is best effort: a report that cannot be kept must never turn the
 * failure being reported into a second one, so a failed write is logged to
 * stderr and dropped.
 */

/** The last failure a CLI command printed a report for. */
export interface KeptCliFailure {
  readonly url: string
  readonly title: string
  readonly at: string
}

/** One internal error the server answered, by the request id it answered with. */
export interface KeptServerFailure {
  readonly requestId: string
  readonly errorClass: string
  readonly signature: string
  readonly logs: string
  readonly at: string
  /**
   * Set when the failure is the operator's to fix rather than an engine
   * defect: the code of the fix, and no report is offered for it.
   */
  readonly fix?: OperatorFix
}

/** How many server errors are kept; the oldest is dropped first. */
export const SERVER_FAILURE_LIMIT = 50

/** The longest error text kept per server error. */
const MAX_KEPT_LOGS = 4000

const LAST_FAILURE_FILE = 'last-error.json'

const reportsDir = (dataDir: string): string => join(dataDir, 'reports')

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    // Absent or unreadable: nothing was kept.
    return undefined
  }
}

/** Write through a temporary file and a rename, so a reader never sees half a file. */
const writeJson = (dataDir: string, file: string, value: unknown): void => {
  try {
    const dir = reportsDir(dataDir)
    // Owner-only, like the files in it: a kept error names the code paths it failed in.
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const target = join(dir, file)
    const temporary = `${target}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify(value, undefined, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, target)
  } catch (error) {
    // Best effort, by design: the failure being reported was already printed.
    process.stderr.write(
      `Warning: Sovrium could not keep a copy of this report (${error instanceof Error ? error.message : String(error)}).\n`
    )
  }
}

const isString = (value: unknown): value is string => typeof value === 'string'

/** Keep `failure` as the project's last CLI failure, replacing the one before. */
export const keepLastCliFailure = (
  failure: KeptCliFailure,
  dataDir: string = parseDataDir()
): void => writeJson(dataDir, LAST_FAILURE_FILE, failure)

/** The project's last CLI failure, if one was kept. */
export const readLastCliFailure = (
  dataDir: string = parseDataDir()
): KeptCliFailure | undefined => {
  const kept = readJson(join(reportsDir(dataDir), LAST_FAILURE_FILE)) as
    Partial<Record<keyof KeptCliFailure, unknown>> | undefined
  if (kept === undefined || !isString(kept.url) || !isString(kept.title) || !isString(kept.at)) {
    return undefined
  }
  return { url: kept.url, title: kept.title, at: kept.at }
}

const isServerFailure = (value: unknown): value is KeptServerFailure => {
  if (value === null || typeof value !== 'object') return false
  const entry = value as Partial<Record<keyof KeptServerFailure, unknown>>
  return (
    isString(entry.requestId) &&
    isString(entry.errorClass) &&
    isString(entry.signature) &&
    isString(entry.logs) &&
    isString(entry.at) &&
    (entry.fix === undefined || isOperatorFix(entry.fix))
  )
}

// --- Server errors -------------------------------------------------------------
//
// The request id an error is kept under is the one the server answered with,
// and a caller may choose it (`X-Request-Id`). So the kept set is decided by
// rules a caller cannot turn against the operator:
//
// - the FIRST error kept under an id is the one reported under it — a later
//   request reusing the id never replaces it;
// - one signature keeps at most {@link SERVER_FAILURES_PER_SIGNATURE} entries,
//   its latest — so repeating one failure cannot push every other one out of
//   the {@link SERVER_FAILURE_LIMIT} most recent kept.
//
// Errors are APPENDED, one JSON line each, off the request path (the request
// only queues the write), and the rules are applied when the file is read.
// Every {@link SERVER_FAILURE_LIMIT} appends the file is rewritten to what the
// rules keep, which bounds it.
//
// The queue is a promise chain, not a resource: it holds no handle and no
// timer between writes (each opens and closes its own file), so there is
// nothing to release. A process that exits mid-queue loses only the writes
// still queued, which a best-effort copy can afford.

/** How many errors of one signature are kept; the oldest of them is dropped first. */
export const SERVER_FAILURES_PER_SIGNATURE = 5

const SERVER_FAILURES_FILE = 'server-errors.jsonl'

/** The errors the rules keep of `entries` (oldest first), oldest first. */
export const retainedServerFailures = (
  entries: readonly KeptServerFailure[]
): readonly KeptServerFailure[] => {
  const seenIds = new Set<string>()
  const firstPerId = entries.filter((entry) => {
    if (seenIds.has(entry.requestId)) return false
    seenIds.add(entry.requestId)
    return true
  })
  // Walk newest first so the latest of each signature are the ones counted in.
  const perSignature = new Map<string, number>()
  const capped = firstPerId.toReversed().filter((entry) => {
    const count = perSignature.get(entry.signature) ?? 0
    perSignature.set(entry.signature, count + 1)
    return count < SERVER_FAILURES_PER_SIGNATURE
  })
  return capped.slice(0, SERVER_FAILURE_LIMIT).toReversed()
}

const parseServerFailureLines = (text: string): readonly KeptServerFailure[] =>
  text.split('\n').flatMap((line) => {
    if (line.trim() === '') return []
    try {
      const value = JSON.parse(line) as unknown
      return isServerFailure(value) ? [value] : []
    } catch {
      // A torn or foreign line: not a kept error.
      return []
    }
  })

const toServerFailureLines = (entries: readonly KeptServerFailure[]): string =>
  entries.map((entry) => `${JSON.stringify(entry)}\n`).join('')

const readServerFailures = (dataDir: string): readonly KeptServerFailure[] => {
  try {
    const text = readFileSync(join(reportsDir(dataDir), SERVER_FAILURES_FILE), 'utf8')
    return retainedServerFailures(parseServerFailureLines(text))
  } catch {
    // Absent or unreadable: nothing was kept.
    return []
  }
}

/** The writes queued so far, one after another; never rejects. */
let pendingWrites: Promise<void> = Promise.resolve()

/**
 * Appends since this process last rewrote the file. Starts one short of the
 * limit, so a process's first append also rewrites what earlier runs left.
 */
let appendsSinceCompaction = SERVER_FAILURE_LIMIT - 1

/** Rewrite the file to what the rules keep, through a temporary file and a rename. */
const compactServerFailures = async (dir: string): Promise<void> => {
  const target = join(dir, SERVER_FAILURES_FILE)
  const kept = retainedServerFailures(parseServerFailureLines(await readFile(target, 'utf8')))
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, toServerFailureLines(kept), { mode: 0o600 })
  await rename(temporary, target)
}

const appendServerFailure = async (dataDir: string, entry: KeptServerFailure): Promise<void> => {
  const dir = reportsDir(dataDir)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await appendFile(join(dir, SERVER_FAILURES_FILE), toServerFailureLines([entry]), {
    mode: 0o600,
  })
  appendsSinceCompaction += 1
  if (appendsSinceCompaction >= SERVER_FAILURE_LIMIT) {
    appendsSinceCompaction = 0
    await compactServerFailures(dir)
  }
}

/**
 * Keep one server error. Returns at once: the write is queued behind the ones
 * before it and runs off the request path; {@link flushServerFailures} waits
 * for it. A failed write is reported on stderr and dropped.
 */
export const keepServerFailure = (
  failure: KeptServerFailure,
  dataDir: string = parseDataDir()
): void => {
  const entry = { ...failure, logs: failure.logs.slice(0, MAX_KEPT_LOGS) }
  pendingWrites = pendingWrites
    .then(() => appendServerFailure(dataDir, entry))
    .catch((error: unknown) => {
      // Best effort, by design: the error was already answered and logged.
      process.stderr.write(
        `Warning: Sovrium could not keep a copy of this report (${error instanceof Error ? error.message : String(error)}).\n`
      )
    })
}

/** Resolves once every server error queued so far is on disk (or dropped). */
export const flushServerFailures = (): Promise<void> => pendingWrites

/** The server error answered under `requestId`, if this project kept it. */
export const findServerFailure = (
  requestId: string,
  dataDir: string = parseDataDir()
): KeptServerFailure | undefined =>
  readServerFailures(dataDir).find((failure) => failure.requestId === requestId)

/**
 * The most recent server error this project kept that `accept` takes, if any.
 * Waits for the writes already queued, so an error answered a moment ago is
 * counted. Never rejects: an unreadable file is nothing kept.
 */
export const findLatestServerFailure = async (
  accept: (failure: KeptServerFailure) => boolean = () => true,
  dataDir: string = parseDataDir()
): Promise<KeptServerFailure | undefined> => {
  await flushServerFailures()
  return readServerFailures(dataDir).findLast(accept)
}
