/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Families 2, 3 and 5 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): `redirectToFirst`
 * needs a list, a `breadcrumb` enumerates XOR derives, and a sidebar group has
 * something under it. Pure.
 */

/**
 * `redirectToFirst` resolves the FIRST row of a list and 302s to it. A page with
 * no list source resolves no rows, so the property could never fire — which
 * reads as "the redirect is broken" rather than "the redirect is unreachable".
 *
 * A list source is either a component-level rows binding (`dataSource.system`
 * inline, or `dataSource.systemSource` by catalog name) or a page-level DB
 * binding in `mode: list`.
 */
export function redirectToFirstViolations(
  page: Readonly<Record<string, unknown>>,
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  if (page['redirectToFirst'] === undefined) return []
  if (hasListSource(page, nodes)) return []
  return [
    `${label} declares redirectToFirst but resolves no list: add a component dataSource.system / dataSource.systemSource, or a page-level dataSource with mode: list`,
  ]
}

function hasListSource(
  page: Readonly<Record<string, unknown>>,
  nodes: readonly Record<string, unknown>[]
): boolean {
  const pageSource = page['dataSource']
  if (isRecord(pageSource) && pageSource['mode'] === 'list') return true

  return nodes.some((node) => {
    const { dataSource } = node
    if (!isRecord(dataSource)) return false
    return isRecord(dataSource['system']) || typeof dataSource['systemSource'] === 'string'
  })
}

export function breadcrumbViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['type'] === 'breadcrumb')
    .flatMap((node) => {
      const hasDerive = node['derive'] !== undefined
      return [
        ...(node['breadcrumbItems'] !== undefined && hasDerive
          ? [
              `${label} declares a breadcrumb with both breadcrumbItems and derive — keep one: an enumerated trail OR a path-derived one`,
            ]
          : []),
        ...(node['labels'] !== undefined && !hasDerive
          ? [
              `${label} declares breadcrumb labels without derive — the label map relabels DERIVED path segments and is inert on an enumerated trail`,
            ]
          : []),
        ...(node['home'] !== undefined && !hasDerive
          ? [
              `${label} declares a breadcrumb home crumb without derive — an enumerated trail states its own first item, so the root crumb would be a duplicate`,
            ]
          : []),
        ...(node['unlinked'] !== undefined && !hasDerive
          ? [
              `${label} declares breadcrumb unlinked without derive — unlinked names DERIVED path segments to keep as text, and an enumerated trail links only the items that carry an href`,
            ]
          : []),
      ]
    })
}

export function sidebarGroupViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes
    .filter((node) => node['type'] === 'sidebar')
    .flatMap((node) => (Array.isArray(node['groups']) ? node['groups'] : []))
    .filter(isRecord)
    .filter((group) => group['items'] === undefined && group['source'] === undefined)
    .map((group) => {
      const name = typeof group['label'] === 'string' ? group['label'] : 'unnamed'
      return `${label} declares sidebar group "${name}" with neither items nor source — a heading with no entries under it`
    })
}
