/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import * as Renderers from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/pages/components'

export const searchShellComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  searchInput: ({ elementProps, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const debounceMs = c['debounceMs'] as number | undefined
    const minQueryLength = c['minQueryLength'] as number | undefined
    return Renderers.renderSearchInput({ props: elementProps, debounceMs, minQueryLength })
  },

  pageSearch: ({ elementProps, component }) => {
    const c = (component ?? {}) as Record<string, unknown>
    const placeholder = c['placeholder'] as string | undefined
    const maxResults = c['maxResults'] as number | undefined
    return Renderers.renderPageSearch({ props: elementProps, placeholder, maxResults })
  },
}
