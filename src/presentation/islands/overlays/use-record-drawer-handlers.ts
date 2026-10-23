/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import type { Values } from './record-drawer-values'

/**
 * The inline error and the per-field ones, plus the field-edit + close handlers
 * (an edit clears the banner and that field's own message). Every surface drawing
 * the record drawer's body keeps its draft's errors with these — the sheet, a
 * stacked record, a row opened in place — so an edit clears them the same way.
 */
export function useDrawerHandlers(
  setValues: Dispatch<SetStateAction<Values>>,
  setOpen: (open: boolean) => void
): {
  readonly error: string | undefined
  /** The request a server error failed the save under, when the console names one. */
  readonly requestId: string | undefined
  readonly setError: (error: string | undefined, requestId?: string) => void
  readonly fieldErrors: Readonly<Record<string, string>>
  readonly setFieldErrors: (errors: Readonly<Record<string, string>>) => void
  readonly onChange: (name: string, value: string) => void
  readonly onClose: () => void
} {
  const [failure, setFailure] = useState<{ readonly error?: string; readonly requestId?: string }>(
    {}
  )
  const setError = useCallback(
    (error: string | undefined, requestId?: string) =>
      setFailure((prev) =>
        error === prev.error && requestId === prev.requestId
          ? prev
          : {
              ...(error === undefined ? {} : { error }),
              ...(requestId === undefined ? {} : { requestId }),
            }
      ),
    []
  )
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({})
  const onChange = useCallback(
    (name: string, value: string) => {
      setError(undefined)
      setFieldErrors((prev) => {
        if (prev[name] === undefined) return prev
        const { [name]: _cleared, ...rest } = prev
        return rest
      })
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    [setValues, setError]
  )
  const onClose = useCallback(() => {
    setError(undefined)
    setFieldErrors({})
    setOpen(false)
  }, [setOpen, setError])
  const { error, requestId } = failure
  return { error, requestId, setError, fieldErrors, setFieldErrors, onChange, onClose }
}
