/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The id of the page-level copy of the new-tab announcement (`PageNewTabNotice`,
 * `./new-tab-notice.tsx`). A link an island draws points at it with
 * `aria-describedby`, writing the id as a literal: importing it would make this
 * module a chunk of its own in every island that reads it, a cost several times
 * the size of the string. `new-tab-attributes.test.ts` holds every island's
 * literal to this value.
 */
export const NEW_TAB_NOTICE_ID = 'sovrium-new-tab-notice'

/** `aria-describedby` to the announcement for a link whose target is `_blank`, nothing otherwise. */
export const describeNewTab = (
  target: string | undefined
): { readonly 'aria-describedby'?: string } =>
  target === '_blank' ? { 'aria-describedby': NEW_TAB_NOTICE_ID } : {}

/**
 * The accessible name of a server-drawn new-tab link whose words are a known
 * string: its visible words, then the announcement. The name starts with the
 * words a sighted reader sees (WCAG 2.5.3), and the visible text is unchanged.
 */
export const newTabName = (words: string, notice: string): { readonly 'aria-label': string } => ({
  'aria-label': `${words} ${notice}`,
})
