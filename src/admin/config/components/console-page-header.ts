/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/page-header@0.37.0#3625113ebfac

// The design-system page heading: one h1, its text passed as `content`.

// ── From components/page-header.ts ─────────────────────────────────────────────
// The console's page headers, INSTALLED from the library's `page-header` block:
// the page name as its one `h1` and, under it, the sentence that says what the
// page is for. Three installs of the one block, by the lines they draw:
//
//   - `pageHeaderCopy`        the design-system pages: the title drawn, no sentence;
//   - `pageHeaderHiddenCopy`  the data pages: both lines kept for screen readers,
//                             because the top bar's trail already names the page
//                             (`titleVisibility` and `descriptionVisibility` set
//                             to `sr-only`);
//   - `pageHeaderBlurbCopy`   a data page whose sentence is news: the title kept
//                             for screen readers, the sentence drawn.
//
// `Console Block Parity` holds each to the block built with those parameters.
// Re-install with `sovrium library add block/page-header --update`. The
// bindings are the two lines' text and the design-system kit marker.

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consolePageHeader = {
  name: 'console-page-header',
  type: 'container',
  render: 'transparent',
  inputs: {
    content: {
      kind: 'text',
      required: true,
    },
  },
  element: 'header',
  props: {
    className: 'flex flex-col gap-2',
    'data-design-kit-type': 'container',
  },
  children: [
    {
      type: 'text',
      element: 'h1',
      props: {
        className: 'text-3xl font-semibold tracking-tight',
        'data-design-kit-type': 'text',
      },
      content: '$content',
    },
  ],
} as unknown as Template
