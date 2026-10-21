/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE OPEN OVERLAY, DRAWN IN A FRAME — `dialog`, `alert-dialog`, `sheet` and
 * `drawer` as a still document shows them open.
 *
 * Each of the four opens over the whole page from a portal, so none has a
 * resting appearance; drawn live on a page it would cover it, and a modal one
 * would make the rest of the document inert. A depiction draws the panel the
 * island draws — the same class recipes, the same `data-slot` anatomy — inside
 * a bounded frame instead: the frame establishes the containing block
 * (`contain: paint`), so the recipe's `fixed` positioning lands in the frame
 * rather than over the page, and the backdrop dims the frame alone.
 *
 * What it withholds is what the open-specimen bridge withholds (see
 * `open-specimen-renderer.ts`): the dialog role and modality — a dialog nobody
 * opened is a second dialog the document advertises — and every handler. It
 * emits no island marker, so nothing hydrates it, and no script opens it.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import {
  DRAWER_CONTENT_CLASSES,
  DRAWER_DESCRIPTION_CLASSES,
  DRAWER_HANDLE_CLASSES,
  DRAWER_HEADER_CLASSES,
  DRAWER_OVERLAY_CLASSES,
  DRAWER_POPUP_CLASSES,
  DRAWER_TITLE_CLASSES,
} from '@/presentation/design/bottom-drawer-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeDialogContentClasses,
  computeDialogDescriptionClasses,
  computeDialogFooterClasses,
  computeDialogHeaderClasses,
  computeDialogOverlayClasses,
  computeDialogTitleClasses,
  computeSheetOverlayClasses,
  type DialogKind,
} from '@/presentation/design/dialog-default-classes'
import {
  computeSheetContentClasses,
  computeSheetDescriptionClasses,
  computeSheetHeaderClasses,
  computeSheetTitleClasses,
} from '@/presentation/design/sheet-default-classes'
import type { ReactElement } from 'react'

/** The four overlays a frame can hold open. */
export type OpenOverlayKind = 'dialog' | 'alert-dialog' | 'sheet' | 'drawer'

/** What an open overlay shows: its heading, its body, and an alert's two answers. */
export interface OpenOverlayContent {
  readonly title?: string
  readonly description?: string
  /** The overlay's own children, already rendered. */
  readonly childrenHtml?: string
  /** An alert dialog's answers: the dismissal, then the confirmation. */
  readonly answers?: {
    readonly cancel: string
    readonly confirm: string
    readonly destructive: boolean
  }
}

/**
 * The frame: tall enough to hold a dialog or a sheet beside the page it would
 * cover, and the containing block of everything `fixed` inside it.
 */
const FRAME_CLASSES =
  'relative h-96 w-full overflow-hidden rounded-lg border border-border bg-background [contain:paint]'

/** A heading's two lines, in the overlay's own slot names and recipes. */
function heading({
  slot,
  classes,
  content,
}: {
  readonly slot: string
  readonly classes: {
    readonly header: string
    readonly title: string
    readonly description: string
  }
  readonly content: OpenOverlayContent
}): ReactElement | null {
  if (content.title === undefined && content.description === undefined) return null
  return (
    <div
      data-slot={`${slot}-header`}
      className={classes.header}
    >
      {content.title === undefined ? null : (
        <h2
          data-slot={`${slot}-title`}
          className={classes.title}
        >
          {content.title}
        </h2>
      )}
      {content.description === undefined ? null : (
        <p
          data-slot={`${slot}-description`}
          className={classes.description}
        >
          {content.description}
        </p>
      )}
    </div>
  )
}

/** The overlay's own children, as the island injects them. */
function body({ html, className }: { readonly html?: string; readonly className?: string }) {
  if (html === undefined || html === '') return null
  return (
    <div
      className={className}
      // eslint-disable-next-line sovrium/require-sanitized-html -- the overlay's own children, server-rendered by renderToStaticMarkup, which escapes every text and attribute value
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** A dialog or an alert dialog, centred in the frame over its backdrop. */
function dialogDepiction({
  kind,
  content,
}: {
  readonly kind: DialogKind
  readonly content: OpenOverlayContent
}): ReactElement {
  const { answers } = content
  return (
    <>
      <div
        data-slot={`${kind}-overlay`}
        data-open=""
        className={computeDialogOverlayClasses()}
      />
      <div
        data-slot={`${kind}-content`}
        data-state="open"
        data-open=""
        data-size={kind === 'alert-dialog' ? 'default' : undefined}
        className={computeDialogContentClasses(kind)}
      >
        {heading({
          slot: kind,
          classes: {
            header: computeDialogHeaderClasses(kind),
            title: computeDialogTitleClasses(kind),
            description: computeDialogDescriptionClasses(kind),
          },
          content,
        })}
        {body({ html: content.childrenHtml })}
        {answers === undefined ? null : (
          <div
            data-slot={`${kind}-footer`}
            className={computeDialogFooterClasses(kind)}
          >
            <span className={computeButtonDefaultClasses({ variant: 'outline' })}>
              {answers.cancel}
            </span>
            <span
              className={computeButtonDefaultClasses({
                variant: answers.destructive ? 'destructive' : 'default',
              })}
            >
              {answers.confirm}
            </span>
          </div>
        )}
      </div>
    </>
  )
}

/** A sheet, slid in from the frame's right edge. */
function sheetDepiction({ content }: { readonly content: OpenOverlayContent }): ReactElement {
  return (
    <>
      <div
        data-slot="sheet-overlay"
        data-open=""
        className={computeSheetOverlayClasses()}
      />
      <div
        data-slot="sheet-content"
        data-side="right"
        data-state="open"
        data-open=""
        className={`${computeSheetContentClasses()} w-80`}
      >
        {heading({
          slot: 'sheet',
          classes: {
            header: computeSheetHeaderClasses(),
            title: computeSheetTitleClasses(),
            description: computeSheetDescriptionClasses(),
          },
          content,
        })}
        {body({ html: content.childrenHtml, className: 'min-h-0 flex-1 overflow-auto px-4 pb-4' })}
      </div>
    </>
  )
}

/** A drawer, risen from the frame's bottom edge, its handle above its heading. */
function drawerDepiction({ content }: { readonly content: OpenOverlayContent }): ReactElement {
  return (
    <>
      <div
        data-slot="drawer-overlay"
        data-open=""
        className={DRAWER_OVERLAY_CLASSES}
      />
      <div
        data-slot="drawer-popup"
        data-swipe-axis="y"
        data-swipe-direction="down"
        data-state="open"
        data-open=""
        className={DRAWER_POPUP_CLASSES}
      >
        <div
          data-slot="drawer-handle"
          aria-hidden="true"
          className={DRAWER_HANDLE_CLASSES}
        />
        <div
          data-slot="drawer-content"
          data-open=""
          className={DRAWER_CONTENT_CLASSES}
        >
          {heading({
            slot: 'drawer',
            classes: {
              header: DRAWER_HEADER_CLASSES,
              title: DRAWER_TITLE_CLASSES,
              description: DRAWER_DESCRIPTION_CLASSES,
            },
            content,
          })}
          {body({
            html: content.childrenHtml,
            className: 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4',
          })}
        </div>
      </div>
    </>
  )
}

/** One overlay drawn open inside its own frame, as markup. */
export function renderOpenOverlay(kind: OpenOverlayKind, content: OpenOverlayContent): string {
  const depiction =
    kind === 'sheet'
      ? sheetDepiction({ content })
      : kind === 'drawer'
        ? drawerDepiction({ content })
        : dialogDepiction({ kind, content })
  return renderToStaticMarkup(
    <div
      data-slot="overlay-frame"
      data-specimen-open="true"
      className={FRAME_CLASSES}
    >
      {depiction}
    </div>
  )
}
