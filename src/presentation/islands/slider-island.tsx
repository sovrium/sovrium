/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
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

  const handleValueChange = useCallback(
    (val: number | readonly number[]) => {
      setValue(Array.isArray(val) ? (val[0] ?? defaultValue) : (val as number))
    },
    [defaultValue]
  )

  return (
    <div
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-fg text-sm font-medium">{label}</span>
          {showValue && <span className="text-fg-muted text-sm">{value}</span>}
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
        <Slider.Track className="bg-bg-subtle relative h-1.5 w-full grow rounded-full">
          <Slider.Indicator className="bg-primary absolute h-full rounded-full" />
          <Slider.Thumb className="border-primary bg-bg-raised hover:bg-primary-subtle focus-visible:ring-focus-ring block h-4 w-4 rounded-full border-2 shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50" />
        </Slider.Track>
      </Slider.Root>
    </div>
  )
}
