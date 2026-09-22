/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import { resolvePageQueryValues } from '@/domain/models/app/pages/query-props'
import type { Page } from '@/domain/models/app/pages'

/**
 * Every `$query.<name>` reference reachable in a page, by the same name grammar
 * `collectPageBindingViolations` enforces on the declaration side
 * (lowercase kebab-case). A single STATIC literal — the capture is what decides
 * whether a match is substituted, so no regular expression is ever built from
 * input (`sovrium/no-dynamic-regexp`).
 */
const QUERY_REFERENCE = /\$query\.([a-z][a-z0-9-]*)/g

/**
 * Substitute the resolved `page.query` values into every `$query.<name>`
 * reference on the page.
 *
 * Runs BEFORE data-source resolution, so a declared property is usable
 * anywhere a string is — component content, props, and a `dataSource.filter`
 * value alike — rather than only in the handful of places a renderer happens
 * to walk.
 *
 * A reference naming a property the page does NOT declare is left verbatim, on
 * purpose. Declaration is what bounds the value; substituting an undeclared
 * name would read a raw URL parameter straight into the render, which is the
 * unbounded-response-space case `page.query` exists to prevent. The literal
 * that survives is then visible in the output, which is how an author notices
 * the missing declaration.
 *
 * Pure, and a page declaring no `query` is returned by reference.
 */
export function resolvePageQueryProps(
  page: Page,
  requestQuery: Readonly<Record<string, string>> | undefined
): Page {
  const values = resolvePageQueryValues(page.query, requestQuery)
  if (Object.keys(values).length === 0) return page

  const substitute = (str: string): string =>
    str.includes('$query.')
      ? str.replaceAll(QUERY_REFERENCE, (match, name: string) => values[name] ?? match)
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
