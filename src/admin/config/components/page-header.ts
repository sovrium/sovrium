/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/page-header@0.37.0#3625113ebfac
// sovrium-library: block/page-header@0.37.0#3ed00e1cd7b4
// sovrium-library: block/page-header@0.37.0#d0ed32118880

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

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

export const pageHeaderCopy = {
  type: 'container',
  element: 'header',
  props: { className: 'flex flex-col gap-2' },
  children: [
    {
      type: 'text',
      element: 'h1',
      props: { className: 'text-3xl font-semibold tracking-tight' },
      content: '',
    },
  ],
} as const

export const pageHeaderHiddenCopy = {
  type: 'container',
  element: 'header',
  props: { className: 'sr-only' },
  children: [
    { type: 'text', element: 'h1', props: { className: 'sr-only' }, content: '' },
    { type: 'text', element: 'p', props: { className: 'sr-only' }, content: '' },
  ],
} as const

export const pageHeaderBlurbCopy = {
  type: 'container',
  element: 'header',
  props: { className: 'flex flex-col gap-2' },
  children: [
    { type: 'text', element: 'h1', props: { className: 'sr-only' }, content: '' },
    {
      type: 'text',
      element: 'p',
      props: { className: 'max-w-3xl text-sm text-muted-foreground' },
      content: '',
    },
  ],
} as const

/** The design-system kit marker a design-system page stamps on its header. */
const kitMarker = (type: string): Readonly<Record<string, string>> => ({
  'data-design-kit-type': type,
})

/**
 * A design-system page's header: the title drawn, no sentence. The kit
 * markers stay, because the catalogue's coverage counts the types a page draws.
 */
export const designPageHeader = (title: string): PageComponent => {
  const [heading] = pageHeaderCopy.children
  return {
    ...pageHeaderCopy,
    props: { ...pageHeaderCopy.props, ...kitMarker('container') },
    children: [{ ...heading, props: { ...heading.props, ...kitMarker('text') }, content: title }],
  } as PageComponent
}

/**
 * A data page's header. Both lines are `content`-bound, so both may be `$t:`
 * tokens. `showBlurb` draws the sentence, for the one surface whose sentence
 * tells a sighted operator something the trail cannot.
 */
export const dataPageHeader = (
  title: string,
  description: string,
  options: { readonly showBlurb?: boolean } = {}
): PageComponent => {
  const copy = options.showBlurb === true ? pageHeaderBlurbCopy : pageHeaderHiddenCopy
  const [heading, sentence] = copy.children
  return {
    ...copy,
    children: [
      { ...heading, content: title },
      { ...sentence, content: description },
    ],
  } as PageComponent
}
