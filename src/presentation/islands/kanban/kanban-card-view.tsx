/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'
import {
  navigateTo,
  resolveCardColors,
  resolveCoverImage,
  resolveDataColor,
  resolveNavigatePath,
} from './card-resolvers'
import { KanbanCardBody, KanbanCardDefault } from './kanban-card-body'
import type { TableRecord } from '../shared/types'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { OptionChipColors } from '@/domain/utils/option-chip-color'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { CSSProperties, DragEvent, KeyboardEvent, ReactElement, ReactNode } from 'react'

interface NavigateHandlers {
  readonly onClick: (() => void) | undefined
  readonly onKeyDown: ((e: KeyboardEvent<HTMLDivElement>) => void) | undefined
}

interface CardData {
  readonly navigatePath: string | undefined
  readonly dataColor: string | undefined
  readonly cardColors: OptionChipColors | undefined
  readonly coverImageSrc: string | undefined
}

/**
 * Build click + keyboard handlers for a clickable (navigate) card.
 *
 * When the card is also clickable (navigate action), we must avoid
 * triggering navigation while a drag is in flight. We bail out of click /
 * keyboard handlers when @dnd-kit reports an active drag for this card.
 */
function buildNavigateHandlers(
  navigatePath: string | undefined,
  isDragging: boolean
): NavigateHandlers {
  if (!navigatePath || isDragging) {
    return { onClick: undefined, onKeyDown: undefined }
  }
  return {
    onClick: () => navigateTo(navigatePath),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigateTo(navigatePath)
      }
    },
  }
}

/** Resolve all card-template-derived values in one pass (returns undefined when no card config). */
function resolveCardData(
  card: KanbanCard | undefined,
  record: TableRecord,
  colorFieldColors: Readonly<Record<string, string>> | undefined
): CardData {
  if (!card) {
    return {
      navigatePath: undefined,
      dataColor: undefined,
      cardColors: undefined,
      coverImageSrc: undefined,
    }
  }
  return {
    navigatePath: resolveNavigatePath(card.onClick, record),
    dataColor: resolveDataColor(card, record),
    cardColors: resolveCardColors(card, record, colorFieldColors),
    coverImageSrc: resolveCoverImage(card, record),
  }
}

/** Compose the wrapper div className based on clickable/draggable state. */
function buildCardClassName(navigatePath: string | undefined, draggableEnabled: boolean): string {
  const navClass = navigatePath ? 'cursor-pointer hover:border-primary' : ''
  const dragClass = draggableEnabled ? 'cursor-grab active:cursor-grabbing' : ''
  return `overflow-hidden rounded-md border border-border bg-background-raised shadow-sm ${navClass} ${dragClass}`
}

/** Render the card inner content (templated body or default title). */
function renderCardContent(
  card: KanbanCard | undefined,
  record: TableRecord,
  coverImageSrc: string | undefined
): ReactElement {
  if (!card) {
    return (
      <div className="p-3">
        <KanbanCardDefault record={record} />
      </div>
    )
  }
  return (
    <KanbanCardBody
      card={card}
      record={record}
      coverImageSrc={coverImageSrc}
    />
  )
}

interface CardWrapperProps {
  readonly setNodeRef: (node: HTMLElement | null) => void
  readonly dragAttributes: DraggableAttributes | undefined
  readonly dragListeners: DraggableSyntheticListeners | undefined
  readonly draggableEnabled: boolean
  readonly navigatePath: string | undefined
  readonly dataColor: string | undefined
  readonly style: CSSProperties
  readonly onClick: (() => void) | undefined
  readonly onKeyDown: ((e: KeyboardEvent<HTMLDivElement>) => void) | undefined
  readonly children: ReactNode
}

/**
 * Wrapper `<div>` for a card. Spreads dnd-kit attributes/listeners FIRST so
 * our props override them when set — dnd-kit emits role="button" and
 * tabIndex=0 by default for accessibility, but when the card has its own
 * navigate action we want our semantics to take precedence.
 *
 * Setting `draggable="true"` while pre-empting `onDragStart` is intentional:
 * the spec contract is that draggable cards expose `[draggable="true"]` so
 * tests can assert which cards are interactive, but the actual movement is
 * handled by dnd-kit's PointerSensor — we therefore call preventDefault to
 * stop the browser from kicking off a native HTML5 drag-and-drop session
 * (which would suppress pointermove events and break dnd-kit's mechanics).
 */
function CardWrapper({
  setNodeRef,
  dragAttributes,
  dragListeners,
  draggableEnabled,
  navigatePath,
  dataColor,
  style,
  onClick,
  onKeyDown,
  children,
}: CardWrapperProps): ReactElement {
  const navigateProps = navigatePath ? { role: 'button', tabIndex: 0 } : {}
  const onDragStart = draggableEnabled ? (e: DragEvent) => e.preventDefault() : undefined
  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      ref={setNodeRef}
      data-card
      data-color={dataColor}
      data-clickable={navigatePath ? 'true' : undefined}
      draggable={draggableEnabled || undefined}
      onDragStart={onDragStart}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...navigateProps}
      className={buildCardClassName(navigatePath, draggableEnabled)}
    >
      {children}
    </div>
  )
}

/**
 * The card's inline `style`: dnd-kit's drag offset plus, when the record's
 * `colorField` resolves a colour, the painted trio.
 *
 * Painting inline is what lets an author's declared hue override the
 * `bg-background-raised` default surface, and the derived foreground / border
 * travel with it so the card's label stays legible and its edge stays visible
 * on a pale fill ([internal ref] A7 ruling 3).
 */
function useCardStyle({
  transform,
  transition,
  isDragging,
  cardColors,
}: {
  readonly transform: ReturnType<typeof useSortable>['transform']
  readonly transition: string | undefined
  readonly isDragging: boolean
  readonly cardColors: OptionChipColors | undefined
}): CSSProperties {
  return useMemo<CSSProperties>(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
      ...(cardColors
        ? {
            backgroundColor: cardColors.fill,
            color: cardColors.foreground,
            borderColor: cardColors.border,
          }
        : {}),
    }),
    [transform, transition, isDragging, cardColors]
  )
}

export function KanbanCardView({
  record,
  card,
  draggableEnabled,
  colorFieldColors,
}: {
  readonly record: TableRecord
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
}): ReactElement {
  const recordId = String(record['id'] ?? '')
  const sortable = useSortable({ id: recordId, disabled: !draggableEnabled })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const { navigatePath, dataColor, cardColors, coverImageSrc } = resolveCardData(
    card,
    record,
    colorFieldColors
  )
  const { onClick, onKeyDown } = buildNavigateHandlers(navigatePath, isDragging)
  const style = useCardStyle({ transform, transition, isDragging, cardColors })

  // Spread @dnd-kit listeners only when the card is actually draggable.
  // Even with `useSortable({ disabled: true })`, the returned `listeners`
  // include pointer-down handlers that intercept click events on the card
  // (and shift the card by a few pixels), causing Playwright's `click()`
  // to retry against a moving target until it times out — even when no
  // drag activates. Conditionally spreading keeps clickable-only cards
  // (no `drag` config) free of pointer-handler interference.
  const dragListeners = draggableEnabled ? listeners : undefined
  const dragAttributes = draggableEnabled ? attributes : undefined

  return (
    <CardWrapper
      setNodeRef={setNodeRef}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      draggableEnabled={draggableEnabled}
      navigatePath={navigatePath}
      dataColor={dataColor}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {renderCardContent(card, record, coverImageSrc)}
    </CardWrapper>
  )
}
