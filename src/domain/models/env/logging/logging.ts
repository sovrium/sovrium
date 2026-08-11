/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Logging verbosity environment configuration.
 *
 * The single source of truth for the process log level, resolved from
 * `LOG_LEVEL` (with a `NODE_ENV=development` fallback). Both logging gates read
 * it — the stdout logger and the OTLP tee, now unified in
 * `src/infrastructure/telemetry/observability-runtime.ts` — so the console and
 * the exported records can never disagree about what "debug" means.
 *
 * Behaviour is deliberately binary today: only `debug` vs. non-`debug` changes
 * anything. `info`/`warn`/`error` all print AND export (the locked dual-write
 * contract —); `warn`/`error` are accepted
 * and recorded but do NOT suppress `info`. Level-based suppression of info/warn
 * is a separate, unshipped concern.
 *
 * Resolution (preserving the historical `LOG_LEVEL==='debug' || dev` gate):
 *   - `LOG_LEVEL=debug`, OR `NODE_ENV=development` → `debug` (development is
 *     verbose and is NOT overridden by a non-debug `LOG_LEVEL`)
 *   - `LOG_LEVEL` = `info` | `warn` | `error` (case-sensitive) → that level
 *   - unset / unrecognized → `info`
 */

/** A read-only `process.env`-shaped map (the only input this module reads). */
type EnvRecord = Readonly<Record<string, string | undefined>>

/** The four recognized log levels, most-verbose first. */
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error'

/** The resolved logging configuration. */
export interface LoggingConfig {
  /** The effective log level (only `debug` vs. non-`debug` changes behavior today). */
  readonly level: LogLevelName
}

/** Trim a value and treat empty (or unset) as "not provided". */
const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

/**
 * Resolve the logging configuration from the environment. Never throws: an
 * unrecognized `LOG_LEVEL` falls back to `info` (matching the historical
 * "only `debug` is special-cased" behaviour), so a loosely-set operator value
 * never fails boot.
 */
export const parseLoggingConfig = (env: EnvRecord = process.env): LoggingConfig => {
  const raw = clean(env['LOG_LEVEL'])
  // Development is verbose, and an explicit LOG_LEVEL=debug always wins. Neither
  // is overridden by a non-debug LOG_LEVEL — this is the historical gate.
  if (raw === 'debug' || clean(env['NODE_ENV']) === 'development') {
    return { level: 'debug' }
  }
  if (raw === 'info' || raw === 'warn' || raw === 'error') {
    return { level: raw }
  }
  return { level: 'info' }
}

/** Whether debug-level logging is active for the given (or ambient) config. */
export const isDebugLevel = (config: LoggingConfig = parseLoggingConfig()): boolean =>
  config.level === 'debug'
