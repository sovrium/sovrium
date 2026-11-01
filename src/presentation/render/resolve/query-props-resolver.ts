/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePageQueryValues } from '@/domain/models/app/pages/query-props'
import { substituteTemplatesDeep, type ValueEncoder } from './html-template-values'
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
 * A value is always TEXT, even inside content written as HTML: an `enum` bounds
 * which values a visitor may pick, not what characters an author put in them
 * (`'<unassigned>'`). So an HTML template takes each value HTML-escaped, and a
 * text template a value would flip onto the raw-HTML branch is pinned to text —
 * `substituteTemplatesDeep`, the rule the `$app` and `$param` passes share.
 *
 * Pure, and a page declaring no `query` is returned by reference.
 */
export function resolvePageQueryProps(
  page: Page,
  requestQuery: Readonly<Record<string, string>> | undefined
): Page {
  const values = resolvePageQueryValues(page.query, requestQuery)
  if (Object.keys(values).length === 0) return page

  const fill = (str: string, encode: ValueEncoder = (value) => value): string =>
    str.includes('$query.')
      ? str.replaceAll(QUERY_REFERENCE, (match, name: string) => {
          const value = values[name]
          return value === undefined ? match : encode(value)
        })
      : str

  return {
    ...page,
    ...(page.components !== undefined
      ? { components: substituteTemplatesDeep(page.components, fill) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: substituteTemplatesDeep(page.layout, fill) as Page['layout'] }
      : {}),
  }
}
