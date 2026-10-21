/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/dl-rows@0.37.0#ef5803964308

// A card of label/value rows: the rows are the page's own, passed to `$children`.

// ── From components/card-blocks.ts ─────────────────────────────────────────────
// The console's facts cards, INSTALLED from the library's `dl-rows` block: a
// shadcn Card with a header (a title and the sentence that says what the facts
// are) over its rows. The copy is the block's card; `Console Block Parity`
// holds it to that subtree. Re-install with
// `sovrium library add block/dl-rows --update`.
//
// The bindings are the title, the sentence (and its testid), the card's testid,
// and the body:
// the block lists static terms, a console card lists rows its page reads.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleFactsCard = {
  name: 'console-facts-card',
  type: 'card',
  render: 'transparent',
  inputs: {
    dataTestid: {
      kind: 'text',
    },
  },
  props: {
    className: 'p-0',
    'data-testid': '$dataTestid',
  },
  children: '$children',
} as unknown as Template
