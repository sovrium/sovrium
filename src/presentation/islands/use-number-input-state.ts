/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState, type ChangeEvent } from 'react'

function clampValue(next: number, min: number | undefined, max: number | undefined): number {
  return typeof min === 'number' && next < min
    ? min
    : typeof max === 'number' && next > max
      ? max
      : next
}

function parseNumberInput(raw: string): number {
  const parsed = raw === '' ? Number.NaN : Number(raw)
  return Number.isNaN(parsed) ? 0 : parsed
}

interface NumberInputStateInput {
  readonly defaultValue: number | undefined
  readonly min: number | undefined
  readonly max: number | undefined
  readonly stepAmount: number
}

export interface NumberInputState {
  readonly value: number
  readonly handleChange: (event: ChangeEvent<HTMLInputElement>) => void
  readonly handleBlur: () => void
  readonly handleIncrement: () => void
  readonly handleDecrement: () => void
}

export function useNumberInputState({
  defaultValue,
  min,
  max,
  stepAmount,
}: NumberInputStateInput): NumberInputState {
  const initialValue = typeof defaultValue === 'number' ? defaultValue : 0
  const [value, setValue] = useState<number>(initialValue)

  const clamp = useCallback((next: number): number => clampValue(next, min, max), [min, max])

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(parseNumberInput(event.target.value))
  }, [])

  const handleBlur = useCallback(() => {
    setValue((current) => clamp(current))
  }, [clamp])

  const handleIncrement = useCallback(() => {
    setValue((current) => clamp(current + stepAmount))
  }, [clamp, stepAmount])

  const handleDecrement = useCallback(() => {
    setValue((current) => clamp(current - stepAmount))
  }, [clamp, stepAmount])

  return { value, handleChange, handleBlur, handleIncrement, handleDecrement }
}
