/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { envReferencesIn } from './env-reference-service'

/** The slice of the app this rule reads by name: the variables it declares. */
export interface AppForEnvReferenceValidation {
  readonly env?: ReadonlyArray<{ readonly key: string }>
}

/** One step of the way from the app's root to a string. */
interface PathPart {
  readonly text: string
  /** A list entry named after its `name` (or `slug`, `key`, `id`). */
  readonly named: boolean
}

/** One `$env.NAME` reference, where it was written. */
interface EnvReference {
  readonly location: string
  readonly name: string
}

/** The keys a list entry is known by, in order of preference. */
const ENTRY_NAME_KEYS = ['name', 'slug', 'key', 'id'] as const

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** What a list entry is called, when it carries a name. */
const entryName = (entry: unknown): string | undefined => {
  if (!isRecord(entry)) return undefined
  const name = ENTRY_NAME_KEYS.map((key) => entry[key]).find(
    (value) => typeof value === 'string' && value !== ''
  )
  return typeof name === 'string' ? name : undefined
}

/** `webhooks` → `webhook`, `properties` → `property`; anything else as written. */
const singular = (key: string): string => {
  if (key.endsWith('ies')) return `${key.slice(0, -3)}y`
  if (key.endsWith('s') && !key.endsWith('ss')) return key.slice(0, -1)
  return key
}

/** The path as a reader would say it: `Table 'orders' webhook 'relay' auth.token`. */
const renderLocation = (parts: readonly PathPart[]): string => {
  const text = parts.reduce((rendered, part, index) => {
    if (index === 0) return part.text
    const joiner = part.named || parts[index - 1]?.named === true ? ' ' : '.'
    return `${rendered}${joiner}${part.text}`
  }, '')
  return text === '' ? 'The configuration' : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** The part naming entry `index` of the list held under `key`. */
const entryPart = (key: string, index: number, entry: unknown): PathPart => {
  const name = entryName(entry)
  return name === undefined
    ? { text: `${key}[${String(index)}]`, named: false }
    : { text: `${singular(key)} '${name}'`, named: true }
}

/**
 * Every `$env.NAME` written anywhere under `value`, in document order.
 * `ancestors` guards a TypeScript config that would point back at itself.
 */
const referencesUnder = (
  value: unknown,
  parts: readonly PathPart[],
  ancestors: readonly unknown[]
): readonly EnvReference[] => {
  if (typeof value === 'string') {
    const location = renderLocation(parts)
    return envReferencesIn(value).map((name) => ({ location, name }))
  }
  if (typeof value !== 'object' || value === null || ancestors.includes(value)) return []
  const lineage = [...ancestors, value]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      referencesUnder(item, [...parts, { text: `[${String(index)}]`, named: false }], lineage)
    )
  }
  return Object.entries(value).flatMap(([key, child]) =>
    Array.isArray(child)
      ? child.flatMap((entry, index) =>
          referencesUnder(entry, [...parts, entryPart(key, index, entry)], [...lineage, child])
        )
      : referencesUnder(child, [...parts, { text: key, named: false }], lineage)
  )
}

/**
 * A configuration may reference only the variables it declares.
 *
 * Every `$env.NAME` resolves through one lookup, and that lookup holds the
 * variables `app.env` declares and nothing else, so a reference to any other
 * name would silently become an empty value at runtime: an empty credential,
 * an empty URL, an empty password. One rule covers the whole configuration —
 * connections, webhooks, links, every automation action including the ones a
 * loop, a path or a named template runs, a template's variable defaults and a
 * code action's source — so boot and `sovrium validate` both refuse the app
 * and name the variable to declare. Other `$` tokens (`$currentUser`,
 * `$today`, a template's `$name`) are not environment references and are left
 * alone, and so is `app.env` itself, whose defaults are values, not references.
 *
 * @returns `true` when every reference is declared, otherwise the first refusal.
 */
export const validateAllEnvReferences = (app: AppForEnvReferenceValidation): true | string => {
  const declared = new Set((app.env ?? []).map((variable) => variable.key))
  // The declarations themselves are not references: a `default` is stored as
  // written and never resolved, so `app.env` is the one subtree not walked.
  const configuration = Object.fromEntries(Object.entries(app).filter(([key]) => key !== 'env'))
  const refusal = referencesUnder(configuration, [], []).find(
    (reference) => !declared.has(reference.name)
  )
  if (refusal === undefined) return true
  return `${refusal.location} references $env.${refusal.name}, a variable the app does not declare — declare ${refusal.name} in app.env`
}
