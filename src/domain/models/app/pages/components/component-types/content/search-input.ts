/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `search-input` — a search box, in one of two roles.
 *
 * ## The two roles, and why they are one type
 *
 * They were two types, `searchInput` and `pageSearch`. Both draw a search box,
 * both are the only thing on the page an author thinks of as "the search box",
 * and an author choosing between them had to already know which mechanism they
 * wanted. So they are one type, and what it declares names what it searches:
 *
 * - **`publishes: { bindTo, param: q }`** — the box publishes its query on a
 *   shared-filter channel and does no filtering of its own. Every data
 *   component subscribed to the channel (`dataSource.bindTo` + `sharedFilter`)
 *   narrows to the records the records API's full-text `q` matches, combined
 *   with the channel's other controls. No island of its own.
 * - **`scope: page`** — the pages search shell. It hydrates the `page-search`
 *   island and renders its own results. WHICH pages it searches is `index`
 *   (below).
 *
 * The id-based `scope: subscribers`, where a sibling named this box's id in its
 * `dataSource.bindTo`, no longer exists and is refused with a pointer to
 * `publishes` (`retired-values.ts`).
 *
 * ## `index` — which pages a page-scope box searches
 *
 * `scope` says WHAT a box searches; under `scope: page`, `index` says whose
 * pages. It is not a third role, because the mechanism is the same shell and
 * the same results panel — only the corpus behind it differs:
 *
 * - **`public`** (the meaning of an omitted key) — the prebuilt static index,
 *   served as a file to anyone. It holds anonymously readable pages only, and
 *   must stay that way: a public artefact is public-only.
 * - **`session`** — the pages the CALLER may open, answered per request by the
 *   server, which filters every candidate through the same page-access check
 *   the router applies. A visitor with no session gets the public pages; a
 *   signed-in reader additionally gets the gated pages and `contentDir`
 *   articles their role may open, and nothing their role may not.
 *
 * Omitted means `public` rather than being required: here the default is the
 * SAFE side. An author who forgets the key ships a box that searches less than
 * intended, never one that searches more.
 *
 * ## Why a box must declare one of the two
 *
 * They are two different mechanisms that happen to look alike. A default would
 * hand an author who declared neither the other component, silently — an input
 * that publishes to nobody, or a search shell with no index behind it. Neither
 * failure is visible in the markup, and both look like the box working. So a
 * box declaring neither, or both, is refused at load
 * (`component-xor-rules.ts`).
 *
 * ## Role-specific keys are inert, not refused
 *
 * `maxResults` and `index` belong to `scope: page`; `debounceMs` and
 * `minQueryLength` belong to a box that publishes. Each is ignored under the
 * other role rather than rejected — the union of both shapes is one open
 * struct, and refusing per-role would need a per-branch refinement hook
 * `buildComponentUnion` does not have.
 *
 * `debounceMs` and `minQueryLength` describe the query stream the box
 * publishes, so one declaration governs every subscriber on the channel.
 */

import { Schema } from 'effect'
import { SharedFilterParamPublisherSchema } from '../../data-source-publishers'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SearchInputTypeLiteral = Schema.Literal('search-input')

/** Which pages a page-scope `search-input` searches. */
export const SearchIndexSchema = Schema.Literals(['public', 'session']).annotate({
  title: 'Search Index',
  description:
    "Which pages a page-scope search box searches. 'public' (the default when omitted) searches the prebuilt index of pages anyone may read, served as a static file. 'session' asks the server on every query and answers with the pages the current reader may open: public pages for a visitor who is not signed in, plus the gated pages and content-directory articles their role allows once they are. Ignored by a box that publishes.",
  examples: ['session'],
})

/** What a `search-input` searches. */
export const SearchScopeSchema = Schema.Literal('page').annotate({
  title: 'Search Scope',
  description:
    "What the input searches: 'page' hydrates the page-search shell against the prebuilt index and renders its own results. To narrow the data components on the page instead, leave scope out and declare publishes.",
})

export const searchInputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /**
   * Which search mechanism this box drives. Optional since a box that
   * `publishes` needs none: it is a channel publisher. A box declares either
   * `scope: page` or `publishes`; the pairing rule is checked at load.
   */
  scope: Schema.optional(SearchScopeSchema),
  /**
   * Publish the query on a shared-filter channel — `{ bindTo, param: q }` — so
   * every data component subscribed to the channel narrows to the records the
   * records API's full-text `q` matches, combined with the channel's other
   * contributions. `debounceMs` and `minQueryLength` apply to what is
   * published.
   */
  publishes: Schema.optional(SharedFilterParamPublisherSchema),
  /** Which pages a page-scope box searches. Read under `scope: page`; omitted means `public`. */
  index: Schema.optional(SearchIndexSchema),
  /** Placeholder text. Also readable from `props.placeholder`. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'Placeholder text shown in the empty search box',
    })
  ),
  /** How many results the page-scope shell renders. Read under `scope: page`. */
  maxResults: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Maximum number of results the page-scope search shell renders',
        examples: [5, 10],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Delay before the published query reaches the subscribers (ms). Read by a box that publishes. */
  debounceMs: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Delay in milliseconds after the last keystroke before a bound subscriber applies the query. Default 250, so a typed word reaches the subscribers once; a pasted term and Enter apply at once whatever the delay. 0 applies every keystroke.',
        examples: [300, 500],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  /** Minimum query length before the query is published. Read by a box that publishes. */
  minQueryLength: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Minimum number of characters before the query is applied. Below it the subscriber shows its unfiltered baseline. Default 0 (no minimum).',
        examples: [2, 3],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    )
  ),
} as const
