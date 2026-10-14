/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `library add` parameters: the `--set` pairs an operator passes, checked
 * against what the entry declares, with each unset parameter taking the target
 * app's value (`defaultFromConfig`) or the entry's own default.
 */

import { isAppRelativeLoginPage } from '@/domain/models/app/auth/login-page-service'
import { refuse } from './app-prelude'
import type { LibraryEntry, LibraryParamValue } from '@/library/manifest/define'

const parseParamValue = (
  entryId: string,
  param: LibraryEntry['params'][number],
  raw: string
): LibraryParamValue => {
  if (param.type === 'string') return raw
  const value = Number(raw)
  return Number.isFinite(value) && raw.trim() !== ''
    ? value
    : refuse(`Error: ${entryId} expects a number for "${param.name}", got "${raw}".`)
}

/**
 * The value a parameter's `defaultFromConfig` names in the target app, or
 * `undefined` when the app does not set it. `auth.loginPage` is re-checked as
 * a path on this app, so a sign-in link never points off it.
 */
const configDefault = (
  param: LibraryEntry['params'][number],
  parsed: unknown
): LibraryParamValue | undefined => {
  if (param.defaultFromConfig !== 'auth.loginPage') return undefined
  const loginPage = (parsed as { readonly auth?: { readonly loginPage?: unknown } } | undefined)
    ?.auth?.loginPage
  return isAppRelativeLoginPage(loginPage) ? loginPage : undefined
}

/** Where a resolved value came from, as the CLI names it. */
export type ParamSource = 'from --set' | 'from auth.loginPage' | 'default'

/** Resolved parameters, and where each value came from. */
export interface ResolvedParams {
  readonly values: Readonly<Record<string, LibraryParamValue | undefined>>
  readonly sources: Readonly<Record<string, ParamSource>>
}

const parseSets = (sets: readonly string[]): ReadonlyMap<string, string> =>
  new Map(
    sets.map((pair) => {
      const cut = pair.indexOf('=')
      return cut <= 0
        ? refuse(`Error: --set expects key=value, got "${pair}".`)
        : ([pair.slice(0, cut), pair.slice(cut + 1)] as const)
    })
  )

/** Every parameter's value, from `given`, the app's config or the entry default. */
const resolveGiven = (
  entryId: string,
  entry: LibraryEntry,
  given: ReadonlyMap<string, string>,
  parsed: unknown
): ResolvedParams => {
  const resolved = entry.params.map((param) => {
    const raw = given.get(param.name)
    if (raw !== undefined)
      return [param.name, parseParamValue(entryId, param, raw), 'from --set'] as const
    const fromConfig = configDefault(param, parsed)
    return fromConfig === undefined
      ? ([param.name, param.default, 'default'] as const)
      : ([param.name, fromConfig, 'from auth.loginPage'] as const)
  })
  return {
    values: Object.fromEntries(resolved.map(([name, value]) => [name, value])),
    sources: Object.fromEntries(resolved.map(([name, , source]) => [name, source])),
  }
}

/**
 * `--set` pairs, validated against what the entry declares. A parameter left
 * unset takes the target app's value when it declares `defaultFromConfig` and
 * `parsed` (the app's config) sets it, else its own default.
 */
export const resolveParams = (
  entryId: string,
  entry: LibraryEntry,
  sets: readonly string[],
  parsed?: unknown
): Readonly<Record<string, LibraryParamValue | undefined>> => {
  const accepted = entry.params.map((param) => param.name)
  const given = parseSets(sets)
  const unknown = [...given.keys()].find((key) => !accepted.includes(key))
  if (unknown !== undefined)
    return refuse(
      `Error: ${entryId} has no parameter "${unknown}".\n\n` +
        `  Accepted parameters: ${accepted.length === 0 ? 'none' : accepted.join(', ')}.`
    )
  const missing = entry.params.find((param) => param.required === true && !given.has(param.name))
  if (missing !== undefined)
    return refuse(
      `Error: ${entryId} needs the required parameter "${missing.name}" — ${missing.description}\n\n` +
        `  Set it with --set ${missing.name}=<value>.`
    )
  return resolveGiven(entryId, entry, given, parsed).values
}

/**
 * The parameters an entry resolves when no `--set` is given — the reference a
 * fragment that records no parameters is compared with — or `undefined` when
 * one is required and so has no value without a `--set`.
 */
export const defaultParams = (
  entry: LibraryEntry,
  parsed: unknown
): Readonly<Record<string, LibraryParamValue | undefined>> | undefined =>
  entry.params.some((param) => param.required === true)
    ? undefined
    : resolveGiven('', entry, new Map(), parsed).values

/**
 * The parameters of an entry the requested one REQUIRES: each `--set` given
 * for the requested entry is passed on when the requirement declares a
 * parameter of the same name and type; any other key is not the
 * requirement's concern. A requirement's own required parameter left without
 * a value is refused as it would be for a direct install.
 */
export const requirementParams = (input: {
  readonly requiredId: string
  readonly required: LibraryEntry
  readonly requested: LibraryEntry
  readonly sets: readonly string[]
  readonly parsed: unknown
}): ResolvedParams & { readonly note: string } => {
  const { required, requested } = input
  const given = parseSets(input.sets)
  const shared = new Map(
    [...given].filter(([name]) => {
      const own = required.params.find((param) => param.name === name)
      const asked = requested.params.find((param) => param.name === name)
      return own !== undefined && asked !== undefined && own.type === asked.type
    })
  )
  const missing = required.params.find(
    (param) => param.required === true && !shared.has(param.name)
  )
  if (missing !== undefined)
    return refuse(
      `Error: ${input.requiredId} needs the required parameter "${missing.name}" — ${missing.description}\n\n` +
        `  It is installed as a requirement; install it on its own first with --set ${missing.name}=<value>.`
    )
  const resolved = resolveGiven(input.requiredId, required, shared, input.parsed)
  return { ...resolved, note: describeParams(resolved) }
}

/** `iconName=key (from --set), successPath=/sign-in (default)` — empty for an entry with none. */
export const describeParams = ({ values, sources }: ResolvedParams): string =>
  Object.keys(values)
    .flatMap((name) => {
      const value = values[name]
      return value === undefined ? [] : [`${name}=${String(value)} (${sources[name] ?? 'default'})`]
    })
    .join(', ')
