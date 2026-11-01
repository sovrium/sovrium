/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { InlineScript } from '@/presentation/design/inline-script'
import { FAVORITES_BUTTON_RUNTIME } from './favorites-button-runtime'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** Shape of the render-time-synthesized `favorites-button` component. */
interface FavoritesButtonComponent {
  readonly entityType?: string
  readonly entityId?: string
  readonly tableName?: string
}

/**
 * Renderer for the render-time-synthesized `favorites-button` component.
 *
 * This component type is never schema-authored — it is injected into a
 * single-record-bound container by `data-source-resolver` so that any record
 * detail page automatically gets a star toggle. The renderer emits an
 * accessible `<button>` plus the inline toggle runtime above.
 */
export const favoritesButtonComponent: ComponentRenderer = ({ component }): ReactElement => {
  const synthesized = (component ?? {}) as FavoritesButtonComponent
  const { tableName } = synthesized
  const entityType = synthesized.entityType ?? 'record'
  const entityId = synthesized.entityId ?? ''

  return (
    <>
      <button
        type="button"
        data-favorites-toggle="true"
        data-entity-type={entityType}
        data-entity-id={entityId}
        data-table-name={tableName}
        data-favorited="false"
        aria-pressed="false"
        aria-label="Add to favorites"
        style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.25rem' }}
      >
        {'☆'}
      </button>
      <InlineScript source={FAVORITES_BUTTON_RUNTIME} />
    </>
  )
}
