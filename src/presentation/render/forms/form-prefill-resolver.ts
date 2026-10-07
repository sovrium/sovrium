/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a standalone form's `forms[].prefill` map into concrete initial
 * field values at render time.
 *
 * The `prefill` map keys are form-field names; values are either literal
 * defaults (string / number / boolean) or `$`-rooted references:
 *   - `$query.<name>` — read from the request URL query string.
 *   - `$now`          — the moment of the render, written the way the field's
 *     column reads it (`resolveNowToken`, shared with submit-time defaults).
 *   - `$user.<prop>`  — read from the authenticated user context. Resolves
 *     ONLY when a user context is supplied (the form's access required auth
 *     AND a session was present). When absent, the entry is dropped so the
 *     literal token never leaks into the rendered HTML.
 *
 * Unresolvable references (missing query param, missing user prop, or a
 * `$user.*` token with no session) are filtered out, leaving the field to
 * render empty — never the raw `$query.x` / `$user.x` literal.
 *
 * Unknown `$`-roots (e.g. a hypothetical `$record.x`) are treated as opaque
 * literals and passed through verbatim, mirroring the prefill schema's
 * union-fallback semantics.
 */

import { NOW_TOKEN, resolveNowToken, type NowTokenColumn } from '@/domain/kernel/time/now-token'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'

type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * The render-time inputs the resolver reads `$`-references against. Both
 * are optional: anonymous renders supply only `query`, authenticated forms
 * additionally supply a flat `user` record (e.g. `{ email, id, ... }`).
 */
export interface FormPrefillContext {
  readonly query: Readonly<Record<string, string>>
  readonly user?: Readonly<Record<string, unknown>>
  /**
   * The choices read from tables for this request (`resolveFormOptionSources`),
   * keyed by field submit identifier. Not a prefill, but the same kind of
   * thing: a fact about THIS request the config cannot state, handed to the
   * render alongside the query and the visitor.
   */
  readonly optionSets?: FormOptionSets
  /** The instant `$now` stands for; the moment of resolution when omitted. */
  readonly now?: Date
  /** The column each field lands in, keyed by field name, so `$now` is written as it reads. */
  readonly columns?: Readonly<Record<string, NowTokenColumn>>
  /** A private link this page was opened from: a resumed draft, or an edit. */
  readonly link?: FormLinkState
}

/**
 * What a resume or edit link brings to the page: the answers to restore (over
 * every starting value), whether a resume link found nothing (the notice), and
 * where the form posts instead of the plain submission endpoint.
 */
export interface FormLinkState {
  readonly answers?: Readonly<Record<string, unknown>>
  readonly unavailable?: boolean
  readonly action?: string
  readonly editing?: boolean
}

/** `$query.<name>`: the named query-string parameter, when present and non-empty. */
function resolveQueryReference(name: string, ctx: FormPrefillContext): PrefillValue | undefined {
  const param = ctx.query[name]
  return typeof param === 'string' && param !== '' ? param : undefined
}

/** `$user.<prop>`: a property of the signed-in user; nothing with no session. */
function resolveUserReference(prop: string, ctx: FormPrefillContext): PrefillValue | undefined {
  const resolved = ctx.user?.[prop]
  if (resolved === undefined || resolved === null) return undefined
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
  return String(resolved)
}

function resolveReference(
  key: string,
  value: string,
  ctx: FormPrefillContext
): PrefillValue | undefined {
  if (value === NOW_TOKEN) return resolveNowToken(ctx.now ?? serverNow(), ctx.columns?.[key])
  if (value.startsWith('$query.')) return resolveQueryReference(value.slice('$query.'.length), ctx)
  if (value.startsWith('$user.')) return resolveUserReference(value.slice('$user.'.length), ctx)
  // Any other `$`-rooted token (or plain literal string) passes through
  // unchanged — the engine only resolves the documented roots.
  return value
}

/**
 * Resolve ONE prefill entry (`key` names the field, so `$now` can be written the
 * way its column reads it). Exported for the record-page prefill map, which
 * resolves its own `$parent` / `$record` tokens and hands every other value here.
 */
export function resolvePrefillEntry(
  key: string,
  value: PrefillValue,
  ctx: FormPrefillContext
): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  return resolveReference(key, value, ctx)
}

/**
 * Resolve every `prefill` entry against the render-time context, dropping
 * any entry that resolves to `undefined`. Returns an empty map when the
 * form declares no `prefill`.
 */
export function resolveFormPrefill(
  prefill: Readonly<Record<string, PrefillValue>> | undefined,
  ctx: FormPrefillContext
): Readonly<Record<string, PrefillValue>> {
  if (prefill === undefined) return {}
  const entries = Object.entries(prefill)
    .map(([key, raw]): readonly [string, PrefillValue | undefined] => [
      key,
      resolvePrefillEntry(key, raw, ctx),
    ])
    .filter((entry): entry is readonly [string, PrefillValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}
