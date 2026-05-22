/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderCardChild } from './card-template'
import { renderFooterItem } from './footer-formatters'
import type { TableRecord } from '../shared/types'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

export function KanbanCardDefault({ record }: { readonly record: TableRecord }): ReactElement {
  const title =
    (record.title as string | undefined) ??
    (record.name as string | undefined) ??
    (record.label as string | undefined) ??
    String(record.id ?? '')
  return <p className="text-foreground text-sm font-medium">{title}</p>
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
          className="h-24 w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-1 p-3">
        {card.children?.map((child, index) => renderCardChild(child, record, index))}
        {card.footer && card.footer.length > 0 && (
          <div className="border-border mt-2 flex flex-wrap items-center gap-2 border-t pt-2">
            {card.footer.map((item, index) => {
              const node = renderFooterItem(item, record)
              return node ? <span key={`footer-${String(index)}`}>{node}</span> : undefined
            })}
          </div>
        )}
      </div>
    </>
  )
}
