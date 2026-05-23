/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

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
  return value
}

function resolveOne(value: PrefillValue, ctx: FormPrefillContext): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  return resolveReference(value, ctx)
}

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
