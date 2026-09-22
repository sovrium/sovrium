/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KANBAN_CARD_BODY_CLASSES,
  KANBAN_CARD_DEFAULT_TITLE_CLASSES,
  computeKanbanCardCoverClasses,
  computeKanbanCardFooterClasses,
} from '@/presentation/design/kanban-default-classes'
import { renderCardChild } from './card-template'
import { renderFooterItem } from './footer-formatters'
import type { TableRecord } from '../runtime/types'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

export function KanbanCardDefault({ record }: { readonly record: TableRecord }): ReactElement {
  // No template configured: render a minimal default with a title-ish field.
  const title =
    (record.title as string | undefined) ??
    (record.name as string | undefined) ??
    (record.label as string | undefined) ??
    String(record.id ?? '')
  return <p className={KANBAN_CARD_DEFAULT_TITLE_CLASSES}>{title}</p>
}

export function KanbanCardBody({
  card,
  record,
  coverImageSrc,
}: {
  readonly card: KanbanCard
  readonly record: TableRecord
  readonly coverImageSrc: string | undefined
}): ReactElement {
  return (
    <>
      {coverImageSrc && (
        <img
          src={coverImageSrc}
          alt=""
          className={computeKanbanCardCoverClasses()}
        />
      )}
      <div className={KANBAN_CARD_BODY_CLASSES}>
        {card.children?.map((child, index) => renderCardChild(child, record, index))}
      </div>
      {/* The footer sits OUTSIDE the body's padding box so its top rule runs
          edge to edge — which is what makes it read as a division of the card
          rather than as a boxed-in strip inside it. Its own `px-2` restores the
          horizontal inset for the chips. `mt-2` is gone with the move: the
          body's gap owned that space and a margin on top of it double-counted. */}
      {card.footer && card.footer.length > 0 && (
        <div className={computeKanbanCardFooterClasses()}>
          {card.footer.map((item, index) => {
            const node = renderFooterItem(item, record)
            return node ? <span key={`footer-${String(index)}`}>{node}</span> : undefined
          })}
        </div>
      )}
    </>
  )
}
