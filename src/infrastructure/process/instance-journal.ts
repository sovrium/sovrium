/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bounded journal read an unhealthy `instance/health` probe carries: which
 * window `journalctl` reads, and how much of what it printed is kept.
 *
 * Neither value is ever a caller's. The window is the release time `apply`
 * recorded in `status.json`, re-checked here, or a fixed relative fallback.
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
 * `--since=` value from reading the release record: a `status.json` that cannot
 * be read or parsed is no reason to drop the journal of an app that is down —
 * it reads the fixed fallback window instead, and the failure is logged.
 */
export const crashJournalWindow = <E, R>(
  release: Effect.Effect<{ readonly appliedAt?: string } | undefined, E, R>
): Effect.Effect<string, never, R> =>
  release.pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('instance: status.json unreadable, reading the fallback window', cause)
    ),
    // The journal is what explains a crash; a broken release record must not hide it.
    Effect.orElseSucceed(() => undefined),
    Effect.map((recorded) => crashJournalSince(recorded?.appliedAt))
  )

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
