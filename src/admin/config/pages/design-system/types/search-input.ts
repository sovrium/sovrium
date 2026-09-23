/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `search-input` — the one control that is a search, at both of its scopes.
//
// `scope` is REQUIRED, and it is the whole type: a search that does not say
// what it searches is the one thing this component may not be, so the schema
// refuses the config rather than defaulting it.
//
// The two drawings look nearly identical and mean entirely different things,
// which is exactly the case a kit page exists to disambiguate. One hydrates an
// island against a prebuilt index and renders its own results; the other
// renders server-side, publishes its value as DOM events and filters nothing —
// a sibling whose `dataSource.bindTo` names this input's `props.id` does the
// filtering.
//
// The second heading is the design system's word. The schema's value is
// `subscribers`, which names the MECHANISM; `data` names what a reader is
// choosing between, and the note carries the value so nobody writes the wrong
// key.

import type { TypePageBody } from './body-shape'

const searchInput: TypePageBody = {
  drawings: [
    {
      label: 'page',
      children: [
        {
          type: 'search-input',
          scope: 'page',
          placeholder: 'Search the docs…',
          maxResults: 8,
          props: { className: 'w-72' },
        },
      ],
    },
    {
      label: 'data',
      children: [
        {
          type: 'search-input',
          scope: 'subscribers',
          placeholder: 'Search deals…',
          debounceMs: 250,
          minQueryLength: 2,
          props: { id: 'deal-search', className: 'w-72' },
        },
      ],
    },
  ],
}

export default searchInput
