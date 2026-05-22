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
  resolveCoverImage,
  resolveDataColor,
  resolveNavigatePath,
} from './card-resolvers'
import { KanbanCardBody, KanbanCardDefault } from './kanban-card-body'
import type { TableRecord } from '../shared/types'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { CSSProperties, DragEvent, KeyboardEvent, ReactElement, ReactNode } from 'react'

interface NavigateHandlers {
  readonly onClick: (() => void) | undefined
  readonly onKeyDown: ((e: KeyboardEvent<HTMLDivElement>) => void) | undefined
}

interface CardData {
  readonly navigatePath: string | undefined
  readonly dataColor: string | undefined
  readonly coverImageSrc: string | undefined
}

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

function resolveCardData(card: KanbanCard | undefined, record: TableRecord): CardData {
  if (!card) {
    return { navigatePath: undefined, dataColor: undefined, coverImageSrc: undefined }
  }
  return {
    navigatePath: resolveNavigatePath(card.onClick, record),
    dataColor: resolveDataColor(card, record),
    coverImageSrc: resolveCoverImage(card, record),
  }
}

function buildCardClassName(navigatePath: string | undefined, draggableEnabled: boolean): string {
  const navClass = navigatePath ? 'cursor-pointer hover:border-primary' : ''
  const dragClass = draggableEnabled ? 'cursor-grab active:cursor-grabbing' : ''
  return `overflow-hidden rounded-md border border-border bg-background-raised shadow-sm ${navClass} ${dragClass}`
}

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

export function KanbanCardView({
  record,
  card,
  draggableEnabled,
}: {
  readonly record: TableRecord
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
}): ReactElement {
  const recordId = String(record['id'] ?? '')
  const sortable = useSortable({ id: recordId, disabled: !draggableEnabled })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const { navigatePath, dataColor, coverImageSrc } = resolveCardData(card, record)
  const { onClick, onKeyDown } = buildNavigateHandlers(navigatePath, isDragging)

  const style = useMemo<CSSProperties>(
    () => ({
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    }),
    [transform, transition, isDragging]
  )

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
