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

/**
 * When `allowCustomValue: true`, control `inputValue` so we can preserve
 * the user-typed string after Enter — Base UI's Combobox by default
 * clears the input when no item is selected, which loses free-form
 * input. Listen for Enter at the input level and lock the current typed
 * value as the displayed value; subsequent `onInputValueChange` calls
 * that try to reset to empty are ignored while the lock is held.
 */
export function useComboboxCustomValue(allowCustomValue: boolean): ComboboxCustomValueController {
  const [inputValue, setInputValue] = useState<string>('')
  const lockedValueRef = useRef<string | undefined>(undefined)

  const onInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key !== 'Enter') return
      if (!allowCustomValue) return
      const current = event.currentTarget.value
      if (current.length === 0) return
      // eslint-disable-next-line functional/immutable-data -- React useRef mutation is the documented escape hatch for cross-render values
      lockedValueRef.current = current
      setInputValue(current)
    },
    [allowCustomValue]
  )

  const onInputValueChange = useCallback((next: string): void => {
    // After the user confirms a custom value via Enter, ignore subsequent
    // Combobox-internal clearing attempts so the locked value stays visible.
    if (lockedValueRef.current !== undefined && next === '') return
    if (next.length > 0) {
      // eslint-disable-next-line functional/immutable-data -- React useRef mutation is the documented escape hatch for cross-render values
      lockedValueRef.current = undefined
    }
    setInputValue(next)
  }, [])

  return { inputValue, onInputKeyDown, onInputValueChange }
}
