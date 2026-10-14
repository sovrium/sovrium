/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useGridString } from '../island/grid-strings'
import type { ActionColumnItem } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The built-in in-flight word of each row-action kind: catalogue key, then English. */
function builtInWord(action: ActionColumnItem): readonly [string, string] {
  const inner = action.action as { readonly type?: string; readonly operation?: string }
  if (inner.type === 'automation') return ['action.running', 'Running…']
  if (inner.type === 'fetch') return ['form.sending', 'Sending…']
  if (inner.type === 'crud' && inner.operation === 'delete') return ['form.deleting', 'Deleting…']
  return ['form.saving', 'Saving…']
}

/**
 * The word a row action's button reads while its request is open: the action's
 * own `pendingLabel` when it declares one, else the built-in word for its kind
 * in the page language (the grid's interpreter strings carry the non-English
 * ones).
 */
export function usePendingRowWord(action: ActionColumnItem): string {
  const [key, english] = builtInWord(action)
  const builtIn = useGridString(key, english)
  const own = (action.action as { readonly pendingLabel?: unknown }).pendingLabel
  return typeof own === 'string' ? own : builtIn
}
