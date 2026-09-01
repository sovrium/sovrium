/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { classifySaveFailure } from './save-retry-policy'

/**
 * Lifecycle of a save operation, surfaced to the save status indicator.
 *
 * - `idle`: no save in progress, indicator hidden
 * - `saving`: a persist request is in flight
 * - `saved`: the last persist succeeded (auto-dismisses after a short delay)
 * - `error`: the last persist failed
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Identifies the cell whose save the indicator is reporting on. */
export interface SaveTarget {
  readonly rowId: string | number
  readonly field: string
}

/** Delay (ms) before a successful `saved` status auto-dismisses to `idle`. */
const SAVED_DISMISS_MS = 2000

/**
 * Owns the timer that returns a successful `saved` status to `idle` after a
 * short delay. Returns `scheduleDismiss` (call after a successful save) and
 * `cancelDismiss` (call when a new save supersedes a pending dismissal); the
 * timer is also cleared on unmount so it never fires on an unmounted component.
 */
function useSavedStatusTimer(onDismiss: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancelDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const scheduleDismiss = useCallback(() => {
    cancelDismiss()
    // eslint-disable-next-line functional/immutable-data -- Ref holds the auto-dismiss timer
    timerRef.current = setTimeout(onDismiss, SAVED_DISMISS_MS)
  }, [cancelDismiss, onDismiss])

  useEffect(() => cancelDismiss, [cancelDismiss])

  return { scheduleDismiss, cancelDismiss }
}

/**
 * The save indicator's state machine, and the two messages that hang off it.
 *
 * `saveError` and `saveConflict` are separate rather than one message with a
 * kind, because the surfaces they drive are separate and only one may be shown:
 * a failure invites a retry, a conflict must not.
 */
export function useSaveStatusState() {
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [saveConflict, setSaveConflict] = useState<string | undefined>(undefined)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveTarget, setSaveTarget] = useState<SaveTarget | undefined>(undefined)

  const dismissToIdle = useCallback(() => setSaveStatus('idle'), [])
  const { scheduleDismiss, cancelDismiss } = useSavedStatusTimer(dismissToIdle)

  const markSaving = useCallback(
    (target: SaveTarget) => {
      // A new save supersedes any pending auto-dismiss of a prior `saved`.
      cancelDismiss()
      setSaveTarget(target)
      setSaveStatus('saving')
    },
    [cancelDismiss]
  )

  const markSaved = useCallback(() => {
    setSaveError(undefined)
    setSaveConflict(undefined)
    setSaveStatus('saved')
    scheduleDismiss()
  }, [scheduleDismiss])

  const markFailed = useCallback((error: unknown) => {
    const { message, isConflict } = classifySaveFailure(error)
    setSaveConflict(isConflict ? message : undefined)
    setSaveError(isConflict ? undefined : message)
    setSaveStatus('error')
  }, [])

  return { saveError, saveConflict, saveStatus, saveTarget, markSaving, markSaved, markFailed }
}
