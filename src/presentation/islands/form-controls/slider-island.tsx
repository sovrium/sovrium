/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import { computeSliderRangeClasses, computeSliderTrackClasses } from './numeric-default-classes'
import { useSliderAriaSync } from './slider-aria-sync'
import { SliderThumb } from './slider-thumb'
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
  const inputRef = useRef<HTMLInputElement>(null)

  const handleValueChange = useCallback(
    (val: number | readonly number[]) => {
      setValue(Array.isArray(val) ? (val[0] ?? defaultValue) : (val as number))
    },
    [defaultValue]
  )

  useSliderAriaSync(inputRef, min, max)

  return (
    <div
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-foreground text-sm font-medium">{label}</span>
          {showValue && <span className="text-foreground-muted text-sm">{value}</span>}
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
        <Slider.Control className="relative flex w-full touch-none items-center">
          <Slider.Track
            className={computeSliderTrackClasses({ state: disabled ? 'disabled' : 'default' })}
          >
            <Slider.Indicator className={computeSliderRangeClasses()} />
          </Slider.Track>
          <SliderThumb
            inputRef={inputRef}
            label={label}
          />
        </Slider.Control>
      </Slider.Root>
    </div>
  )
}
