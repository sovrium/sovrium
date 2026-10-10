/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bounded journal read an unhealthy `instance/health` probe carries: the
 * line summing up the unit, which run or window `journalctl` reads, and how
 * much of what it printed is kept.
 *
 * Nothing here is ever a caller's. The run is the invocation id systemd
 * reports, re-checked here; the window is the release time `status.json`
 * records, re-checked here, or a fixed relative fallback.
 */

import { Effect } from 'effect'

/** Lines read: a boot crash is a stack trace plus systemd's exit line. */
export const CRASH_JOURNAL_LINES = 50

/** Bytes of journal text kept in the step output; the oldest lines go first. */
export const CRASH_JOURNAL_MAX_BYTES = 16 * 1024

/** Time limit of the read, separate from the probe's own. */
export const CRASH_JOURNAL_TIMEOUT_MS = 5000

/** The window when no release time was recorded. */
export const CRASH_JOURNAL_FALLBACK_SINCE = '-5min'

/**
 * The RFC 3339 UTC shape `apply` records (`2026-10-08T09:14:03.218Z`). systemd
 * parses it from version 255 on; it keeps at most six fraction digits.
 */
const APPLIED_AT_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

/** `--since=` value: the recorded release time as written, or the fixed fallback. */
export const crashJournalSince = (appliedAt: string | undefined): string =>
  appliedAt !== undefined && APPLIED_AT_SHAPE.test(appliedAt)
    ? appliedAt
    : CRASH_JOURNAL_FALLBACK_SINCE

/**
 * The release time the crash journal anchors on: the last rollback's time when
 * one is recorded, else the time the current revision was applied. A
 * `status.json` that cannot be read or parsed is no reason to drop the journal
 * of an app that is down — it is read as recording no time, and the failure is
 * logged.
 */
export const crashJournalReleaseTime = <E, R>(
  release: Effect.Effect<
    { readonly appliedAt?: string; readonly rolledBackAt?: string } | undefined,
    E,
    R
  >
): Effect.Effect<string | undefined, never, R> =>
  release.pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('instance: status.json unreadable, reading the fallback window', cause)
    ),
    // The journal is what explains a crash; a broken release record must not hide it.
    Effect.orElseSucceed(() => undefined),
    Effect.map((recorded) => recorded?.rolledBackAt ?? recorded?.appliedAt)
  )

/** What `systemctl show --timestamp=unix` reports about the app's unit, for the crash journal. */
export interface UnitRunFacts {
  readonly active: string
  readonly sub: string
  readonly result?: string
  readonly execMainStatus?: number
  /** The unit's current run, only when it is 32 hex digits — the one shape that reaches argv. */
  readonly invocationId?: string
  /** When that run's main process started, in unix seconds. */
  readonly startedAtSeconds?: number
}

/** The shape of a systemd invocation id: 128 bits as 32 lowercase hex digits. */
export const INVOCATION_ID_SHAPE = /^[0-9a-f]{32}$/

/** The line that opens the journal: what systemd reports about the unit. */
export const unitSummaryLine = (unit: string, facts: UnitRunFacts): string =>
  `${unit} is ${facts.active} (sub-state ${facts.sub}, result ${facts.result ?? 'unknown'}, main process exit status ${facts.execMainStatus === undefined ? 'unknown' : String(facts.execMainStatus)})`

/** The line that stands for the journal when no process has started since the release. */
export const nothingStartedLine = (unit: string, releaseTime: string): string =>
  `no process of ${unit} has started since ${releaseTime}`

/** Which journal an unhealthy probe reads. */
export type CrashJournalRead =
  /** The lines of the unit's current run, by its invocation id. */
  | { readonly _tag: 'Invocation'; readonly invocationId: string }
  /** No read: the current run started before the release, so every line predates it. */
  | { readonly _tag: 'NothingSince'; readonly releaseTime: string }
  /** The unit's lines since `since` — no run is named, or systemd could not be asked. */
  | { readonly _tag: 'Window'; readonly since: string }

/** The release time in whole unix seconds, when it is the recorded shape. */
const releaseSeconds = (releaseTime: string | undefined): number | undefined =>
  releaseTime !== undefined && APPLIED_AT_SHAPE.test(releaseTime)
    ? Math.floor(Date.parse(releaseTime) / 1000)
    : undefined

/**
 * Decide which journal to read. A run systemd names is read by its id, unless
 * its process provably started before the release (both times known, compared
 * in whole seconds — systemd prints the start in seconds); then nothing is
 * read. With no run named — the unit has not started since the host booted, or
 * `systemctl show` failed (`facts` undefined) — the unit is read by time.
 */
export const crashJournalRead = (
  facts: UnitRunFacts | undefined,
  releaseTime: string | undefined
): CrashJournalRead => {
  const invocationId = facts?.invocationId
  if (invocationId === undefined || !INVOCATION_ID_SHAPE.test(invocationId)) {
    return { _tag: 'Window', since: crashJournalSince(releaseTime) }
  }
  const release = releaseSeconds(releaseTime)
  const started = facts?.startedAtSeconds
  return releaseTime !== undefined &&
    release !== undefined &&
    started !== undefined &&
    started < release
    ? { _tag: 'NothingSince', releaseTime }
    : { _tag: 'Invocation', invocationId }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** `line` cut to at most `maxBytes` UTF-8 bytes, never inside a character. */
const cutToBytes = (line: string, maxBytes: number): string => {
  const bytes = encoder.encode(line)
  if (bytes.byteLength <= maxBytes) return line
  // Back off to a character boundary: a UTF-8 continuation byte is 0b10xxxxxx.
  const end = Array.from({ length: 4 }, (_, back) => Math.max(maxBytes - back, 0)).find(
    (at) => at === 0 || ((bytes[at] ?? 0) & 0xc0) !== 0x80
  )
  return decoder.decode(bytes.subarray(0, end ?? 0))
}

/**
 * The newest lines whose UTF-8 bytes, one newline each, fit `maxBytes`, oldest
 * first. Dropping from the oldest end keeps systemd's exit line and the error
 * that precedes it. A newest line longer than the cap alone is cut to it and
 * kept, so a journal is never emptied by its own last line.
 */
export const keepNewestJournalLines = (
  lines: readonly string[],
  maxBytes: number = CRASH_JOURNAL_MAX_BYTES
): readonly string[] =>
  lines.reduceRight<{
    readonly kept: readonly string[]
    readonly bytes: number
    readonly full: boolean
  }>(
    (acc, line) => {
      if (acc.full) return acc
      const bytes = acc.bytes + encoder.encode(line).byteLength + 1
      if (bytes <= maxBytes) return { kept: [line, ...acc.kept], bytes, full: false }
      if (acc.kept.length > 0 || maxBytes < 2) return { ...acc, full: true }
      return { kept: [cutToBytes(line, maxBytes - 1)], bytes: maxBytes, full: true }
    },
    { kept: [], bytes: 0, full: false }
  ).kept
