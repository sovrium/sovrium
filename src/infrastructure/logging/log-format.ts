/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_LOG_FORMAT=json`: one JSON object per line, for a log collector.
 *
 * The server writes through three funnels — the structured logger
 * (`observability-runtime.ts`), the CLI's document and journal printers
 * (`cli-output.ts`, which print the startup banner) and the error-chain dump
 * (`telemetry-sink.ts`). Each asks this module how to write, so switching the
 * format here switches every line the server writes, and the stream each line
 * goes to does not change: debug and info on stdout, warnings and errors on
 * stderr.
 *
 * The format is ACTIVATED by `sovrium start`, not read from the environment by
 * each writer: a variable exported in a shell must not turn `sovrium validate`
 * or `sovrium docs` into JSON, and the boot gate has already refused a value
 * that is neither `text` nor `json` by the time anything is served.
 *
 * What it cannot reach: native code writing to the process streams directly,
 * and the runtime's own report of a crash. The documentation says so.
 */

import { formatWithOptions } from 'node:util'
import { Console, Effect } from 'effect'

/** The two shapes a server's output can take. */
export type LogFormat = 'text' | 'json'

/** A record's level, as the JSON shape spells it. */
export type JsonLogLevel = 'debug' | 'info' | 'warn' | 'error'

const state = new Map<'format', LogFormat>()

/** Whether the server writes JSON. */
export const isJsonLogFormat = (): boolean => state.get('format') === 'json'

/** The keys every record carries, which an attribute may not overwrite. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['time', 'level', 'message'])

/**
 * One record as one line of JSON (no trailing newline): `time` (ISO 8601),
 * `level`, `message`, then the record's attributes as further keys. An
 * attribute named like a reserved key is dropped rather than allowed to forge
 * the time, level or message of the line.
 */
export const formatJsonLogRecord = (
  level: string,
  message: string,
  date: Readonly<Date>,
  attributes: Readonly<Record<string, unknown>> = {}
): string =>
  JSON.stringify({
    time: date.toISOString(),
    level: level.toLowerCase(),
    message,
    ...Object.fromEntries(Object.entries(attributes).filter(([key]) => !RESERVED_KEYS.has(key))),
  })

/**
 * One write as one record, newline-terminated: a multi-line block — the
 * banner, an error's cause chain — stays one event, its line breaks escaped
 * inside `message`, rather than becoming a dozen records a collector would
 * have to stitch back together. An all-blank write writes nothing.
 */
const asJsonRecord = (text: string, level: JsonLogLevel): string => {
  const message = text.replace(/^\n+|\n+$/g, '')
  return message.trim() === '' ? '' : `${formatJsonLogRecord(level, message, new Date())}\n`
}

/**
 * A journal line printed as a warning reads `HH:MM:SS Warning: …`; everything
 * else that reaches stderr outside the logger is an error.
 */
const stderrLevel = (text: string): JsonLogLevel =>
  /^(?:\d{2}:\d{2}:\d{2} )?Warning:/.test(text.trimStart()) ? 'warn' : 'error'

/**
 * Print `text` to stdout: unchanged through `Console.log` in text format, as
 * one `info` record in JSON format.
 */
export const logToStdout = (text: string): Effect.Effect<void> =>
  isJsonLogFormat()
    ? Effect.sync(() => {
        process.stdout.write(asJsonRecord(text, 'info'))
      })
    : Console.log(text)

/**
 * Write `text` to stderr: unchanged in text format, as one record in JSON
 * format — `warn` for a journal warning, `error` for anything else.
 */
export const writeStderrText = (text: string): void => {
  process.stderr.write(isJsonLogFormat() ? asJsonRecord(text, stderrLevel(text)) : `${text}\n`)
}

/** Remove terminal colour escapes: a JSON record is read by a machine, not a terminal. */
// eslint-disable-next-line no-control-regex -- matching the ESC byte is the point
const stripAnsi = (text: string): string => text.replace(/\x1B\[[0-9;]*m/g, '')

/** A `console` method that writes one record of `level` to `stream`. */
const consoleRoute =
  (level: JsonLogLevel, stream: NodeJS.WriteStream) =>
  (...args: readonly unknown[]): void => {
    stream.write(asJsonRecord(stripAnsi(formatWithOptions({ colors: false }, ...args)), level))
  }

/**
 * Switch every writer to `format` for the rest of the process.
 *
 * In JSON format the global `console` is routed through the same records, so
 * a dependency that prints through it — the CSS optimiser's warnings when the
 * stylesheet is compiled at boot, an authentication library's notices — writes
 * JSON too, its terminal colours stripped, on the stream its level belongs to.
 */
export const activateLogFormat = (format: LogFormat): void => {
  state.set('format', format)
  if (format !== 'json') return
  Object.assign(console, {
    log: consoleRoute('info', process.stdout),
    info: consoleRoute('info', process.stdout),
    debug: consoleRoute('debug', process.stdout),
    warn: consoleRoute('warn', process.stderr),
    error: consoleRoute('error', process.stderr),
  })
}
