/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'
import type { ReactElement } from 'react'

/**
 * Configuration object for component dispatching
 * Replaces multiple function parameters with a single config object
 */
export interface ComponentDispatchConfig {
  readonly type: Component['type']
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly content: string | undefined
  readonly renderedChildren: readonly ReactElement[]
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly interactions?: Component['interactions']
}

/**
 * Component renderer function type
 */
export type ComponentRenderer = (config: ComponentDispatchConfig) => ReactElement | null
