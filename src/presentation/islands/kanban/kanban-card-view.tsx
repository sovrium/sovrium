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
  KANBAN_CARD_BODY_CLASSES,
  KANBAN_DRAG_GHOST_TRANSFORM,
  computeKanbanCardClasses,
  computeKanbanCardStripeClasses,
  computeKanbanDragGhostClasses,
} from '@/presentation/design/kanban-default-classes'
import {
  resolveCardActivation,
  resolveCardColors,
  resolveCoverImage,
  resolveDataColor,
} from './card-resolvers'
import { KanbanCardBody, KanbanCardDefault } from './kanban-card-body'
import { useKanbanFormat, type KanbanFormat } from './use-kanban-format'
import type { TableRecord } from '../runtime/types'
import type { OptionChipColors } from '@/domain/kernel/color/option-chip-color'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type {
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
} from 'react'

/** An absent key reads as `undefined` when destructured, so a no-op result is `{}`. */
interface NavigateHandlers {
  readonly onClick?: () => void
  readonly onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
}

interface CardData {
  readonly activate?: () => void
  readonly dataColor?: string
  readonly cardColors?: OptionChipColors
  readonly coverImageSrc?: string
}

/**
 * Build click + keyboard handlers for a clickable card (navigate or
 * openDrawer).
 *
 * When the card is also draggable, we must avoid activating it while a drag
 * is in flight. We bail out of click / keyboard handlers when @dnd-kit
 * reports an active drag for this card.
 */
function buildNavigateHandlers(
  activate: (() => void) | undefined,
  isDragging: boolean
): NavigateHandlers {
  if (!activate || isDragging) {
    return {}
  }
  return {
    onClick: activate,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        activate()
      }
    },
  }
}

/** Resolve all card-template-derived values in one pass (returns undefined when no card config). */
function resolveCardData(
  card: KanbanCard | undefined,
  record: TableRecord,
  { table, colorFieldColors }: KanbanFormat
): CardData {
  if (!card) return {}
  return {
    activate: resolveCardActivation(card.onClick, record, table),
    dataColor: resolveDataColor(card, record),
    cardColors: resolveCardColors(card, record, colorFieldColors),
    coverImageSrc: resolveCoverImage(card, record),
  }
}

/**
 * Compose the wrapper div className from the shared card recipe plus the
 * affordances this particular card's config earned.
 *
 * The resting card is FLAT now — `shadow-sm` came off. That is what gives the
 * drag its own vocabulary: a card at rest and a card in flight were both
 * `shadow-sm`, so the lift the canvas draws for the ghost had nothing to lift
 * from.
 */
function buildCardClassName(
  clickable: boolean,
  draggableEnabled: boolean,
  isDragging: boolean
): string {
  const navClass = clickable ? 'cursor-pointer hover:border-primary' : ''
  const dragClass = draggableEnabled ? 'cursor-grab active:cursor-grabbing' : ''
  const ghostClass = isDragging ? computeKanbanDragGhostClasses() : ''
  return `${computeKanbanCardClasses()} ${navClass} ${dragClass} ${ghostClass}`
}

/**
 * The card's leading colour stripe — 3px of the author's declared hue running
 * the card's full height.
 *
 * Takes the resolved trio's `border` rather than its `fill`: `fill` is the
 * author's hex verbatim and is ALSO what the card's own background is painted
 * with ([internal ref] A7 ruling 3), so a stripe in `fill` would be invisible against
 * the card it marks. `border` is `fill` mixed toward its own contrasting
 * foreground and is guaranteed to read against it.
 *
 * Returns `undefined` when no colour resolved — the recipe never invents a hue
 * for a board that declared none.
 */
function CardStripe({
  colors,
}: {
  readonly colors: OptionChipColors | undefined
}): ReactElement | undefined {
  if (!colors) return undefined
  return (
    <span
      data-role="kanban-card-stripe"
      className={computeKanbanCardStripeClasses()}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- the stripe hue is per-record config data; React Compiler not yet enabled in Bun
      style={{ backgroundColor: colors.border }}
      aria-hidden="true"
    />
  )
}

/** Render the card inner content (templated body or default title). */
function renderCardContent(
  card: KanbanCard | undefined,
  record: TableRecord,
  coverImageSrc: string | undefined
): ReactElement {
  if (!card) {
    return (
      <div className={KANBAN_CARD_BODY_CLASSES}>
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
  readonly clickable: boolean
  readonly dataColor: string | undefined
  readonly cardColors: OptionChipColors | undefined
  readonly isDragging: boolean
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
  clickable,
  dataColor,
  cardColors,
  isDragging,
  style,
  onClick,
  onKeyDown,
  children,
}: CardWrapperProps): ReactElement {
  const navigateProps = clickable ? { role: 'button', tabIndex: 0 } : {}
  const onDragStart = draggableEnabled ? (e: DragEvent) => e.preventDefault() : undefined
  // The KEYBOARD alternative to the drag lives in dnd-kit's `listeners.onKeyDown`
  // (that is where `KeyboardSensor` binds), and `onKeyDown={onKeyDown}` below is
  // written AFTER the spread — so an `undefined` navigate handler used to
  // OVERWRITE it with nothing, and a card on a board with no `onClick` action
  // could not be picked up from the keyboard at all. Nothing showed it: the
  // pointer drag worked, the attribute set was intact, and WCAG 2.2 SC 2.5.7's
  // alternative was simply absent. Falling back keeps the navigate handler
  // winning where it exists and restores the sensor where it does not.
  const keyDownHandler =
    onKeyDown ?? (dragListeners?.['onKeyDown'] as KeyboardEventHandler<HTMLDivElement> | undefined)
  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      ref={setNodeRef}
      data-card
      data-color={dataColor}
      data-clickable={clickable ? 'true' : undefined}
      draggable={draggableEnabled || undefined}
      onDragStart={onDragStart}
      style={style}
      onClick={onClick}
      onKeyDown={keyDownHandler}
      {...navigateProps}
      className={buildCardClassName(clickable, draggableEnabled, isDragging)}
    >
      <CardStripe colors={cardColors} />
      {children}
    </div>
  )
}

/**
 * Append the drag ghost's tilt to dnd-kit's translate, or return the translate
 * unchanged when the card is at rest.
 *
 * `CSS.Translate.toString` returns `undefined` when there is no offset, which
 * is the resting case and must stay `undefined` — emitting a bare
 * `rotate(-1.5deg)` there would tilt every card on the board.
 */
function joinTransform(translate: string | undefined, isDragging: boolean): string | undefined {
  if (!isDragging) return translate
  return translate ? `${translate} ${KANBAN_DRAG_GHOST_TRANSFORM}` : KANBAN_DRAG_GHOST_TRANSFORM
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
      // The drag tilt is composed into THIS transform rather than applied as a
      // Tailwind `rotate-*` class, for two reasons: an inline `transform`
      // outranks any class outright, so the class would be dead; and a second
      // `transform` declaration REPLACES the first rather than adding to it, so
      // the two can only travel together. Order is load-bearing —
      // `translate(...) rotate(...)` spins the card about its own centre at the
      // pointer, while `rotate(...) translate(...)` would rotate the
      // translation VECTOR too and walk the card off the cursor by a distance
      // that grows with the drag.
      transform: joinTransform(CSS.Translate.toString(transform), isDragging),
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
}: {
  readonly record: TableRecord
  readonly card?: KanbanCard
}): ReactElement {
  const format = useKanbanFormat()
  const draggableEnabled = format.draggableEnabled === true
  const recordId = String(record['id'] ?? '')
  const sortable = useSortable({ id: recordId, disabled: !draggableEnabled })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable
  const { activate, dataColor, cardColors, coverImageSrc } = resolveCardData(card, record, format)
  const { onClick, onKeyDown } = buildNavigateHandlers(activate, isDragging)
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
      clickable={activate !== undefined}
      dataColor={dataColor}
      cardColors={cardColors}
      isDragging={isDragging}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {renderCardContent(card, record, coverImageSrc)}
    </CardWrapper>
  )
}
