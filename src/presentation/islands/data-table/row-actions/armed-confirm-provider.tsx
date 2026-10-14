/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Holds the armed confirm-gate key for everything it wraps.
 *
 * Its own file, and its own file ONLY because of Fast Refresh: a module that
 * exports a component may export nothing else, so the context and the hook that
 * reads it stay next door in `armed-confirm.ts` — which is also where the
 * reasoning for all of this is written down.
 *
 * Rendered by the grid's view shell, which is the nearest thing above the
 * action cells that merely re-renders when the grid re-reads itself instead of
 * being rebuilt.
 */

import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { ArmedConfirmContext, type ArmedConfirmStore } from './armed-confirm'

export function ArmedConfirmProvider({ children }: { readonly children: ReactNode }): ReactElement {
  const [armedKey, setArmedKey] = useState<string | undefined>(undefined)
  const value = useMemo<ArmedConfirmStore>(() => ({ armedKey, setArmedKey }), [armedKey])
  return <ArmedConfirmContext.Provider value={value}>{children}</ArmedConfirmContext.Provider>
}
