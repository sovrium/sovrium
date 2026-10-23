/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A card child that depends on its record beyond its text: one gated by
 * `visibility.record`, or a `button`. Loaded only by a gallery whose cards
 * carry one (`gallery-card.tsx`), so a plain gallery pays nothing for it.
 *
 * A `crud` toggle naming the gallery's `dataSource.mine` switches the reader's
 * own row of this card: it deletes her row when the card has one — by its id,
 * so no other person's row can be named — and creates it otherwise, its link
 * naming the card's record and its person naming her. The records API applies
 * the table's own create and delete permissions; a refusal shows the action's
 * `onError` toast and changes nothing on the card.
 */

import { useContext, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import { satisfiesFieldCondition } from '@/domain/models/app/tables/condition-match-service'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { renderCardChild, substitute, type CardChildClasses } from '../kanban/card-template'
import { renderToast } from '../runtime/toast'
import { GalleryViewerRowsContext, type GalleryViewerRows } from './gallery-classes-context'
import type { TableRecord } from '../runtime/types'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

type Node = Readonly<Record<string, unknown>>

/** The `visibility.record` condition a card child declares, if any. */
const recordCondition = (child: Node): FieldCondition | undefined =>
  (child['visibility'] as { readonly record?: FieldCondition } | undefined)?.record

/** The toast a crud action's outcome declares. */
const outcomeToast = (action: Node, outcome: 'onSuccess' | 'onError') =>
  (action[outcome] as { readonly toast?: { message?: string; variant?: string } } | undefined)
    ?.toast

/** A numeric id sent as a number, as a relationship is written. */
const idValue = (raw: unknown): unknown =>
  typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw

/**
 * Switch the reader's row of this card: delete hers, or create it. Answers the
 * row now joined (`null` once deleted), or `undefined` when the API refused.
 */
async function switchRow(own: GalleryViewerRows, item: string): Promise<unknown> {
  const records = `/api/tables/${encodeURIComponent(own.table)}/records`
  const row = own.rows[item]
  const json = { 'Content-Type': 'application/json' }
  const response =
    row === null || row === undefined
      ? await fetch(records, {
          method: 'POST',
          credentials: 'include',
          headers: json,
          body: JSON.stringify({ fields: { [own.link]: idValue(item), [own.user]: own.userId } }),
        })
      : await fetch(`${records}/${encodeURIComponent(String(row))}`, {
          method: 'DELETE',
          credentials: 'include',
        })
  if (!response.ok) return undefined
  if (row !== null && row !== undefined) return null
  const created = (await response.json().catch(() => ({}))) as { readonly id?: unknown }
  return created.id ?? null
}

/**
 * Keep a press on a card's button off the card around it: a card that navigates
 * is a link and one that opens a drawer listens for clicks and Enter/Space, so
 * without this a toggle would also follow the link or open the drawer — and the
 * drawer's key handler, cancelling Enter, would swallow the toggle itself.
 */
const keepOffCard = (event: MouseEvent | KeyboardEvent): void => {
  event.stopPropagation()
  if (event.type === 'click') event.preventDefault()
}

/** A card's button: a toggle of the reader's row when it names the join, else inert. */
function CardButton({
  child,
  record,
}: {
  readonly child: Node
  readonly record: TableRecord
}): ReactElement {
  const own = useContext(GalleryViewerRowsContext)
  const [busy, setBusy] = useState(false)
  const action = (child['action'] ?? {}) as Node
  const toggles = own !== undefined && action['operation'] === 'toggle' && action['mine'] === own.as
  const label = typeof child['content'] === 'string' ? substitute(child['content'], record) : ''
  const press = async (): Promise<void> => {
    if (!toggles || own === undefined || busy) return
    setBusy(true)
    const item = String(record['id'])
    const row = await switchRow(own, item).catch(() => undefined)
    setBusy(false)
    const toast = outcomeToast(action, row === undefined ? 'onError' : 'onSuccess')
    if (toast?.message !== undefined) renderToast(toast.message, toast.variant)
    if (row !== undefined) own.setRow(item, row)
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        keepOffCard(event)
        void press()
      }}
      onKeyDown={keepOffCard}
      className={computeButtonDefaultClasses({ size: 'sm' })}
    >
      {label}
    </button>
  )
}

/** One record-dependent card child: dropped when its record fails its gate. */
export default function GalleryCardControl({
  child,
  record,
  index,
  classes,
}: {
  readonly child: Node
  readonly record: TableRecord
  readonly index: number
  readonly classes: CardChildClasses
}): ReactElement | null {
  if (!satisfiesFieldCondition(recordCondition(child), record)) return null
  if (child['type'] === 'button')
    return (
      <CardButton
        child={child}
        record={record}
      />
    )
  return <>{renderCardChild(child, record, index, classes)}</>
}
