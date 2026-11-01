/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/tabs-line@0.37.0#6c84372866d0

// The line tabs of a data page: the panels are passed, their bodies are the page's own (`$children`, one per panel).

// ── From components/tabs-line.ts ───────────────────────────────────────────────
// The console's section tabs, INSTALLED from the library's `tabs-line` block:
// shadcn's `line` tabs, the current tab underlined on no ground. `Console Block
// Parity` holds the copy to the block. Re-install with
// `sovrium library add block/tabs-line --update`.
//
// The bindings are everything a page names: the panels, their bodies, the tab
// open first, the accessible name and test id, and the fill layout.

import type { TemplateEncoded } from '@/domain/models/app/components'

export const consoleTabs: TemplateEncoded = {
  name: 'console-tabs',
  type: 'tabs',
  render: 'transparent',
  inputs: {
    defaultTab: {
      kind: 'text',
      required: true,
    },
    ariaLabel: {
      kind: 'text',
      required: true,
    },
    className: {
      kind: 'text',
    },
    dataTestid: {
      kind: 'text',
    },
    panels: {
      kind: 'json',
      required: true,
    },
    layout: {
      kind: 'text',
    },
  },
  tabsVariant: 'line',
  defaultTab: '$defaultTab',
  props: {
    'aria-label': '$ariaLabel',
    className: '$className',
    'data-testid': '$dataTestid',
  },
  panels: '$panels',
  layout: '$layout',
  children: '$children',
}
