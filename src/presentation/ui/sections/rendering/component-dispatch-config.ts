/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { RouteParams } from '@/domain/utils/route-matcher'
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
  readonly action?: Component['action']
  /** Original component definition (for element/variant routing) */
  readonly component?: Component
  /** Original component props before transformation (for island components) */
  readonly rawProps?: Record<string, unknown>
  readonly tables?: Tables
  /** Schema buckets — used by rich-text field renderer to pick the upload target */
  readonly buckets?: Buckets
  readonly routeParams?: RouteParams
}

/**
 * Component renderer function type
 */
export type ComponentRenderer = (config: ComponentDispatchConfig) => ReactElement | null
