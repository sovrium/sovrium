/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  GALLERY_CARD_AVATAR_CLASSES,
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_CARD_BODY_NO_COVER_CLASSES,
  GALLERY_CARD_DEFAULT_TITLE_CLASSES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardBadgeClasses,
  computeGalleryCardClasses,
  computeGalleryImageClasses,
  computeGalleryOverlayClasses,
  resolveGalleryAspectRatio,
} from '@/presentation/design/gallery-default-classes'
import {
  renderCardChild,
  resolveImageSource,
  substitute,
  type CardChildClasses,
} from '../kanban/card-template'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import type { TableRecord } from '../runtime/types'
import type { Action } from '@/domain/models/app/pages/components/action'
import type { GalleryCard } from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactElement } from 'react'

/** A card that opens a record: the pointer and the hover border say so. */
const CLICKABLE_CARD_CLASSES = 'cursor-pointer hover:border-primary'

/** The link a navigating card wraps its content in: a block, in the card's own colours. */
const GALLERY_CARD_LINK_CLASSES = 'block text-inherit no-underline'

/** The gallery's classes for the record components a card slot draws. */
const CARD_CHILD_CLASSES: CardChildClasses = {
  avatar: GALLERY_CARD_AVATAR_CLASSES,
  badge: computeGalleryCardBadgeClasses(),
}

/** An absent key reads as `undefined` when destructured, so a no-op result omits it. */
interface CardData {
  readonly navigatePath?: string
  readonly openDrawer?: () => void
  readonly coverImageSrc?: string
}

/**
 * Resolve onClick navigate action to a concrete path with $record.* substitutions.
 *
 * The path becomes a link's `href` and may carry record data, so it is held to
 * a board card's rule: a page on this site only. A filled path that points to
 * another site or at a script draws no link.
 */
function resolveNavigatePath(
  onClick: GalleryCard['onClick'],
  record: TableRecord
): string | undefined {
  if (!onClick || !('type' in onClick)) return undefined
  return toSafeRedirectPath(substitute(onClick.path, record))
}

/** The card's `openDrawer` click on this record, as a board card's opens it. */
function resolveDrawerOpener(
  onClick: GalleryCard['onClick'],
  record: TableRecord,
  table: string | undefined
): (() => void) | undefined {
  if (!onClick || !('action' in onClick)) return undefined
  const { component } = onClick
  return () => openCardDrawer(component, record, table)
}

/** Resolve `coverImage` template to a usable URL or undefined. */
function resolveCoverImage(
  coverImage: string | undefined,
  record: TableRecord
): string | undefined {
  return coverImage === undefined ? undefined : resolveImageSource(coverImage, record)
}

/** Resolve all card-template-derived values in one pass. */
function resolveCardData(
  card: GalleryCard | undefined,
  record: TableRecord,
  table: string | undefined
): CardData {
  if (!card) return {}
  return {
    navigatePath: resolveNavigatePath(card.onClick, record),
    openDrawer: resolveDrawerOpener(card.onClick, record, table),
    coverImageSrc: resolveCoverImage(card.coverImage, record),
  }
}

/** Default body when no card template is configured. */
function GalleryCardDefault({ record }: { readonly record: TableRecord }): ReactElement {
  const title =
    (record.title as string | undefined) ??
    (record.name as string | undefined) ??
    (record.label as string | undefined) ??
    String(record.id ?? '')
  return <p className={GALLERY_CARD_DEFAULT_TITLE_CLASSES}>{title}</p>
}

/**
 * Build the cover box's inline `style` from the author's `aspectRatio`.
 *
 * Inline rather than a Tailwind class because `galleryCard.aspectRatio` is a
 * free `Schema.String` — `'4:3'`, `'16:9'`, `'1:1'` are documented examples but
 * anything decodes — and a scan-free compiler cannot mint `aspect-[W/H]` for a
 * ratio it has never seen. The kanban column dot and the timeline bar already
 * carry their author-supplied value the same way.
 *
 * Returns `undefined` when the value is absent or unparseable; the caller then
 * falls back to the fixed height, because a box with neither a ratio nor a
 * height collapses to zero and the cover disappears entirely.
 *
 * Extracted from JSX so the object is not an inline literal prop, which
 * `react-perf/jsx-no-new-object-as-prop` forbids.
 */
function coverBoxStyle(aspectRatio: string | undefined): CSSProperties | undefined {
  const resolved = resolveGalleryAspectRatio(aspectRatio)
  return resolved === undefined ? undefined : { aspectRatio: resolved }
}

/**
 * Render the configured card template body (cover + children).
 *
 * The cover BOX owns the geometry and the image simply fills it. That split is
 * the fix for `galleryCard.aspectRatio`, which decoded and reached
 * `data-aspect-ratio` but painted nothing: the image carried a hard-coded
 * `h-40` at every card width, so the box computed `aspect-ratio: auto` and an
 * author's declared 4:3 was inert.
 *
 * `data-aspect-ratio` keeps carrying the RAW author value on the same element,
 * parsed or not — `[internal ref]` asserts it there.
 */
function GalleryCardBody({
  card,
  record,
  coverImageSrc,
}: {
  readonly card: GalleryCard
  readonly record: TableRecord
  readonly coverImageSrc: string | undefined
}): ReactElement {
  const boxStyle = coverBoxStyle(card.aspectRatio)
  const boxClasses = boxStyle
    ? computeGalleryImageClasses()
    : `${computeGalleryImageClasses()} ${GALLERY_COVER_FALLBACK_HEIGHT_CLASS}`
  return (
    <>
      {coverImageSrc && (
        <div
          data-aspect-ratio={card.aspectRatio}
          style={boxStyle}
          className={boxClasses}
        >
          <img
            src={coverImageSrc}
            alt=""
            loading={card.loading ?? 'lazy'}
            className={computeGalleryImageClasses({ part: 'img' })}
          />
        </div>
      )}
      <div className={GALLERY_CARD_BODY_CLASSES}>
        {card.children?.map((child, index) =>
          renderCardChild(child, record, index, CARD_CHILD_CLASSES)
        )}
      </div>
    </>
  )
}

/**
 * Build the hover-overlay button click handler. Stops bubbling so the card's
 * own click doesn't fire when the button is clicked. The filled path is held
 * to the card's rule: followed only when it stays on this site.
 */
function buildOverlayClickHandler(
  navigatePath: string | undefined
): (e: MouseEvent<HTMLButtonElement>) => void {
  const follow = navigatePath === undefined ? undefined : cardPathClick(navigatePath)
  return (e) => {
    e.stopPropagation()
    follow?.()
  }
}

/**
 * Render an action button inside the hover overlay. A `navigate` action goes
 * where the card's own link would: a page on this site only.
 */
function HoverOverlayButton({
  child,
  record,
}: {
  readonly child: Record<string, unknown>
  readonly record: TableRecord
}): ReactElement {
  const content = typeof child['content'] === 'string' ? substitute(child['content'], record) : ''
  const action = child['action'] as Action | undefined
  const navigatePath =
    action && 'type' in action && action.type === 'navigate'
      ? substitute(action.path, record)
      : undefined
  const handleClick = buildOverlayClickHandler(navigatePath)

  return (
    <button
      type="button"
      onClick={handleClick}
      // The overlay's action is an ordinary secondary button and now looks like
      // one: the shared F1 recipe rather than a fifth hand-written literal, so
      // a "Quick view" on a gallery card and a "Load More" under it read as the
      // same control.
      className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
    >
      {content}
    </button>
  )
}

/**
 * Hover overlay container — initially hidden via opacity-0/invisible and
 * revealed on group-hover (Tailwind's "group" utility on the parent card
 * lets us toggle visibility purely with CSS, no JS state needed).
 *
 * Playwright's `toBeHidden()` matches `visibility: hidden` (Tailwind's
 * `invisible`) and `toBeVisible()` matches when both are removed.
 */
function HoverOverlay({
  card,
  record,
}: {
  readonly card: GalleryCard
  readonly record: TableRecord
}): ReactElement | undefined {
  const overlayChildren = card.hoverOverlay?.children
  if (!overlayChildren || overlayChildren.length === 0) return undefined
  return (
    <div
      data-role="gallery-card-overlay"
      className={computeGalleryOverlayClasses()}
    >
      {overlayChildren.map((child, index) => {
        const childType = typeof child['type'] === 'string' ? child['type'] : ''
        if (childType === 'button') {
          return (
            <HoverOverlayButton
              key={`overlay-${String(index)}`}
              child={child}
              record={record}
            />
          )
        }
        return undefined
      })}
    </div>
  )
}

/** Render the card body — either configured template or default fallback. */
function CardBody({
  card,
  record,
  coverImageSrc,
}: {
  readonly card: GalleryCard | undefined
  readonly record: TableRecord
  readonly coverImageSrc: string | undefined
}): ReactElement {
  if (card) {
    return (
      <GalleryCardBody
        card={card}
        record={record}
        coverImageSrc={coverImageSrc}
      />
    )
  }
  return (
    <div className={GALLERY_CARD_BODY_NO_COVER_CLASSES}>
      <GalleryCardDefault record={record} />
    </div>
  )
}

/** Enter or Space on a card that opens a drawer opens it, as a click does. */
function buildDrawerKeyHandler(open: () => void): (e: KeyboardEvent<HTMLDivElement>) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    open()
  }
}

/** The card's content, wrapped in what its click does: a link, a drawer opener, or nothing. */
function CardClickTarget({
  navigatePath,
  openDrawer,
  body,
}: {
  readonly navigatePath: string | undefined
  readonly openDrawer: (() => void) | undefined
  readonly body: ReactElement
}): ReactElement {
  if (navigatePath) {
    return (
      <a
        href={navigatePath}
        className={GALLERY_CARD_LINK_CLASSES}
      >
        {body}
      </a>
    )
  }
  if (!openDrawer) return body
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDrawer}
      onKeyDown={buildDrawerKeyHandler(openDrawer)}
    >
      {body}
    </div>
  )
}

/**
 * Render a single card.
 *
 * A card whose `onClick` navigates is a LINK to that address: its cover and
 * body sit inside a real `<a href>`, so a reader can open the record in a new
 * tab and a crawler can follow it from the index. A card whose `onClick` opens
 * a drawer wraps them in a button that does. The hover overlay stays outside
 * either, since a button may not sit inside one.
 */
export function GalleryCardView({
  record,
  card,
  table,
}: {
  readonly record: TableRecord
  readonly card?: GalleryCard
  readonly table?: string
}): ReactElement {
  const { navigatePath, openDrawer, coverImageSrc } = resolveCardData(card, record, table)
  const clickable = navigatePath !== undefined || openDrawer !== undefined
  const body = (
    <CardBody
      card={card}
      record={record}
      coverImageSrc={coverImageSrc}
    />
  )

  return (
    <div
      data-role="gallery-card"
      data-component-type="card"
      data-clickable={clickable ? 'true' : undefined}
      className={`${computeGalleryCardClasses()} ${clickable ? CLICKABLE_CARD_CLASSES : ''}`}
    >
      <CardClickTarget
        navigatePath={navigatePath}
        openDrawer={openDrawer}
        body={body}
      />
      {card ? (
        <HoverOverlay
          card={card}
          record={record}
        />
      ) : undefined}
    </div>
  )
}
