/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react'

export interface ComboboxCustomValueController {
  readonly inputValue: string
  readonly onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  readonly onInputValueChange: (next: string) => void
}

export function useComboboxCustomValue(allowCustomValue: boolean): ComboboxCustomValueController {
  const [inputValue, setInputValue] = useState<string>('')
  const lockedValueRef = useRef<string | undefined>(undefined)

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key !== 'Enter') return
      if (!allowCustomValue) return
      const current = event.currentTarget.value
      if (current.length === 0) return
      lockedValueRef.current = current
      setInputValue(current)
    },
    [allowCustomValue]
  )

  const onInputValueChange = useCallback((next: string): void => {
    if (lockedValueRef.current !== undefined && next === '') return
    if (next.length > 0) {
      lockedValueRef.current = undefined
    }
    setInputValue(next)
  }, [])

  return { inputValue, onInputKeyDown, onInputValueChange }
}
