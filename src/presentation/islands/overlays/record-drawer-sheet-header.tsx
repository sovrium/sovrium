/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import {
  computeSheetDescriptionClasses,
  computeSheetTitleClasses,
} from '@/presentation/design/sheet-default-classes'
import type { SheetHeaderParts } from './record-drawer-navigation-slot'
import type { ReactElement, ReactNode } from 'react'

const TITLE_CLASS = computeSheetTitleClasses()
/** shadcn's `sheet-header`, its title and description beside the record's navigation. */
const HEADER_CLASS = 'flex flex-wrap items-start justify-between gap-2 pr-8'
const HEADING_CLASS = 'flex min-w-0 flex-col gap-0.5'

/**
 * The sheet's header: its title, under it the record's place in the list that
 * opened it, and beside them Previous and Next. The modal surface hands in
 * Base UI's title and description, so the dialog is named and described by
 * them; the region draws plain elements and is named by its `aria-label`.
 */
export function SheetHeader({
  title,
  header,
  modal,
}: {
  readonly title: string
  readonly header: SheetHeaderParts | undefined
  readonly modal: boolean
}): ReactElement {
  const titleNode: ReactNode = modal ? (
    <Dialog.Title
      data-slot="sheet-title"
      className={TITLE_CLASS}
    >
      {title}
    </Dialog.Title>
  ) : (
    <h2
      data-slot="sheet-title"
      className={TITLE_CLASS}
    >
      {title}
    </h2>
  )
  const position = header?.position
  const description: ReactNode =
    position === undefined ? undefined : modal ? (
      <Dialog.Description
        data-slot="sheet-description"
        className={computeSheetDescriptionClasses()}
      >
        {position}
      </Dialog.Description>
    ) : (
      <p
        data-slot="sheet-description"
        className={computeSheetDescriptionClasses()}
      >
        {position}
      </p>
    )
  return (
    <div
      data-slot="sheet-header"
      className={HEADER_CLASS}
    >
      <div className={HEADING_CLASS}>
        {titleNode}
        {description}
      </div>
      {header?.navigation}
    </div>
  )
}
