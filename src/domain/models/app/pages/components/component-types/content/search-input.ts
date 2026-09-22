/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `search-input` — a search box, in one of two scopes.
 *
 * ## The two scopes, and why they are one type
 *
 * They were two types, `searchInput` and `pageSearch`. Both draw a search box,
 * both are the only thing on the page an author thinks of as "the search box",
 * and an author choosing between them had to already know which mechanism they
 * wanted. So they are one type whose `scope` names what is being searched:
 *
 * - **`subscribers`** — the input publishes its value and does no filtering of
 *   its own. It renders server-side and emits DOM `input` events; a sibling
 *   component whose `dataSource.bindTo` names this input's `props.id`
 *   subscribes to those events and applies the query to its own records. No
 *   island of its own.
 * - **`page`** — the static-public-pages search shell. It hydrates the
 *   `page-search` island against a prebuilt index and renders its own results.
 *
 * ## Why `scope` is REQUIRED
 *
 * Unlike `comments`, whose two displays are one feature at two sizes, these are
 * two different mechanisms that happen to look alike. A default would hand an
 * author who omitted the key the other component, silently — an input that
 * publishes to nobody, or a search shell with no index behind it. Neither
 * failure is visible in the markup, and both look like the box working.
 *
 * The cost of requiring it is paid once, at the migration both old names force
 * anyway: `searchInput` and `pageSearch` are refused by name, and the refusal
 * says which `scope` value reproduces what the author had.
 *
 * ## Scope-specific keys are inert, not refused
 *
 * `maxResults` belongs to `page`; `debounceMs` and `minQueryLength` belong to
 * `subscribers`. Each is ignored under the other scope rather than rejected —
 * the union of both shapes is one open struct, and refusing per-scope would
 * need a per-branch refinement hook `buildComponentUnion` does not have.
 *
 * `debounceMs` and `minQueryLength` are CONSUMED BY SUBSCRIBERS, not by the
 * input. They are declared on the publisher because they describe the query
 * stream it publishes, so one declaration governs every subscriber bound to it.
 * The SSR renderer stamps them onto the `<input>` as `data-search-debounce` /
 * `data-search-min-length`, and the subscribing island reads them back off the
 * DOM at bind time.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SearchInputTypeLiteral = Schema.Literal('search-input')

/** What a `search-input` searches. */
export const SearchScopeSchema = Schema.Literals(['page', 'subscribers']).annotate({
  title: 'Search Scope',
  description:
    "What the input searches: 'page' hydrates the page-search shell against the prebuilt index and renders its own results; 'subscribers' publishes the query to sibling components bound to this input's id",
})

export const searchInputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Which of the two search mechanisms this box drives. Required — see the header. */
  scope: SearchScopeSchema,
  /** Placeholder text. Also readable from `props.placeholder`. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Placeholder text shown in the empty search box',
    })
  ),
  /** How many results the page-scope shell renders. Read under `scope: page`. */
  maxResults: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Maximum number of results the page-scope search shell renders',
        examples: [5, 10],
      })
    )
  ),
  /** Delay before a bound subscriber applies the query (ms). Read under `scope: subscribers`. */
  debounceMs: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
      Schema.annotate({
        description:
          'Delay in milliseconds after the last keystroke before a bound subscriber applies the query. Default 0 (apply immediately).',
        examples: [300, 500],
      })
    )
  ),
  /** Minimum query length before a bound subscriber applies the query. Read under `scope: subscribers`. */
  minQueryLength: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
      Schema.annotate({
        description:
          'Minimum number of characters before the query is applied. Below it the subscriber shows its unfiltered baseline. Default 0 (no minimum).',
        examples: [2, 3],
      })
    )
  ),
} as const
