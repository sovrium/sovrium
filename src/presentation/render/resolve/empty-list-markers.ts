/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * What a server-drawn `list` with no row should draw instead, stamped for the
 * list renderer (`render/registry/empty-bound-list.tsx`): `_listHideWhenEmpty`
 * when `listDisplay.hideWhenEmpty` asks for nothing at all, and
 * `_listEmptyMessage` when it declares an empty message. Any other component
 * type carries neither.
 */
export function emptyListMarkers(component: Component): Readonly<Record<string, unknown>> {
  if (component.type !== 'list') return {}
  const { listDisplay } = component as {
    readonly listDisplay?: { readonly emptyMessage?: unknown; readonly hideWhenEmpty?: unknown }
  }
  return {
    ...(listDisplay?.hideWhenEmpty === true && { _listHideWhenEmpty: true }),
    ...(typeof listDisplay?.emptyMessage === 'string' && {
      _listEmptyMessage: listDisplay.emptyMessage,
    }),
  }
}
