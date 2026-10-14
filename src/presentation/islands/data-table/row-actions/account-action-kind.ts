/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The `auth` method an action column item runs, if it is one. */
const authMethodOf = (action: ActionColumnItem): string | undefined => {
  const inner = action.action as { readonly type?: unknown; readonly method?: unknown }
  return inner.type === 'auth' && typeof inner.method === 'string' ? inner.method : undefined
}

/**
 * Whether an action draws its value control in the row, open: a passkey's name
 * (`renamePasskey`). A member's role (`setRole` with an `editSelect`) is NOT one:
 * it opens its picker on press, like every other `editSelect`, so a members list
 * reads as a list rather than as one open form per row.
 */
export function isInlineAccountAction(action: ActionColumnItem): boolean {
  return authMethodOf(action) === 'renamePasskey'
}
