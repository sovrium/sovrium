/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NEW_TAB_NOTICE_ID } from './new-tab-attributes'
import type { ReactElement } from 'react'

/**
 * How a link that opens a new tab says so (WCAG 3.2.5, RGAA 13.2).
 *
 * A reader who follows such a link lands in a new window with no Back history,
 * so the change has to be announced BEFORE it happens. The words are the engine
 * string `link.opensInNewTab`, in the page language, and they are read by
 * assistive technology only: a sighted reader sees the link as it is styled.
 *
 * Three shapes, one string:
 *
 * - A link the SERVER draws with known words is named in full by `aria-label`
 *   (`newTabName`, `./new-tab-attributes`): "Our suppliers (opens in a new
 *   tab)", its visible text untouched.
 * - A server-drawn link whose words are rendered children, or rewritten in
 *   place by the page's language switcher, carries the words inside it,
 *   visually hidden, with {@link NewTabNotice}.
 * - A link an ISLAND draws cannot resolve a page-language string — the browser
 *   bundle carries no catalogue — so it points at the one copy every page
 *   serves ({@link PageNewTabNotice}) with `aria-describedby` — the id as a
 *   literal in the island, `describeNewTab` (`./new-tab-attributes`) in its
 *   server render: the words are announced as its description, with nothing
 *   threaded through the island's props and nothing that differs between the
 *   server render and the hydrated one.
 */

/**
 * The announcement inside a server-drawn new-tab link: read, never seen.
 *
 * `data-new-tab-notice` is what the page's language switcher keeps when it
 * rewrites a translated link's words; given `translations` (the announcement in
 * every language of the app), the switcher rewords the notice too.
 */
export function NewTabNotice({
  text,
  translations,
}: {
  readonly text: string
  readonly translations?: Readonly<Record<string, string>>
}): ReactElement {
  return (
    <span
      className="sr-only"
      data-new-tab-notice=""
      {...(translations === undefined
        ? {}
        : {
            'data-translation-key': 'link.opensInNewTab',
            'data-translations': JSON.stringify(translations),
          })}
    >
      {` ${text}`}
    </span>
  )
}

/**
 * The page's one copy of the announcement. `hidden` keeps it out of the page
 * and out of the reading order; an `aria-describedby` that names it still
 * reads its text.
 */
export function PageNewTabNotice({ text }: { readonly text: string }): ReactElement {
  return (
    <span
      id={NEW_TAB_NOTICE_ID}
      hidden
    >
      {text}
    </span>
  )
}
