/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderCardChild, substitute } from '../kanban/card-template'
import type { TableRecord } from '../shared/types'
import type { Action } from '@/domain/models/app/pages/components/action'
import type { GalleryCard } from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'

interface CardData {
  readonly navigatePath: string | undefined
  readonly coverImageSrc: string | undefined
}

function resolveNavigatePath(onClick: Action | undefined, record: TableRecord): string | undefined {
  if (!onClick || !('type' in onClick) || onClick.type !== 'navigate') return undefined
  return substitute(onClick.path, record)
}

function resolveCoverImage(
  coverImage: string | undefined,
  record: TableRecord
): string | undefined {
  if (coverImage === undefined) return undefined
  const resolved = substitute(coverImage, record)
  return resolved === '' ? undefined : resolved
}

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

function GalleryCardDefault({ record }: { readonly record: TableRecord }): ReactElement {
  const title =
    (record.title as string | undefined) ??
    (record.name as string | undefined) ??
    (record.label as string | undefined) ??
    String(record.id ?? '')
  return <p className="text-foreground text-sm font-medium">{title}</p>
}

function GalleryCardBody({
  card,
  record,
  coverImageSrc,
}: {
  readonly card: GalleryCard
  readonly record: TableRecord
  readonly coverImageSrc: string | undefined
}): ReactElement {
  return (
    <>
      {coverImageSrc && (
        <div
          data-aspect-ratio={card.aspectRatio}
          className="relative w-full overflow-hidden"
        >
          <img
            src={coverImageSrc}
            alt=""
            className="h-40 w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-1 p-3">
        {card.children?.map((child, index) => renderCardChild(child, record, index))}
      </div>
    </>
  )
}

function buildOverlayClickHandler(
  navigatePath: string | undefined
): (e: MouseEvent<HTMLButtonElement>) => void {
  return (e) => {
    e.stopPropagation()
    if (navigatePath) navigateTo(navigatePath)
  }
}

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
      className="bg-background-raised text-foreground hover:bg-background-subtle rounded-md px-4 py-2 text-sm font-medium shadow-sm"
    >
      {content}
    </button>
  )
}

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
      className="bg-scrim/50 invisible absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100"
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
    <div className="p-3">
      <GalleryCardDefault record={record} />
    </div>
  )
}

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
      className={`group border-border bg-background-raised relative overflow-hidden rounded-lg border shadow-sm transition-colors ${cursorClass}`}
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
