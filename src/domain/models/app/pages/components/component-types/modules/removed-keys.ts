/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared-module keys a data component no longer accepts, and what replaces
 * each.
 *
 * ## The decision these messages carry
 *
 * A data component draws no control of its own. The search box every
 * data-bound component could draw above its rows (`search`, spread by
 * `dataBoundFields`) could only ever narrow that one component; a
 * `search-input` on the page publishing on a shared-filter channel narrows
 * every component subscribed to the channel, combined with the channel's other
 * controls. So the key is refused, with that pointer, on every component that
 * carried it. The `search` of a `tree` and of a `command` menu are those
 * components' own keys and are untouched.
 *
 * The `table` carries the same key and answers it from its own
 * `data/table/removed-keys.ts`, with the same sentence.
 */

/** Every data component, other than `table`, that carried the shared `search` box. */
const SEARCH_CARRIERS: ReadonlySet<string> = new Set([
  'kanban',
  'gallery',
  'carousel',
  'list',
  'event-calendar',
  'timeline',
  'chart',
  'kpi',
  'form',
  'container',
  'graph',
  'matrix',
])

/**
 * The refusal sentence for a `search` box on a data component.
 *
 * @param type - The component type the author wrote it on.
 */
export const removedSearchMessage = (type: string): string =>
  `\`search\` has been removed from \`${type}\`: a data component no longer draws its own search box. Put a \`search-input\` with \`publishes: { bindTo: <channel>, param: q }\` on the page — or the library block \`block/data-table-toolbar\` — and subscribe the component with \`dataSource.bindTo: <channel>\` and \`sharedFilter: {}\`.`

/**
 * The migration message for a removed shared-module key, or `undefined` when
 * this module has nothing to say about it.
 *
 * @param discriminant - The node's `type` literal when it has one.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedModuleKey = (
  discriminant: string | undefined,
  key: string
): string | undefined =>
  key === 'search' && discriminant !== undefined && SEARCH_CARRIERS.has(discriminant)
    ? removedSearchMessage(discriminant)
    : undefined

/** Every component type the `search` refusal covers, for the test. @internal */
export const REMOVED_SEARCH_CARRIERS: readonly string[] = [...SEARCH_CARRIERS]
