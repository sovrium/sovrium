/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { placedTemplatesOf } from './component-tree-has-type'
import type { ComponentTreeSource, Templates } from './component-tree-has-type'

/**
 * The component types an app declares, or `'all'` when they cannot be read.
 *
 * The stylesheet compiler is candidate-driven, and the candidates attributed to
 * a component type are offered to the engine only when the app declares that
 * type somewhere. "Somewhere" is: on any page, at any depth — a container's
 * `children`, a breakpoint's `responsive.<bp>.children`, a board's `card`, a
 * form's `fields` — and inside every reusable template in `app.components`,
 * whether a page places it or not. A template nobody places is still drawn by
 * the design-system console's component frames, which the operator's own
 * stylesheet styles, so leaving it out would paint those frames bare.
 *
 * `'all'` is the answer when the walk cannot be trusted: a reference to a
 * template the app does not declare, a `type` written as a `$` template to be
 * resolved at render time, or a `type` that is not a string at all. Each means
 * a node the renderer may draw whose type is unknown here, and the caller then
 * compiles the whole built-in corpus rather than guess.
 *
 * The walk is a sweep of every property at any depth, not a typed traversal:
 * a component type can sit under a key this module has never heard of
 * (`card.children`, a column's render), and a sweep that reads `type` wherever
 * it appears cannot fall behind the renderer the way a list of child keys
 * would. It over-collects — a form field's `type: 'select'` counts as the
 * select type — and over-collecting only adds recipes, never removes them.
 * Template resolution itself is the fixed walker's ({@link placedTemplatesOf}):
 * each `$ref` / `component` reference is followed into its template once,
 * cycles included.
 */

/**
 * A property found anywhere in a component subtree: every string-valued one,
 * plus every `type` whatever its value — a `type` that is not a string is the
 * one non-string property the walk has to see, since it is a node whose type
 * cannot be read.
 */
type Found = { readonly key: string; readonly value: unknown }

/** Every property of interest at any depth of `node` — see {@link Found}. */
const propertiesIn = (node: unknown): readonly Found[] => {
  if (Array.isArray(node)) return node.flatMap(propertiesIn)
  if (node === null || typeof node !== 'object') return []
  return Object.entries(node).flatMap(([key, value]) => [
    ...(key === 'type' || typeof value === 'string' ? [{ key, value }] : []),
    ...(typeof value === 'object' ? propertiesIn(value) : []),
  ])
}

/**
 * The `type` literals among `found` — or `undefined` when one cannot be read:
 * a `$` template resolved at render time, or a value that is not a string at
 * all. An absent `type` (`undefined`) is a node with no type, not an unreadable
 * one, and is skipped.
 */
const typesIn = (found: readonly Found[]): ReadonlySet<string> | undefined => {
  const types = found.filter(({ key, value }) => key === 'type' && value !== undefined)
  const literals = types.flatMap(({ value }) =>
    typeof value === 'string' && !value.includes('$') ? [value] : []
  )
  return literals.length === types.length ? new Set(literals) : undefined
}

/** The template names `found` references — every `$ref` and string `component`. */
const referencesIn = (found: readonly Found[]): readonly string[] =>
  found.flatMap(({ key, value }) =>
    (key === '$ref' || key === 'component') && typeof value === 'string' ? [value] : []
  )

/** The names of every template in `templates`. */
const templateNamesOf = (templates: Templates): ReadonlySet<string> =>
  new Set(
    templates.flatMap((template) => {
      const name = (template as { readonly name?: unknown } | null)?.name
      return typeof name === 'string' ? [name] : []
    })
  )

/**
 * The component types one component list declares — the list's own nodes plus
 * the bodies of every template it places — or `'all'` when a reference does
 * not resolve or a type cannot be read.
 */
const declaredIn = (
  items: readonly unknown[],
  templates: Templates,
  names: ReadonlySet<string>
): ReadonlySet<string> | 'all' => {
  const found = propertiesIn([...items, ...placedTemplatesOf(items, templates)])
  if (referencesIn(found).some((name) => !names.has(name))) return 'all'
  return typesIn(found) ?? 'all'
}

/**
 * Every component type the app declares — on its pages, inside the templates
 * they place, and inside every template in `app.components` — or `'all'` when
 * some drawn node's type cannot be known from the config.
 *
 * Pure and memo-free: the caller that runs per compile keys its own cache on
 * the `App` instance.
 *
 * @param app - The app's pages and templates, decoded or as authored.
 * @returns The declared type literals, or `'all'`.
 */
export const collectDeclaredComponentTypes = (
  app: ComponentTreeSource
): ReadonlySet<string> | 'all' => {
  const templates: Templates = app.components ?? []
  const names = templateNamesOf(templates)
  const lists = [...(app.pages ?? []).map((page) => page.components ?? []), templates]
  return lists.reduce<ReadonlySet<string> | 'all'>((acc, items) => {
    if (acc === 'all') return acc
    const declared = declaredIn(items, templates, names)
    return declared === 'all' ? 'all' : new Set([...acc, ...declared])
  }, new Set<string>())
}
