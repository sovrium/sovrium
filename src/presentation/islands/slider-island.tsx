/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'

interface SliderIslandProps {
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly defaultValue?: number
  readonly showValue?: boolean
  readonly disabled?: boolean
  readonly label?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/**
 * Slider island — wraps Base UI Slider for range value selection.
 *
 * Supports keyboard interaction (arrow keys, Home/End), configurable
 * min/max/step, and optional value display label.
 */
export default function SliderIsland({
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  showValue = false,
  disabled = false,
  label,
  className,
  id,
  'data-testid': testId,
}: SliderIslandProps): ReactElement {
  const [value, setValue] = useState(defaultValue)

  // eslint-disable-next-line no-restricted-syntax -- needed to satisfy react-perf/jsx-no-new-function-as-prop; React Compiler not yet enabled in Bun (see docs/infrastructure/ui/react.md)
  const handleValueChange = useCallback(
    (val: number | readonly number[]) => {
      setValue(Array.isArray(val) ? (val[0] ?? defaultValue) : (val as number))
    },
    [defaultValue]
  )

  return (
    <div
      className={className}
      id={id}
      data-testid={testId}
    >
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {showValue && <span className="text-sm text-gray-600">{value}</span>}
        </div>
      )}
      <Slider.Root
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        className="relative flex w-full touch-none items-center"
      >
        <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-gray-200">
          <Slider.Indicator className="absolute h-full rounded-full bg-blue-600" />
          <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-blue-600 bg-white shadow-sm transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50" />
        </Slider.Track>
      </Slider.Root>
    </div>
  )
}
