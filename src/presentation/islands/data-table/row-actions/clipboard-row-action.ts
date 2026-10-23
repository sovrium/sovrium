/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { runErrorOutcome, runSuccessOutcome } from '../../runtime/action-outcome'
import { writeClipboard } from '../../runtime/clipboard-runtime'
import { renderToast } from '../../runtime/toast'
import type { ClipboardAction } from '@/domain/models/app/pages/components/action-client'

/** One outcome slot's toast, when it declares words. */
const toastOf = (
  slot: ClipboardAction['onSuccess'] | ClipboardAction['onError']
): (() => void) | undefined => {
  const toast = (slot as { readonly toast?: { message?: string; variant?: string } } | undefined)
    ?.toast
  const message = toast?.message
  return message === undefined || message === ''
    ? undefined
    : () => renderToast(message, toast?.variant)
}

/**
 * A row action copying a value of its own row. The row is the one the records
 * read returned to this reader, so a field the reader may not read is absent
 * and copies as empty.
 */
export async function runClipboardRowAction(
  action: ClipboardAction,
  record: Readonly<Record<string, unknown>>,
  origin: Element | undefined
): Promise<void> {
  const copied = await writeClipboard(substituteRecordVars(action.value, record))
  if (copied) return runSuccessOutcome(origin, { toast: toastOf(action.onSuccess) })
  runErrorOutcome(origin instanceof HTMLElement ? origin : null, toastOf(action.onError))
}
