/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { PageNewTabNotice } from '@/presentation/design/new-tab-notice'
import type { Languages } from '@/domain/models/app/languages'

/**
 * The skip link (WCAG 2.4.1 "bypass blocks", RGAA 12.7): the FIRST focusable
 * element of every page. Visually hidden until focused (`sr-only
 * focus:not-sr-only`), it targets `#main-content`; `PageMain` renders
 * `<main id="main-content" tabindex="-1">`, so following it moves the focus
 * into the main region.
 *
 * Its words are the engine string `page.skipToContent`, in the page language
 * (an author renames it under `sovrium.page.skipToContent`), so a French page
 * never announces English chrome (RGAA 8.7). It is painted with the app's
 * `primary` / `primary-foreground` pair, so it wears the app's colours — and the
 * contrast the app chose for its buttons — rather than a fixed palette step.
 */
function SkipLink({
  lang,
  languages,
}: {
  readonly lang: string
  readonly languages: Languages | undefined
}): ReactElement {
  return (
    <a
      href="#main-content"
      className="text-md bg-primary text-primary-foreground ring-ring sr-only z-50 rounded-md px-4 py-2 font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus-visible:ring-2 focus-visible:outline-none"
    >
      {resolveInterpreterString('page.skipToContent', lang, languages)}
    </a>
  )
}

/**
 * The accessibility chrome at the top of every page's body: the skip link, and
 * the one copy of the new-tab announcement island links point at.
 */
export function PageAccessibilityChrome({
  lang,
  languages,
}: {
  readonly lang: string
  readonly languages: Languages | undefined
}): ReactElement {
  return (
    <>
      <SkipLink
        lang={lang}
        languages={languages}
      />
      <PageNewTabNotice text={resolveInterpreterString('link.opensInNewTab', lang, languages)} />
    </>
  )
}
