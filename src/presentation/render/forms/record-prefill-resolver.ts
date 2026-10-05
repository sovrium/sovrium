/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared `$record.<field>` / `$parent.<field>` prefill-token resolver (plus
 * the request-side `$now` / `$user.<prop>` tokens a record page's prefill map
 * also accepts).
 *
 * Both the embedded-form `inlinePrefill` flow (Y-5, `form-ref-resolver.ts`)
 * and the config-editor record-context channel (GAP-I2,
 * `editors/editor-context-resolver.ts`) resolve the same `InlinePrefillSchema`
 * `prefill` map against the host page's `dataSource: { mode: 'single' }`
 * (or `collection`) record. Centralising the token grammar here keeps both
 * call sites on one definition — no parallel `submitContext` grammar.
 */

import { resolvePrefillEntry } from './form-prefill-resolver'
import type { NowTokenColumn } from '@/domain/kernel/time/now-token'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Prefill value supported by `inlinePrefill.prefill[<column>]`: a literal
 * scalar/array, or a `$record.<field>` / `$parent.<field>` token resolved
 * against the host record at render time.
 */
export type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * Shape of the `inlinePrefill` block (kept loose so consumers do not import
 * the schema types and accept both decoded and raw inputs).
 */
export interface InlinePrefillShape {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill?: boolean
}

/**
 * Type guard for `inlinePrefill` tolerant of both decoded schemas and bare
 * object inputs (test fixtures use `as never` to bypass typing). Validates
 * only the structural minimum: `prefill` is a non-null object. Per-key value
 * validation happens at substitution time.
 */
export function isInlinePrefill(value: unknown): value is InlinePrefillShape {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly prefill?: unknown }
  return typeof candidate.prefill === 'object' && candidate.prefill !== null
}

/**
 * The prefix-tokens that resolve a prefill value against the host page's
 * single-mode record. `$parent.<field>` is the inline-relationship token
 * (Y-5); `$record.<field>` is the platform-wide per-record token (GAP-I2) and
 * resolves identically — both look up the named segment on the same host
 * record supplied by `page-parent-resolver.ts` / the collection record.
 */
const RECORD_TOKEN_PREFIXES = ['$parent.', '$record.'] as const

/**
 * The request-side facts a record-page prefill map reads besides the host
 * record: the signed-in viewer (`$user.<prop>`) and the moment of the render
 * (`$now`, written the way each field's column reads it). All optional — with
 * no viewer a `$user` entry drops, and the field renders empty.
 */
export interface PrefillRequestTokens {
  readonly session?: SessionInfo | undefined
  readonly now?: Date
  readonly columns?: Readonly<Record<string, NowTokenColumn>>
}

/** The signed-in viewer as `$user.<prop>` reads it: `id`, `email`, `name`. */
export function prefillUserOf(
  session: SessionInfo | undefined
): Readonly<Record<string, unknown>> | undefined {
  if (session === undefined) return undefined
  return {
    id: session.userId,
    ...(session.email === undefined ? {} : { email: session.email }),
    ...(session.name === undefined ? {} : { name: session.name }),
  }
}

/**
 * The columns of `tableName`, keyed by name, as `$now` needs them — so a
 * date-only column is stamped with the day and every other with the instant.
 */
export function prefillColumnsOf(
  tables: Tables | undefined,
  tableName: string | undefined
): Readonly<Record<string, NowTokenColumn>> {
  const table = tables?.find((t) => t.name === tableName)
  if (table === undefined) return {}
  return Object.fromEntries(
    table.fields.map((field) => {
      const { includeTime } = field as { readonly includeTime?: unknown }
      return [
        field.name,
        { type: field.type, ...(includeTime === true ? { includeTime: true } : {}) },
      ] as const
    })
  )
}

/**
 * A value that is not a record token: `$now`, `$user.<prop>` or a literal,
 * resolved exactly as a form's own `prefill` map resolves it.
 */
function resolveRequestToken(
  key: string,
  value: string,
  tokens: PrefillRequestTokens
): PrefillValue | undefined {
  const user = prefillUserOf(tokens.session)
  return resolvePrefillEntry(key, value, {
    query: {},
    ...(user === undefined ? {} : { user }),
    ...(tokens.now === undefined ? {} : { now: tokens.now }),
    ...(tokens.columns === undefined ? {} : { columns: tokens.columns }),
  })
}

/**
 * Resolve a single prefill value against the host page's record.
 *
 * - String tokens `'$parent.<segment>'` / `'$record.<segment>'` look up the
 *   segment on the host record; a missing segment resolves to `undefined`.
 * - `$now` and `$user.<prop>` resolve against the request, exactly as they
 *   do in a form's own `prefill` map (`resolvePrefillEntry`); a `$user`
 *   token with no signed-in viewer drops.
 * - Any other literal (a plain string, number, boolean, or array) passes
 *   through unchanged — useful for static defaults sitting alongside
 *   record-derived values.
 *
 * Kept synchronous and pure: the host record is supplied by the caller, so
 * this helper has no I/O concerns.
 */
function resolveRecordPrefillValue(
  key: string,
  value: PrefillValue,
  parentRecord: Readonly<Record<string, unknown>> | undefined,
  tokens: PrefillRequestTokens
): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  const prefix = RECORD_TOKEN_PREFIXES.find((p) => value.startsWith(p))
  if (prefix === undefined) return resolveRequestToken(key, value, tokens)
  if (parentRecord === undefined) return undefined
  const segment = value.slice(prefix.length)
  const resolved = parentRecord[segment]
  if (resolved === undefined || resolved === null) return undefined
  if (Array.isArray(resolved)) {
    // Multi-relationship arrays come back as Postgres TEXT[] (string[]).
    return resolved.filter((item): item is string => typeof item === 'string')
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
  return String(resolved)
}

/**
 * Resolve every prefill entry against the host record.
 *
 * Returns an empty map when `inlinePrefill` is missing, when the host page
 * has no parent record (e.g. a list-mode dataSource), or when every value
 * resolved to `undefined`. Filtering empties here keeps callers simple.
 */
export function resolveRecordPrefillMap(
  inlinePrefill: InlinePrefillShape | undefined,
  parentRecord: Readonly<Record<string, unknown>> | undefined,
  tokens: PrefillRequestTokens = {}
): Readonly<Record<string, PrefillValue>> {
  if (inlinePrefill === undefined) return {}
  const entries = Object.entries(inlinePrefill.prefill)
    .map(([key, raw]): readonly [string, PrefillValue | undefined] => [
      key,
      resolveRecordPrefillValue(key, raw, parentRecord, tokens),
    ])
    .filter((entry): entry is readonly [string, PrefillValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}
