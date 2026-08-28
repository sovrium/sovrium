/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `searchInput` — a static SSR text input that publishes its value to bound
 * subscribers.
 *
 * The input itself does no filtering. It renders server-side and emits DOM
 * `input` events; a sibling component whose `dataSource.bindTo` names this
 * input's `props.id` subscribes to those events and applies the query to its
 * own records.
 *
 * `debounceMs` and `minQueryLength` are therefore CONSUMED BY SUBSCRIBERS, not
 * by the input. They are declared here — on the publisher — because they
 * describe the query stream this input publishes, so one declaration governs
 * every subscriber bound to it. The SSR renderer stamps them onto the `<input>`
 * as `data-search-debounce` / `data-search-min-length`, and the subscribing
 * island reads them back off the DOM at bind time.
 *
 * Both are top-level fields (siblings of `props`), matching the lookup contract
 * used by the other top-level-fielded components (pageSearch, textarea, …).
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SearchInputTypeLiteral = Schema.Literal('searchInput')

export const searchInputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Delay before a bound subscriber applies the query (ms) */
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
  /** Minimum query length before a bound subscriber applies the query */
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
