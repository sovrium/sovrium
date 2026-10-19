/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sample a reusable component is documented with: each `$variable` its
 * template reads, the component type that variable fills, and the value it is
 * drawn with on the design-system pages.
 *
 * A template drawn on its own has no `vars`, so it printed `$label`, `$value`
 * and `$caption` where a reader expected a KPI card. The values a reader
 * recognises are already in the app: every page that embeds the template hands
 * it `vars`. So a variable's sample is what the FIRST page in `pages[]`
 * declaration order supplies for it, and a variable no page supplies is drawn
 * as its own name, without the `$`. This is configuration, not data: no record
 * is read and none can be.
 */

import type { App } from '@/domain/models/app'

/** One variable of a template, as the props table lists it. */
export interface ComponentSampleProp {
  /** The variable's name, without its `$`. */
  readonly name: string
  /** The component type of the node the variable fills (`text`, `button`…). */
  readonly type: string
  /** The value the specimen is drawn with. */
  readonly sample: string
}

/**
 * One `$name` variable reference: a letter-led name not followed by a further
 * name character, a dot (a namespaced token such as `$record.title`) or a colon
 * (a lookup such as `$t:nav.home`). The lookahead is the template substitutor's.
 */
const VARIABLE = /\$([a-zA-Z][a-zA-Z0-9]*)(?![a-zA-Z0-9_.:])/g

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every variable a string reads, in order. */
const variablesIn = (text: string): readonly string[] =>
  [...text.matchAll(VARIABLE)].map((match) => match[1] ?? '')

/**
 * Every variable a template reads, with the type of the node reading it, first
 * occurrence winning. A node's own `type` is its kind; a string child sits in
 * its parent's.
 */
const variablesOf = (
  node: unknown,
  type: string
): readonly (readonly [name: string, type: string])[] => {
  if (typeof node === 'string') return variablesIn(node).map((name) => [name, type] as const)
  if (Array.isArray(node)) return node.flatMap((entry) => variablesOf(entry, type))
  if (!isRecord(node)) return []
  const own = typeof node['type'] === 'string' ? node['type'] : type
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'type' || key === 'name' ? [] : variablesOf(value, own)
  )
}

/** Every `vars` a tree hands the template `name`, in document order. */
const suppliedVars = (
  node: unknown,
  name: string
): readonly Readonly<Record<string, unknown>>[] => {
  if (Array.isArray(node)) return node.flatMap((entry) => suppliedVars(entry, name))
  if (!isRecord(node)) return []
  const own = node['component'] === name && isRecord(node['vars']) ? [node['vars']] : []
  return [...own, ...Object.values(node).flatMap((value) => suppliedVars(value, name))]
}

/** The first scalar any page supplies for `variable`, as text. */
const firstSample = (
  supplied: readonly Readonly<Record<string, unknown>>[],
  variable: string
): string | undefined => {
  const value = supplied.find((vars) => {
    const candidate = vars[variable]
    return (
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    )
  })?.[variable]
  return value === undefined ? undefined : String(value)
}

/**
 * The variables of the template `name`, each with its type and its sample.
 * Empty for a template this app does not declare, or one that reads none.
 */
export const componentSampleProps = (
  app: Pick<App, 'components' | 'pages'>,
  name: string
): readonly ComponentSampleProp[] => {
  const template = (app.components ?? []).find(
    (candidate) => (candidate as { readonly name?: unknown }).name === name
  )
  if (template === undefined) return []
  const supplied = (app.pages ?? []).flatMap((page) => suppliedVars(page.components, name))
  const seen = variablesOf(template, 'component').filter(
    ([variable], index, all) => all.findIndex(([other]) => other === variable) === index
  )
  return seen.map(([variable, type]) => ({
    name: variable,
    type,
    sample: firstSample(supplied, variable) ?? variable,
  }))
}

/** The samples of {@link componentSampleProps} as a `vars` map. */
export const componentSampleVars = (
  app: Pick<App, 'components' | 'pages'>,
  name: string
): Readonly<Record<string, string>> =>
  Object.fromEntries(componentSampleProps(app, name).map((prop) => [prop.name, prop.sample]))

/** One string with its variables drawn from `vars`; a variable not in `vars` is left as written. */
const drawString = (text: string, vars: Readonly<Record<string, string>>): string =>
  text.replace(VARIABLE, (token, variable: string) => vars[variable] ?? token)

/**
 * A template with its variables drawn from `vars` — the copy the design-system
 * pages draw inline. Only string leaves change; a `$t:` lookup and a
 * `$record.` token are not variables, so they are left for the renderer.
 */
export const withSampleVars = <T>(node: T, vars: Readonly<Record<string, string>>): T => {
  if (typeof node === 'string') return drawString(node, vars) as T
  if (Array.isArray(node)) return node.map((entry: unknown) => withSampleVars(entry, vars)) as T
  if (!isRecord(node)) return node
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'name' || key === 'type' ? value : withSampleVars(value, vars),
    ])
  ) as T
}
