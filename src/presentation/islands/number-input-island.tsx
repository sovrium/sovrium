/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useNumberInputState } from './use-number-input-state'
import type { ReactElement } from 'react'

interface NumberInputIslandProps {
  readonly id?: string
  readonly label?: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly defaultValue?: number
  readonly showStepper?: boolean
  readonly disabled?: boolean
  readonly name?: string
}

interface StepperButtonProps {
  readonly direction: 'increment' | 'decrement'
  readonly onClick: () => void
  readonly disabled: boolean
}

function StepperButton({ direction, onClick, disabled }: StepperButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction}
      disabled={disabled}
      className="border-border bg-background h-8 w-8 rounded border text-sm"
    >
      {direction === 'increment' ? '+' : '-'}
    </button>
  )
}

export default function NumberInputIsland({
  id,
  label,
  min,
  max,
  step,
  defaultValue,
  showStepper = true,
  disabled = false,
  name,
}: NumberInputIslandProps): ReactElement {
  const stepAmount = typeof step === 'number' && step > 0 ? step : 1
  const { value, handleChange, handleBlur, handleIncrement, handleDecrement } = useNumberInputState(
    { defaultValue, min, max, stepAmount }
  )

  return (
    <span
      className="inline-flex items-center gap-2"
      data-component="number-input-island"
    >
      {label !== undefined && <label htmlFor={id}>{label}</label>}
      {showStepper && (
        <StepperButton
          direction="decrement"
          onClick={handleDecrement}
          disabled={disabled}
        />
      )}
      <input
        id={id}
        name={name}
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={stepAmount}
        disabled={disabled}
        value={Number.isNaN(value) ? '' : value}
        onChange={handleChange}
        onBlur={handleBlur}
        className="border-border bg-background h-8 w-20 rounded border px-2 text-sm"
      />
      {showStepper && (
        <StepperButton
          direction="increment"
          onClick={handleIncrement}
          disabled={disabled}
        />
      )}
    </span>
  )
}
