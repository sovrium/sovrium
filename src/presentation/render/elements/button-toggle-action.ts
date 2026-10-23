/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `crud` toggle drawn on an item of a list joining the reader's own row
 * (`dataSource.mine`), as the request it sends.
 *
 * The item expansion has already filled the marker the resolver set on the
 * button (`viewer-own-rows.ts`), so the button knows, for THIS item, whether
 * the reader has a row: with one, the toggle deletes it — by its id, so no
 * other person's row can be named — and without one it creates it, its link
 * naming the item and its person naming her. Either goes through the records
 * API, which applies the table's own create and delete permissions and answers
 * a refused write with 404. On success the list is drawn again, so the item's
 * controls follow the row; on failure the action's `onError` toast says so.
 */

import type { FetchAction } from '@/domain/models/app/pages/components/action'

type Node = Readonly<Record<string, unknown>>
/**
 * An outcome with the toast optional: the runtime shows a toast only when it
 * carries a message, and a toggle's success may only redraw its list.
 */
type Outcome = Partial<NonNullable<FetchAction['onSuccess']>>

/** A numeric id sent as a number, as the records API reads a relationship back. */
const idValue = (raw: string): string | number => (/^\d+$/.test(raw) ? Number(raw) : raw)

/** The toast an `onError` / `onSuccess` declares, in the fetch action's shape. */
const toastOf = (response: unknown): Outcome => {
  const toast = (response as { readonly toast?: Outcome } | undefined)?.toast
  return toast === undefined ? {} : { ...toast }
}

/** The request switching her row: delete it by id when she has one, create it otherwise. */
const switchRequest = (
  records: string,
  marker: Node
): Pick<FetchAction, 'url' | 'method' | 'body'> => {
  const row = String(marker['row'] ?? '')
  if (row !== '') return { url: `${records}/${encodeURIComponent(row)}`, method: 'DELETE' }
  const fields = {
    [String(marker['link'])]: idValue(String(marker['item'] ?? '')),
    [String(marker['user'])]: String(marker['userId'] ?? ''),
  }
  return { url: records, method: 'POST', body: { fields } }
}

/**
 * The fetch action a crud toggle sends from this item, or `undefined` for any
 * other action, or a toggle with no filled marker (it sits outside a list
 * joining its row, so there is no row to switch).
 */
export function crudToggleFetchAction(action: unknown, props: Node): FetchAction | undefined {
  const crud = (action ?? {}) as Node
  const marker = props['_toggle'] as Node | undefined
  const { table } = crud
  if (crud['operation'] !== 'toggle' || marker === undefined || typeof table !== 'string')
    return undefined
  const { region } = marker
  const toggle: Omit<FetchAction, 'onSuccess' | 'onError'> & {
    readonly onSuccess: Outcome
    readonly onError: Outcome
  } = {
    type: 'fetch',
    ...switchRequest(`/api/tables/${encodeURIComponent(table)}/records`, marker),
    onSuccess: {
      ...toastOf(crud['onSuccess']),
      ...(typeof region === 'string' ? { refetch: [region] } : { reload: true }),
    },
    onError: toastOf(crud['onError']),
  }
  return toggle as FetchAction
}
