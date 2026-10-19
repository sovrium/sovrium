/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { refusalIdOf } from './record-drawer-field'

/** The line saying why the value was refused. */
export function RefusalLine({ name, error }: { readonly name: string; readonly error?: string }) {
  if (error === undefined) return undefined
  return (
    <span
      id={refusalIdOf(name)}
      className="text-destructive text-sm"
    >
      {error}
    </span>
  )
}
