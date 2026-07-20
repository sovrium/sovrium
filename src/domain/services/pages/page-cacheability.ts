/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'

const hasNonPublicAccess = (access: Page['access']): boolean =>
  access !== undefined && access !== 'all'

const DYNAMIC_PAGE_SIGNALS: readonly ((page: Page) => boolean)[] = [
  (page) => hasNonPublicAccess(page.access),
  (page) => page.collection !== undefined,
  (page) => page.dataSource !== undefined,
  (page) => page.contentDir !== undefined,
  (page) => page.source !== undefined,
  (page) => page.markdown !== undefined,
  (page) => page.presence === true,
  (page) => page.layout?.sidebar !== undefined,
  (page) => page.path.includes(':'),
]

function componentTreeHasDataSource(items: readonly unknown[]): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as Record<string, unknown>
    if ('$ref' in node || 'component' in node) return false
    if (node.dataSource !== undefined) return true
    const { children } = node
    return Array.isArray(children) ? componentTreeHasDataSource(children) : false
  })
}

export const isPageCacheable = (page: Page): boolean =>
  !DYNAMIC_PAGE_SIGNALS.some((signal) => signal(page)) &&
  !componentTreeHasDataSource(page.components)

const formHasQueryPrefill = (form: Readonly<Form>): boolean => {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, unknown>> }
  if (prefill === undefined) return false
  return Object.values(prefill).some(
    (value) => typeof value === 'string' && value.startsWith('$query.')
  )
}

function nodeEmbedsQueryPrefillForm(
  node: Record<string, unknown>,
  forms: readonly Form[]
): boolean {
  if (node.type !== 'form' && node.type !== 'dialog') return false
  if (typeof node.formRef !== 'string') return false
  const form = forms.find((candidate) => candidate.name === node.formRef)
  return form !== undefined && formHasQueryPrefill(form)
}

function componentTreeHasQueryPrefillForm(
  items: readonly unknown[],
  forms: readonly Form[]
): boolean {
  return items.some((item) => {
    if (item === null || typeof item !== 'object') return false
    const node = item as Record<string, unknown>
    if ('$ref' in node || 'component' in node) return false
    if (nodeEmbedsQueryPrefillForm(node, forms)) return true
    const { children } = node
    return Array.isArray(children) ? componentTreeHasQueryPrefillForm(children, forms) : false
  })
}

export function isRenderablePathCacheable(app: App, path: string): boolean {
  const { pages } = app
  if (!pages || pages.length === 0) return path === '/'

  const match = findMatchingRoute(
    pages.map((page) => page.path),
    path
  )
  if (!match) return path === '/'

  const page = pages[match.index]
  if (!page) return path === '/'
  if (componentTreeHasQueryPrefillForm(page.components ?? [], app.forms ?? [])) return false
  return isPageCacheable(page)
}
