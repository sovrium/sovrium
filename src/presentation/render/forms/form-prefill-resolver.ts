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

type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * The render-time inputs the resolver reads `$`-references against. Both
 * are optional: anonymous renders supply only `query`, authenticated forms
 * additionally supply a flat `user` record (e.g. `{ email, id, ... }`).
 */
export interface FormPrefillContext {
  readonly query: Readonly<Record<string, string>>
  readonly user?: Readonly<Record<string, unknown>>
}

function resolveReference(value: string, ctx: FormPrefillContext): PrefillValue | undefined {
  if (value.startsWith('$query.')) {
    const name = value.slice('$query.'.length)
    const param = ctx.query[name]
    return typeof param === 'string' && param !== '' ? param : undefined
  }
  if (value.startsWith('$user.')) {
    if (ctx.user === undefined) return undefined
    const prop = value.slice('$user.'.length)
    const resolved = ctx.user[prop]
    if (resolved === undefined || resolved === null) return undefined
    if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
    return String(resolved)
  }
  // Any other `$`-rooted token (or plain literal string) passes through
  // unchanged — the engine only resolves the documented roots.
  return value
}

function resolveOne(value: PrefillValue, ctx: FormPrefillContext): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  return resolveReference(value, ctx)
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
    .map(([key, raw]): readonly [string, PrefillValue | undefined] => [key, resolveOne(raw, ctx)])
    .filter((entry): entry is readonly [string, PrefillValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}
