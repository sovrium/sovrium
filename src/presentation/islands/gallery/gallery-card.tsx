/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_CARD_BODY_NO_COVER_CLASSES,
  GALLERY_CARD_DEFAULT_TITLE_CLASSES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardClasses,
  computeGalleryImageClasses,
  computeGalleryOverlayClasses,
  resolveGalleryAspectRatio,
} from '@/presentation/design/gallery-default-classes'
import { renderCardChild, substitute } from '../kanban/card-template'
import type { TableRecord } from '../runtime/types'
import type { Action } from '@/domain/models/app/pages/components/action'
import type { GalleryCard } from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactElement } from 'react'

interface CardData {
  readonly navigatePath: string | undefined
  readonly coverImageSrc: string | undefined
}

/** Resolve onClick navigate action to a concrete path with $record.* substitutions. */
function resolveNavigatePath(onClick: Action | undefined, record: TableRecord): string | undefined {
  if (!onClick || !('type' in onClick) || onClick.type !== 'navigate') return undefined
  return substitute(onClick.path, record)
}

/** Resolve `coverImage` template to a usable URL or undefined. */
function resolveCoverImage(
  coverImage: string | undefined,
  record: TableRecord
): string | undefined {
  if (coverImage === undefined) return undefined
  const resolved = substitute(coverImage, record)
  // Empty string means the referenced field was null/undefined — drop it so we
  // don't render `<img src="">` which would still satisfy `toBeVisible()`.
  return resolved === '' ? undefined : resolved
}

/** Resolve all card-template-derived values in one pass. */
function resolveCardData(card: GalleryCard | undefined, record: TableRecord): CardData {
  if (!card) {
    return { navigatePath: undefined, coverImageSrc: undefined }
  }
  return {
    navigatePath: resolveNavigatePath(card.onClick, record),
    coverImageSrc: resolveCoverImage(card.coverImage, record),
  }
}

function navigateTo(path: string): void {
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    globalThis.location.assign(path)
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
            className={computeGalleryImageClasses({ part: 'img' })}
          />
        </div>
      )}
      <div className={GALLERY_CARD_BODY_CLASSES}>
        {card.children?.map((child, index) => renderCardChild(child, record, index))}
      </div>
    </>
  )
}

/**
 * Build the hover-overlay button click handler. Stops bubbling so the card's
 * own onClick (navigate) doesn't fire when the button is clicked.
 */
function buildOverlayClickHandler(
  navigatePath: string | undefined
): (e: MouseEvent<HTMLButtonElement>) => void {
  return (e) => {
    e.stopPropagation()
    if (navigatePath) navigateTo(navigatePath)
  }
}

/**
 * Render an action button inside the hover overlay. Uses `globalThis.location`
 * for `navigate` actions to mirror the card's primary onClick navigation.
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

interface CardNavigation {
  readonly onClick: (() => void) | undefined
  readonly onKeyDown: ((e: KeyboardEvent<HTMLDivElement>) => void) | undefined
  readonly navigateProps: { readonly role?: string; readonly tabIndex?: number }
  readonly cursorClass: string
}

/** Build the navigation handlers + a11y props for a card with a navigate action. */
function buildCardNavigation(navigatePath: string | undefined): CardNavigation {
  if (!navigatePath) {
    return { onClick: undefined, onKeyDown: undefined, navigateProps: {}, cursorClass: '' }
  }
  return {
    onClick: () => navigateTo(navigatePath),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigateTo(navigatePath)
      }
    },
    navigateProps: { role: 'button', tabIndex: 0 },
    cursorClass: 'cursor-pointer hover:border-primary',
  }
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

/** Render a single card. */
export function GalleryCardView({
  record,
  card,
}: {
  readonly record: TableRecord
  readonly card?: GalleryCard
}): ReactElement {
  const { navigatePath, coverImageSrc } = resolveCardData(card, record)
  const { onClick, onKeyDown, navigateProps, cursorClass } = buildCardNavigation(navigatePath)

  return (
    <div
      data-role="gallery-card"
      data-clickable={navigatePath ? 'true' : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...navigateProps}
      className={`${computeGalleryCardClasses()} ${cursorClass}`}
    >
      <CardBody
        card={card}
        record={record}
        coverImageSrc={coverImageSrc}
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
