/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FORM_REF_HOST_TYPES } from './components/component-types/component-type-union'

/**
 * The `app.forms[]` name a page-component node embeds by `formRef`, or
 * `undefined` when the node embeds none.
 *
 * The ONE predicate behind every "which forms does this page embed?" question —
 * the router's embedded-form access gate and the page-search corpus both ask it,
 * and a page is only as private as the narrower of the two answers. It honours
 * every component kind whose schema declares `formRef` (`FORM_REF_HOST_TYPES`),
 * so a `dialog` wrapping a role-restricted form gates the page exactly as a bare
 * `form` does.
 */
export const readEmbeddedFormRef = (node: unknown): string | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const { type, formRef } = node as { readonly type?: unknown; readonly formRef?: unknown }
  if (typeof type !== 'string' || !FORM_REF_HOST_TYPES.has(type)) return undefined
  return typeof formRef === 'string' ? formRef : undefined
}
