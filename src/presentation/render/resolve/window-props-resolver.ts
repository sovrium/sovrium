/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import type { Page } from '@/domain/models/app/pages'
import type { ResolvedPageWindow } from '@/domain/models/app/pages/window-props'

/**
 * Every `$window.<name>` reference reachable in a page. A single STATIC literal
 * — the capture is what decides whether a match is substituted, so no regular
 * expression is ever built from input (`sovrium/no-dynamic-regexp`).
 *
 * The name grammar is deliberately WIDER than the closed set of five, for the
 * same reason `$app.<name>` is: matching `$window.middle` is what lets the
 * substitution DECIDE to leave it alone, where a regex enumerating only the
 * five would have skipped it silently and made "left verbatim" an accident.
 */
const WINDOW_REFERENCE = /\$window\.([a-zA-Z][a-zA-Z0-9]*)/g

/**
 * Substitute a page's RESOLVED window into every `$window.<name>` reference.
 *
 * Runs in the same position as the `$query` and `$app` passes and walks the
 * same two families (`components`, `layout`), so a window reference is legal
 * wherever a string is — a `dataSource.system.query` value the island is about
 * to request with, a line of visible copy, a preset selector's marker.
 *
 * ONE resolution per render, not one per reference: the caller resolves the
 * window once against a single instant and hands the result here. Panels each
 * reading the clock for themselves would drift their windows apart by however
 * long the render took, and a surface reporting two periods at once invites the
 * operator to compare them.
 *
 * A reference the window cannot answer is left VERBATIM, matching `$app.*`: a
 * blank would be indistinguishable from a formatting bug, and the surviving
 * literal is how an author notices the typo.
 *
 * Pure, and a page declaring no `window` — or carrying no reference — is
 * returned by reference.
 */
export function resolvePageWindowProps(page: Page, resolved: ResolvedPageWindow | undefined): Page {
  if (resolved === undefined) return page

  const values: Readonly<Record<string, string>> = {
    id: resolved.id,
    start: resolved.start,
    end: resolved.end,
    granularity: resolved.granularity,
    label: resolved.label,
  }

  const substitute = (str: string): string =>
    str.includes('$window.')
      ? str.replaceAll(WINDOW_REFERENCE, (match, name: string) => values[name] ?? match)
      : str

  return {
    ...page,
    ...(page.components !== undefined
      ? { components: mapStringsDeep(page.components, substitute) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: mapStringsDeep(page.layout, substitute) as Page['layout'] }
      : {}),
  }
}
