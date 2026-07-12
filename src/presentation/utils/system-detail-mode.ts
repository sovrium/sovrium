/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Component } from '@/domain/models/app/pages/components'

function hasOwnSystemDetailSource(component: Component): boolean {
  const dataSource = component.dataSource as { readonly system?: unknown } | undefined
  return dataSource?.system !== undefined
}

export function isRecordFieldSystemMode(component: Component): boolean {
  return component.type === 'record-field' && hasOwnSystemDetailSource(component)
}

export function isRecordDrawerSystemMode(component: Component): boolean {
  return component.type === 'record-drawer' && hasOwnSystemDetailSource(component)
}
