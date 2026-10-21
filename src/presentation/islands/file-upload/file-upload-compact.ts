/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import { renderToast } from '../runtime/toast'
import type { FailedChipStrings } from './file-name-list'

/**
 * `compact: true` — a toolbar's upload. Only the trigger is drawn: shadcn's
 * outline button at the toolbar's size, with an upload icon. While the file
 * goes up it is disabled and reads "Uploading…"; the outcome is the configured
 * toasts — a failed upload's carrying a Retry that sends the same files again —
 * and a file the limits refuse is a toast too, so nothing is ever drawn under
 * the trigger and the toolbar row keeps its height.
 */
export const compactTriggerText = (
  compact: boolean,
  submitting: boolean,
  text: string,
  strings: Readonly<Record<string, string>> | undefined
): string => (compact && submitting ? (strings?.['fileUpload.uploading'] ?? 'Uploading…') : text)

/** A compact upload's refusal of a picked file (too large, too many) reaches the reader as a toast. */
export function useCompactErrorToast(compact: boolean, error: string | undefined): void {
  useEffect(() => {
    if (compact && error) renderToast(error, 'error')
  }, [compact, error])
}

/**
 * The id of the line the server draws beside a compact upload, naming what it
 * takes (`fileUploadCompactHintId`). A compact upload with no rule to state has
 * no such line, and a description naming no element is read as none.
 */
export const compactHintIdOf = ({
  compact,
  id,
}: {
  readonly compact?: boolean
  readonly id?: string
}): string | undefined => (compact === true && id !== undefined ? `${id}-hint` : undefined)

/** A failed chip's words — and a compact upload's toast Retry: the page's when the host sent them, else English. */
export const failedChipStrings = (
  strings: Readonly<Record<string, string>> = {}
): FailedChipStrings => ({
  failed: strings['fileUpload.failed'] ?? 'Upload failed',
  retry: strings['fileUpload.retry'] ?? 'Retry',
  remove: strings['fileUpload.remove'] ?? 'Remove',
})
