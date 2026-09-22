/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildDerivedCrumbs } from '@/domain/models/app/pages/derived-breadcrumb'
import type { Page } from '@/domain/models/app/pages'

/**
 * Resolve every `breadcrumb` with `derive: 'path'` on the page into the
 * concrete `breadcrumbItems` the renderer already knows how to draw.
 *
 * Resolving HERE rather than in the renderer is what keeps the change small:
 * the request path is in hand in `renderPageByPath`, and threading it down to
 * the component dispatcher would mean a new prop on six files along the
 * `render-page → DynamicPage → PageMain → SectionRenderer → ComponentRenderer`
 * chain, all of it inert for every component but this one. The renderer needs
 * no change at all — a derived trail reaches it as an enumerated one, which is
 * also why the two forms cannot drift apart in markup or accessibility.
 *
 * `derive` and `labels` are stripped on the way out, so nothing downstream can
 * act on a binding that has already been consumed.
 *
 * The walk is structural rather than typed against the component union: the
 * union is ~58 branches wide and each carries its own children key, so a typed
 * traversal would need updating for every new container type and would fail
 * SILENTLY (a missed branch is a breadcrumb that stops deriving, not a compile
 * error). Same reasoning, and same trade-off, as `collectPageBindingViolations`.
 */
export function resolveDerivedBreadcrumbs(
  page: Page,
  requestPath: string,
  basePath?: string
): Page {
  if (!hasDerivedBreadcrumb(page.components) && !hasDerivedBreadcrumb(page.layout)) return page
  const base = basePath ?? ''
  return {
    ...page,
    ...(page.components !== undefined
      ? { components: transform(page.components, requestPath, base) as Page['components'] }
      : {}),
    ...(page.layout !== undefined
      ? { layout: transform(page.layout, requestPath, base) as Page['layout'] }
      : {}),
  }
}

/**
 * Cheap pre-check so a page with no derived breadcrumb — which is nearly every
 * page — is returned by reference rather than deep-copied on every request.
 */
function hasDerivedBreadcrumb(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDerivedBreadcrumb)
  if (!isRecord(value)) return false
  if (value['type'] === 'breadcrumb' && value['derive'] === 'path') return true
  return Object.values(value).some(hasDerivedBreadcrumb)
}

function transform(value: unknown, requestPath: string, basePath: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => transform(entry, requestPath, basePath))
  if (!isRecord(value)) return value

  const mapped = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, transform(child, requestPath, basePath)])
  )
  if (value['type'] !== 'breadcrumb' || value['derive'] !== 'path') return mapped

  const { derive: _derive, labels: _labels, home: _home, ...rest } = mapped
  return {
    ...rest,
    breadcrumbItems: buildDerivedCrumbs(requestPath, readLabels(value['labels']), {
      ...(readHome(value['home']) !== undefined ? { home: readHome(value['home'])! } : {}),
      basePath,
    }),
  }
}

/**
 * The declared root crumb, if any.
 *
 * Its `label` has already had `$app.*` and `$t:` resolved by the time the page
 * reaches here, so what arrives is the literal the trail prints.
 */
function readHome(value: unknown): { readonly label: string } | undefined {
  if (!isRecord(value)) return undefined
  const { label } = value
  return typeof label === 'string' && label.length > 0 ? { label } : undefined
}

function readLabels(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) return undefined
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
