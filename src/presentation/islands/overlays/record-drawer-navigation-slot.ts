/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createElement, Fragment, type ReactElement } from 'react'
import { DrawerNavigation, type DrawerNavigationProps } from './record-drawer-navigation'
import type { RawRecord } from './record-drawer-record-read'

export type { DrawerNavigationProps }

/**
 * The drawer's related slot with its navigation ahead of it, or the slot
 * unchanged when the drawer declares no `navigation` — so a drawer without the
 * option renders exactly what it rendered before.
 */
export function withDrawerNavigation(
  props: DrawerNavigationProps & { readonly id?: string },
  current: { readonly record: RawRecord; readonly recordId: string | undefined },
  related: ReactElement | undefined
): ReactElement | undefined {
  if (props.navigation === undefined) return related
  return createElement(
    Fragment,
    undefined,
    createElement(DrawerNavigation, {
      id: props.id,
      navigation: props.navigation,
      record: current.record,
      recordId: current.recordId,
    }),
    related
  )
}
