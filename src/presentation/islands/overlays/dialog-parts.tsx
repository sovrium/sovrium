/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import {
  computeDialogDescriptionClasses,
  computeDialogHeaderClasses,
  computeDialogTitleClasses,
  type DialogKind,
} from '@/presentation/design/dialog-default-classes'
import { useLiveInjectedMarkup } from './live-injected-markup'
import type { MouseEvent, ReactElement } from 'react'

/**
 * The dialog's body: the SSR-rendered children, injected when the popup opens.
 *
 * The popup does not exist until the dialog opens, so this markup arrives after
 * the page's first-load pass — `useLiveInjectedMarkup` runs its scripts and
 * mounts its island markers, which is what lets a form placed in a dialog
 * submit through its action. Closing unmounts the popup, and with it those
 * islands, so a reopened dialog holds exactly one live copy.
 *
 * SECURITY: `html` is server-rendered from the app's configuration, not user
 * input.
 */
export function DialogChildren({
  html,
  onCancel,
}: {
  readonly html: string
  /** Closes the dialog: a hosted form's Cancel (`data-dialog-cancel`) was pressed. */
  readonly onCancel: (event: MouseEvent<HTMLDivElement>) => void
}): ReactElement {
  const ref = useLiveInjectedMarkup(html)
  return (
    <div
      ref={ref}
      onClick={onCancel}
    />
  )
}

/**
 * The `*-header` slot: the title and the description, omitted when the author
 * declared neither (shadcn's anatomy has no empty header).
 */
export function DialogHeading({
  kind,
  title,
  description,
  media,
}: {
  readonly kind: DialogKind
  readonly title?: string
  readonly description?: string
  /** The `alert-dialog-media` tile, drawn first in the header. */
  readonly media?: ReactElement
}): ReactElement | undefined {
  if (!title && !description) return undefined
  return (
    <div
      data-slot={`${kind}-header`}
      className={computeDialogHeaderClasses(kind)}
    >
      {media}
      {title && (
        <Dialog.Title
          data-slot={`${kind}-title`}
          className={computeDialogTitleClasses(kind)}
        >
          {title}
        </Dialog.Title>
      )}
      {description && (
        <Dialog.Description
          data-slot={`${kind}-description`}
          className={computeDialogDescriptionClasses(kind)}
        >
          {description}
        </Dialog.Description>
      )}
    </div>
  )
}
