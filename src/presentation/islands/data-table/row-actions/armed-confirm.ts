/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which destructive question the grid currently has open — held ABOVE the rows.
 *
 * A confirm gate belongs to the operator, not to the grid. A re-read is the
 * page catching up with the server, and it is no reason to withdraw a
 * half-answered destructive confirmation.
 *
 * Holding that fact in the action cell could never satisfy that, and the reason
 * is structural rather than a missing guard. The action column's cell renderer
 * is a CLOSURE built fresh on every render of the island
 * (`buildActionCellRenderer` -> `buildColumns` -> `useDataTableIslandSetup`),
 * and TanStack's `flexRender` turns whatever it is handed into
 * `React.createElement(Comp, props)`. A new closure is therefore a new element
 * TYPE, which React does not reconcile: it unmounts the old cell and mounts a
 * new one. Every `useState` inside the cell is reset by that, so a grid
 * re-reading itself under an open gate silently un-pressed the operator's
 * click.
 *
 * So the armed gate is identified by a KEY, and the key lives in a provider the
 * re-render does not own — `DataTableView`, whose own element type is a stable
 * import and which therefore only ever re-renders. The cell is free to be
 * destroyed and rebuilt; on the way back up it asks whether its key is still
 * the armed one and draws the gate again if it is. The record it commits
 * against is the FRESH one for that row, which is what makes a survived gate
 * still answer for the row it was armed on rather than for a stale copy of it.
 *
 * ONE key at a time, deliberately: two open destructive questions on one grid
 * is not a state an operator can be in, and a set would only let the grid get
 * into it.
 *
 * The context is optional. A caller that renders an action cell outside the
 * provider keeps the old cell-local behaviour rather than crashing — worse, but
 * only as bad as it already was.
 *
 * The provider itself lives next door in `armed-confirm-provider.tsx`: a module
 * exporting a component may export nothing else, or React Fast Refresh stops
 * working for it.
 */

import { createContext, useContext, useState } from 'react'

export interface ArmedConfirmStore {
  readonly armedKey: string | undefined
  readonly setArmedKey: (key: string | undefined) => void
}

export const ArmedConfirmContext = createContext<ArmedConfirmStore | undefined>(undefined)

/** Whether `key` is the armed gate, and the two ways to change that. */
export interface ArmedConfirm {
  readonly armed: boolean
  readonly arm: () => void
  readonly disarm: () => void
}

/**
 * Subscribe one action cell to the shared armed-gate key.
 *
 * Both the shared and the cell-local state are read unconditionally — a hook
 * may not be called behind a branch — and only the RESULT is chosen between
 * them.
 */
export function useArmedConfirm(key: string): ArmedConfirm {
  const shared = useContext(ArmedConfirmContext)
  const [localArmed, setLocalArmed] = useState(false)
  return {
    armed: shared ? shared.armedKey === key : localArmed,
    arm: () => (shared ? shared.setArmedKey(key) : setLocalArmed(true)),
    disarm: () => (shared ? shared.setArmedKey(undefined) : setLocalArmed(false)),
  }
}
