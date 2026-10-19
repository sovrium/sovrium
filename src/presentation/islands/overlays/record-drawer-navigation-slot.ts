/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createElement, type ReactElement } from 'react'
import { DrawerNavigation, type DrawerNavigationProps } from './record-drawer-navigation'
import { drawerPosition } from './record-drawer-opening-list'
import type { DrawerBuiltInLabels } from './record-drawer-labels'
import type { RawRecord } from './record-drawer-record-read'

export type { DrawerNavigationProps }

/** What the sheet header draws beside its title: the navigation, and the record's place. */
export interface SheetHeaderParts {
  readonly navigation?: ReactElement
  /** `2 of 3`: where the record stands in the list that opened the sheet. */
  readonly position?: string
}

/**
 * The navigation a sheet's header holds beside its title, and the record's
 * place in the opening list under it — nothing at all when the drawer declares
 * no `navigation`, so a drawer without the option draws what it drew before.
 */
export function drawerHeaderParts(
  props: DrawerNavigationProps & {
    readonly id?: string
    readonly builtInLabels?: DrawerBuiltInLabels
  },
  current: { readonly record: RawRecord; readonly recordId: string | undefined }
): SheetHeaderParts {
  if (props.navigation === undefined) return {}
  const navigation = createElement(DrawerNavigation, {
    id: props.id,
    navigation: props.navigation,
    record: current.record,
    recordId: current.recordId,
    labels: props.builtInLabels,
  })
  const position =
    props.navigation.siblings === true
      ? drawerPosition(props.id, current.recordId, props.builtInLabels?.position)
      : undefined
  return { navigation, ...(position === undefined ? {} : { position }) }
}
