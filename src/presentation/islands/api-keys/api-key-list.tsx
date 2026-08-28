/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The operator's own keys, as a table, with a revoke gate.
 *
 * WHY THIS IS NOT A CONFIG `data-table` WITH AN `actions` COLUMN — the
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

import { formatCreatedAt, type ApiKeySummary } from './api-key-client'
import type { ReactElement } from 'react'

interface ApiKeyListProps {
  readonly keys: readonly ApiKeySummary[]
  /** Arm the revoke gate for one key (never revokes directly). */
  readonly onRequestRevoke: (key: ApiKeySummary) => void
}

const CELL = 'text-foreground px-3 py-2 text-sm'
const HEAD = 'text-foreground-subtle px-3 py-2 text-left text-xs font-medium uppercase'

/** One row: what the key is, how to recognise it, and how to retire it. */
function ApiKeyRow({
  apiKey,
  onRequestRevoke,
}: {
  readonly apiKey: ApiKeySummary
  readonly onRequestRevoke: (key: ApiKeySummary) => void
}): ReactElement {
  return (
    <tr className="border-border border-t">
      <td className={CELL}>{apiKey.name ?? 'Unnamed key'}</td>
      <td className={`${CELL} font-mono`}>{apiKey.start ? `${apiKey.start}…` : '—'}</td>
      <td className={CELL}>{formatCreatedAt(apiKey.createdAt)}</td>
      <td className={CELL}>
        <button
          type="button"
          // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- the handler closes over this row's key; hoisting it would need a per-row memo for no measurable gain on a list this size
          onClick={() => onRequestRevoke(apiKey)}
          className="border-border text-error-fg hover:bg-error-bg rounded-md border px-2 py-1 text-xs transition-colors"
        >
          Revoke
        </button>
      </td>
    </tr>
  )
}

/** The table, or an honest empty state — never a spinner that never resolves. */
export function ApiKeyList({ keys, onRequestRevoke }: ApiKeyListProps): ReactElement {
  if (keys.length === 0) {
    return <p className="text-foreground-subtle text-sm">You have no API keys yet.</p>
  }
  return (
    <table
      aria-label="Your API keys"
      className="border-border w-full border-collapse rounded-md border"
    >
      <thead className="bg-background-subtle">
        <tr>
          <th className={HEAD}>Name</th>
          <th className={HEAD}>Prefix</th>
          <th className={HEAD}>Created</th>
          <th className={HEAD}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((apiKey) => (
          <ApiKeyRow
            key={apiKey.id}
            apiKey={apiKey}
            onRequestRevoke={onRequestRevoke}
          />
        ))}
      </tbody>
    </table>
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
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-label="Revoke API key"
      className="border-border bg-background-raised mt-4 flex flex-col gap-3 rounded-md border p-4"
    >
      <p className="text-foreground text-sm">
        Revoke “{apiKey.name ?? 'Unnamed key'}”? Anything still presenting it stops working
        immediately, and it cannot be restored.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="bg-error-bg text-error-fg rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Revoke key
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
