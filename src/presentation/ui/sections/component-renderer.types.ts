/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Components } from '@/domain/models/app/components'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Theme } from '@/domain/models/app/theme'

export type ComponentRendererProps = {
  readonly component: Component | SimpleComponentReference | ComponentReference
  readonly componentName?: string
  readonly componentInstanceIndex?: number
  readonly components?: Components
  readonly theme?: Theme
  readonly languages?: Languages
  readonly currentLang?: string
}

export const CONTAINER_TYPES = ['div', 'container', 'flex', 'grid', 'card', 'badge'] as const
