/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Interactions } from '@/domain/models/app/page/common/interactions/interactions'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Configuration for building test IDs
 * Replaces 5 parameters with a single config object
 */
export interface TestIdConfig {
  readonly type: Component['type']
  readonly componentName?: string
  readonly componentInstanceIndex?: number
  readonly substitutedProps?: Record<string, unknown>
  readonly childIndex?: number
}

/**
 * Configuration for building element props
 * Replaces 12 parameters with a single config object
 */
export interface ElementPropsConfig {
  readonly type: Component['type']
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly finalClassName: string | undefined
  readonly styleWithShadow: Record<string, unknown> | undefined
  readonly componentName: string | undefined
  readonly componentInstanceIndex: number | undefined
  readonly firstTranslationKey: string | undefined
  readonly translationData: Record<string, string> | undefined
  readonly hasContent: boolean
  readonly hasChildren: boolean
  readonly theme: Theme | undefined
  readonly childIndex?: number
  readonly interactions?: Interactions
}
