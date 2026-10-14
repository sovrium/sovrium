/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Dialog } from '@base-ui/react/dialog'
import { cn } from '@/presentation/design/class-merge'
import { computeDialogCloseClasses } from '@/presentation/design/dialog-default-classes'
import { OverlayCloseGlyph } from '@/presentation/design/overlay-close-glyph'
import { useLiveInjectedMarkup } from './live-injected-markup'
import {
  computeSheetClosePositionClasses,
  computeSheetDescriptionClasses,
  computeSheetFooterClasses,
  computeSheetHeaderClasses,
  computeSheetTitleClasses,
} from './sheet-default-classes'
import type { ReactElement } from 'react'

function DrawerHeader({
  title,
  description,
}: {
  readonly title?: string
  readonly description?: string
}): ReactElement | undefined {
  if (!title && !description) return undefined
  return (
    <div
      data-slot="sheet-header"
      className={computeSheetHeaderClasses()}
    >
      {title && (
        <Dialog.Title
          data-slot="sheet-title"
          className={computeSheetTitleClasses()}
        >
          {title}
        </Dialog.Title>
      )}
      {description && (
        <Dialog.Description
          data-slot="sheet-description"
          className={computeSheetDescriptionClasses()}
        >
          {description}
        </Dialog.Description>
      )}
    </div>
  )
}

interface DrawerPopupBodyProps {
  readonly title?: string
  readonly description?: string
  readonly closeLabel: string
  readonly childrenHtml?: string
  /** The footer's components, as markup: shadcn/ui's SheetFooter, below the body. */
  readonly footerHtml?: string
  /** `false` draws no close button; Escape and the overlay still close the sheet. */
  readonly showCloseButton?: boolean
  readonly onInjected?: (container: HTMLElement) => void
}

/**
 * The drawer's body markup, brought to life: injected when the popup opens, its
 * scripts run and its island markers mounted — so a form placed in a drawer
 * submits through its action — and unmounted when the popup closes, so a
 * reopened drawer holds exactly one live copy.
 *
 * `onInjected` runs after injection and before the islands mount; the quick-
 * edit drawer binds the dispatched record to its form there.
 *
 * SECURITY: `html` is server-rendered from the app's configuration, not user
 * input.
 */
function DrawerChildren({
  html,
  onInjected,
}: {
  readonly html: string
  readonly onInjected?: (container: HTMLElement) => void
}): ReactElement {
  const ref = useLiveInjectedMarkup(html, onInjected)
  return <div ref={ref} />
}

/**
 * Renders the contents of the drawer popup. Extracted so the parent
 * island stays under the `max-lines-per-function` ESLint cap.
 */
export function DrawerPopupBody({
  title,
  description,
  closeLabel,
  childrenHtml,
  footerHtml,
  showCloseButton = true,
  onInjected,
}: DrawerPopupBodyProps): ReactElement {
  const headed = Boolean(title || description)
  return (
    <>
      <DrawerHeader
        title={title}
        description={description}
      />
      <div
        className={
          headed ? 'min-h-0 flex-1 overflow-auto px-4 pb-4' : 'min-h-0 flex-1 overflow-auto p-4'
        }
      >
        {childrenHtml && (
          <DrawerChildren
            html={childrenHtml}
            onInjected={onInjected}
          />
        )}
      </div>
      {footerHtml === undefined ? undefined : (
        <div
          data-slot="sheet-footer"
          className={computeSheetFooterClasses()}
        >
          <DrawerChildren html={footerHtml} />
        </div>
      )}
      {showCloseButton ? (
        <Dialog.Close
          data-overlay-close=""
          data-slot="sheet-close"
          aria-label={closeLabel}
          className={cn(computeDialogCloseClasses(), computeSheetClosePositionClasses())}
        >
          <OverlayCloseGlyph />
        </Dialog.Close>
      ) : undefined}
    </>
  )
}
