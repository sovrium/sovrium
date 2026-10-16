/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Slider } from '@base-ui/react/slider'
import { useCallback, useRef, useState } from 'react'
import { cn } from '@/presentation/design/class-merge'
import { useLazySharedFilterPublisher } from '@/presentation/islands/hooks/use-lazy-shared-filter-publisher'
import { useSliderAriaSync } from './slider-aria-sync'
import {
  SLIDER_CONTROL,
  SLIDER_LABEL,
  SLIDER_RANGE,
  SLIDER_ROOT,
  SLIDER_TRACK,
  SLIDER_VALUE,
} from './slider-default-classes'
import { SliderThumb } from './slider-thumb'
import type { SharedFilterPublisherConfig } from '@/presentation/islands/hooks/use-shared-filter-publisher'
import type { ReactElement } from 'react'

/** The caption row above the slider: its label and, when asked, the value. */
function SliderCaption({
  label,
  value,
}: {
  readonly label: string
  readonly value: number | undefined
}): ReactElement {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className={SLIDER_LABEL}>{label}</span>
      {value !== undefined && <span className={SLIDER_VALUE}>{value}</span>}
    </div>
  )
}

/** shadcn/ui's slider track and the range filling it. */
function SliderRail(): ReactElement {
  return (
    <Slider.Track
      className={SLIDER_TRACK}
      data-slot="slider-track"
    >
      <Slider.Indicator
        className={SLIDER_RANGE}
        data-slot="slider-range"
      />
    </Slider.Track>
  )
}

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
  /** The channel the control publishes its value on, as a condition or a param. */
  readonly publishes?: SharedFilterPublisherConfig
}

/**
 * The slider's shown value, and the change handler that tracks it. A slider
 * with `publishes` publishes once the reader moves it: resting at its default
 * it narrows nothing.
 */
function useSliderValue(
  defaultValue: number,
  publishes: SharedFilterPublisherConfig | undefined
): readonly [number, (val: number | readonly number[]) => void] {
  const [value, setValue] = useState(defaultValue)
  const publish = useLazySharedFilterPublisher(publishes)
  const handleValueChange = useCallback(
    (val: number | readonly number[]) => {
      const next = Array.isArray(val) ? (val[0] ?? defaultValue) : (val as number)
      setValue(next)
      publish(next)
    },
    [defaultValue, publish]
  )
  return [value, handleValueChange] as const
}

/**
 * Slider island — Base UI `Slider`, drawn on shadcn/ui's `Slider` anatomy:
 * `data-slot="slider"`, `slider-track`, `slider-range` and `slider-thumb`, the
 * thumb aligned to the track's edges as shadcn sets it.
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
  publishes,
}: SliderIslandProps): ReactElement {
  const [value, handleValueChange] = useSliderValue(defaultValue, publishes)
  const inputRef = useRef<HTMLInputElement>(null)

  useSliderAriaSync(inputRef, min, max)

  return (
    <div
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      {label && (
        <SliderCaption
          label={label}
          value={showValue ? value : undefined}
        />
      )}
      <Slider.Root
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        thumbAlignment="edge"
        className={SLIDER_ROOT}
        data-slot="slider"
      >
        <Slider.Control className={SLIDER_CONTROL}>
          <SliderRail />
          <SliderThumb
            inputRef={inputRef}
            label={label}
          />
        </Slider.Control>
      </Slider.Root>
    </div>
  )
}
