/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The observability runtime's terminal sink: how one log record is rendered
 * as a line ({@link formatStdoutLogLine}) and which stream it is written to
 * ({@link stdoutLogger}). The runtime (`observability-runtime.ts`) installs the
 * sink in every runtime it builds, OTLP or not.
 */

import { Logger, References } from 'effect'
import { redactBoundQueryValues } from '@/domain/kernel/sanitize/bound-value-redaction'
import { formatClock } from '@/infrastructure/logging/cli-output'
import { formatJsonLogRecord, isJsonLogFormat } from '@/infrastructure/logging/log-format'
import { isProduction } from '@/infrastructure/process/env'

/**
 * Render one structured log line for the terminal — the pure half of
 * {@link stdoutLogger}, extracted so both shapes are testable without capturing
 * a process stream.
 *
 * PRODUCTION keeps `[ISO] [LEVEL] msg`, byte for byte (T43): journald, Scalingo
 * and the OTLP tee already parse it. The `.toUpperCase()` below is
 * load-bearing for exactly that reason — v3 read `logLevel.label`, which was
 * already UPPERCASE (`'WARN'`), while v4's `logLevel` IS the string and it is
 * title-case (`'Warn'`).
 *
 * OUTSIDE PRODUCTION the line joins the journal (T39): `HH:MM:SS <message>`,
 * where the message already opens with its own `[area]` tag by the convention
 * in `logging/logger.ts`. Severity is the WORD, after the clock (T41) — never a
 * `[LEVEL]` bracket, which T34 exists to refuse, and never a glyph (T11).
 *
 * `SOVRIUM_LOG_FORMAT=json` replaces both with one JSON object (`log-format.ts`),
 * the record's annotations as top-level keys. The `date` is the one
 * `Logger.make` hands the callback: the instant of the record, not of formatting.
 */
export const formatStdoutLogLine = (
  label: string,
  message: string,
  date: Readonly<Date>,
  annotations: Readonly<Record<string, unknown>> = {}
): string => {
  if (isJsonLogFormat()) return formatJsonLogRecord(label, message, date, annotations)
  if (isProduction()) return `[${date.toISOString()}] [${label}] ${message}`
  const severity = label === 'ERROR' ? 'Error: ' : label === 'WARN' ? 'Warning: ' : ''
  return `${formatClock(date)} ${severity}${message}`
}

/**
 * The stdout sink. debug/info → stdout, warn/error → stderr (matching
 * `Console.debug/log` vs `Console.warn/error`). The error `cause` stack is
 * written by the `logError` helper, not here.
 *
 * The routing is deliberately shape-independent: the stream carries severity in
 * BOTH shapes (T31), so a development journal and a production log agree about
 * where a warning goes even though they disagree about how it reads.
 */
export const stdoutLogger = Logger.make(({ logLevel, message, date, fiber }) => {
  const label = logLevel.toUpperCase()
  const annotations = fiber.getRef(References.CurrentLogAnnotations)
  // Redacted here, at the sink, because this is where EVERY log line on the
  // runtime lands — `emitLog`, and any `Effect.log*` carrying a cause, whose
  // rendering includes a failed query's bound values when one is underneath.
  const text = redactBoundQueryValues(String(message))
  const line = `${formatStdoutLogLine(label, text, date, annotations)}\n`
  const toStderr = label === 'ERROR' || label === 'WARN'
  ;(toStderr ? process.stderr : process.stdout).write(line)
})
