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
import type { SessionInfo } from '@/domain/types/session-info'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'
import type { ReactElement } from 'react'

export interface ComponentDispatchConfig {
  readonly type: Component['type']
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly content: string | undefined
  readonly renderedChildren: readonly ReactElement[]
  readonly theme: Theme | undefined
  readonly languages: Languages | undefined
  readonly currentLang?: string
  readonly interactions?: Component['interactions']
  readonly action?: Component['action']
  readonly component?: Component
  readonly rawProps?: Record<string, unknown>
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly landingPath?: string
  readonly routeParams?: RouteParams
  readonly session?: SessionInfo
}

export type ComponentRenderer = (config: ComponentDispatchConfig) => ReactElement | null
