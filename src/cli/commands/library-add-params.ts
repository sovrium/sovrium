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
  const given = new Map(
    sets.map((pair) => {
      const cut = pair.indexOf('=')
      return cut <= 0
        ? refuse(`Error: --set expects key=value, got "${pair}".`)
        : ([pair.slice(0, cut), pair.slice(cut + 1)] as const)
    })
  )
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
  return Object.fromEntries(
    entry.params.map((param) => {
      const raw = given.get(param.name)
      return [
        param.name,
        raw === undefined
          ? (configDefault(param, parsed) ?? param.default)
          : parseParamValue(entryId, param, raw),
      ]
    })
  )
}
