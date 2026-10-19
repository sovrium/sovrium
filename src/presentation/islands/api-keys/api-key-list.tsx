/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator's own keys, as shadcn/ui's `Table`, with a revoke gate.
 *
 * WHY THIS IS NOT A CONFIG `table` WITH AN `actions` COLUMN — the
 * declarative path was the first design and it does not work here, for a reason
 * worth recording. `ActionButton`'s confirm gate is rendered INLINE, replacing
 * the clicked row's button (`data-table/action-cell.tsx`), so with two keys
 * listed the confirm control for row 1 sits BEFORE row 2's still-present
 * "Revoke". `[internal ref]` resolves the confirm as
 * `getByRole('button', {name: /revoke|delete|confirm/i}).last()`, which would
 * then land on row 2 and revoke nothing. Owning the DOM lets the gate render
 * AFTER the table, where "last" means what the spec means by it.
 *
 * Only `start` — the leading few characters the plugin stores for exactly this
 * purpose — is ever rendered. The full value is never in the list response, so
 * there is nothing here to leak.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeEmptyDescriptionClasses,
  computeEmptyHeaderClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from '@/presentation/design/empty-default-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import {
  computeStaticTableBodyClasses,
  computeStaticTableCellClasses,
  computeStaticTableContainerClasses,
  computeStaticTableRowClasses,
  computeStaticTableShellClasses,
} from '@/presentation/design/static-table-default-classes'
import { formatCreatedAt, type ApiKeySummary } from './api-key-client'
import { useApiKeyWord as useWord } from './api-key-strings'
import type { ReactElement } from 'react'

interface ApiKeyListProps {
  readonly keys: readonly ApiKeySummary[]
  /** Arm the revoke gate for one key (never revokes directly). */
  readonly onRequestRevoke: (key: ApiKeySummary) => void
  /** The key whose revoke is in flight: its Revoke is busy and asks nothing again. */
  readonly revokingId?: string | undefined
}

const HEAD = computeStaticTableCellClasses({ kind: 'header' })
const CELL = computeStaticTableCellClasses({ kind: 'data' })
const ROW = computeStaticTableRowClasses()

/** One row: what the key is, how to recognise it, and how to retire it. */
function ApiKeyRow({
  apiKey,
  onRequestRevoke,
  revoking,
}: {
  readonly apiKey: ApiKeySummary
  readonly onRequestRevoke: (key: ApiKeySummary) => void
  readonly revoking: boolean
}): ReactElement {
  const unnamed = useWord('unnamed', 'Unnamed key')
  const revoke = useWord('revoke', 'Revoke')
  return (
    <tr
      data-slot="table-row"
      className={ROW}
    >
      <td
        data-slot="table-cell"
        className={`${CELL} font-medium`}
      >
        {apiKey.name ?? unnamed}
      </td>
      <td
        data-slot="table-cell"
        className={`${CELL} text-muted-foreground font-mono`}
      >
        {apiKey.start ? `${apiKey.start}…` : '—'}
      </td>
      <td
        data-slot="table-cell"
        className={`${CELL} text-muted-foreground`}
      >
        {formatCreatedAt(apiKey.createdAt)}
      </td>
      <td
        data-slot="table-cell"
        className={`${CELL} text-right`}
      >
        <button
          type="button"
          data-slot="button"
          onClick={() => (revoking ? undefined : onRequestRevoke(apiKey))}
          {...pendingControlProps(revoking)}
          className={computeButtonDefaultClasses({ variant: 'outline', size: 'sm' })}
        >
          {revoke}
        </button>
      </td>
    </tr>
  )
}

/** The empty list, as shadcn/ui's `Empty`: what is missing, and what to do about it. */
function NoKeys(): ReactElement {
  return (
    <div
      data-slot="empty"
      className={computeEmptyStateContainerClasses()}
    >
      <div
        data-slot="empty-header"
        className={computeEmptyHeaderClasses()}
      >
        <div
          data-slot="empty-title"
          className={computeEmptyStateTitleClasses()}
        >
          {useWord('empty', 'You have no API keys yet.')}
        </div>
        <div
          data-slot="empty-description"
          className={computeEmptyDescriptionClasses()}
        >
          {useWord(
            'emptyBody',
            'Create one to let a script or a scheduled job call the API as you.'
          )}
        </div>
      </div>
    </div>
  )
}

/** A column heading. */
function Head({ children }: { readonly children: ReactElement | string }): ReactElement {
  return (
    <th
      data-slot="table-head"
      className={HEAD}
    >
      {children}
    </th>
  )
}

/** The table, or an honest empty state — never a spinner that never resolves. */
export function ApiKeyList({ keys, onRequestRevoke, revokingId }: ApiKeyListProps): ReactElement {
  const heads = [
    useWord('list', 'Your API keys'),
    useWord('name', 'Name'),
    useWord('prefix', 'Prefix'),
    useWord('created', 'Created'),
    useWord('actions', 'Actions'),
  ] as const
  if (keys.length === 0) return <NoKeys />
  return (
    <div
      data-slot="table-container"
      className={`${computeStaticTableContainerClasses()} rounded-lg border`}
    >
      <table
        data-slot="table"
        aria-label={heads[0]}
        className={computeStaticTableShellClasses()}
      >
        <thead data-slot="table-header">
          <tr
            data-slot="table-row"
            className={ROW}
          >
            <Head>{heads[1]}</Head>
            <Head>{heads[2]}</Head>
            <Head>{heads[3]}</Head>
            <Head>
              <span className="sr-only">{heads[4]}</span>
            </Head>
          </tr>
        </thead>
        <tbody
          data-slot="table-body"
          className={computeStaticTableBodyClasses()}
        >
          {keys.map((apiKey) => (
            <ApiKeyRow
              key={apiKey.id}
              apiKey={apiKey}
              onRequestRevoke={onRequestRevoke}
              revoking={revokingId === apiKey.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The revoke gate: a non-modal `alertdialog` rendered AFTER the table.
 *
 * Non-modal on purpose, matching every other confirm gate in the console
 * (`inline-confirm-dialog.tsx`): it does not inert the page, so a mis-armed
 * gate is escaped by clicking anywhere rather than by finding the one control
 * that dismisses it.
 */
export function RevokeGate({
  apiKey,
  onConfirm,
  onCancel,
}: {
  readonly apiKey: ApiKeySummary
  readonly onConfirm: () => void
  readonly onCancel: () => void
}): ReactElement {
  const unnamed = useWord('unnamed', 'Unnamed key')
  const prompt = useWord(
    'revokePrompt',
    'Revoke “{name}”? Anything still presenting it stops working immediately, and it cannot be restored.'
  )
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label={useWord('revokeTitle', 'Revoke API key')}
      className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 text-sm ring-1"
    >
      <p>{prompt.split('{name}').join(apiKey.name ?? unnamed)}</p>
      <div className="flex gap-2">
        <button
          type="button"
          data-slot="button"
          onClick={onConfirm}
          className={computeButtonDefaultClasses({ variant: 'destructive', size: 'sm' })}
        >
          {useWord('revokeKey', 'Revoke key')}
        </button>
        <button
          type="button"
          data-slot="button"
          onClick={onCancel}
          className={computeButtonDefaultClasses({ variant: 'outline', size: 'sm' })}
        >
          {useWord('cancel', 'Cancel')}
        </button>
      </div>
    </div>
  )
}
