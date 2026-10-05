/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The inline prefills a page gives an embedded form.
 *
 * A page embeds a top-level form with a `formRef` node, and may fill some of
 * its fields from the page's record or the request through `inlinePrefill`.
 * The node can sit anywhere the renderer draws: directly on the page, in a
 * container's, tab set's or dialog's `children`, in a breakpoint's children, or
 * inside a template the page places by reference. This answers, for one page
 * and one form, every prefill map those nodes carry — the same reach as the
 * component-tree walk every other "what does this page draw?" question uses.
 */

import {
  placedTemplatesOf,
  renderedNodesWhere,
  type TreeNode,
} from '@/domain/models/app/pages/component-tree-has-type'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** The `inlinePrefill.prefill` map of a node, when it carries one. */
const inlinePrefillOf = (node: TreeNode): Readonly<Record<string, unknown>> | undefined => {
  const inline = node['inlinePrefill'] as { readonly prefill?: unknown } | null | undefined
  const prefill = inline?.prefill
  return prefill !== null && typeof prefill === 'object'
    ? (prefill as Readonly<Record<string, unknown>>)
    : undefined
}

/** Every `inlinePrefill` map a node embedding `formName` carries on `page`. */
export const formEmbeddingPrefills = (
  app: App,
  page: Page,
  formName: string
): readonly Readonly<Record<string, unknown>>[] => {
  const items = (page.components ?? []) as readonly unknown[]
  const placed = placedTemplatesOf(items, (app.components ?? []) as readonly unknown[])
  return renderedNodesWhere(items, placed, (node) => node['formRef'] === formName).flatMap(
    (node) => {
      const prefill = inlinePrefillOf(node)
      return prefill === undefined ? [] : [prefill]
    }
  )
}
