/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

export interface RenderFileUploadIslandConfig {
  readonly props: ElementProps
  readonly islandProps: Record<string, unknown>
  readonly accept?: string
  readonly maxFiles?: number
  readonly dropZone?: boolean
  readonly disabled?: boolean
  readonly label?: string
}

export function renderFileUploadIsland(config: RenderFileUploadIslandConfig): ReactElement {
  const { props, islandProps, dropZone, disabled, label } = config
  const id = props.id as string | undefined
  const ariaLabel = (props['aria-label'] as string | undefined) ?? label ?? 'Upload file'
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const buttonText = label ?? ariaLabel
  const skeletonLabel = dropZone ? `Drop files or browse — ${buttonText}` : buttonText

  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="file-upload"
      data-island="file-upload"
      data-island-props={JSON.stringify(islandProps)}
      data-dropzone={dropZone ? 'true' : undefined}
    >
      <span
        className="border-border bg-background text-foreground inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm"
        aria-disabled={disabled ? 'true' : undefined}
      >
        <span aria-hidden="true">+</span>
        <span>{skeletonLabel}</span>
      </span>
    </div>
  )
}

export interface RenderTimePickerConfig {
  readonly props: ElementProps
  readonly label?: string
  readonly timeFormat?: string
  readonly minTime?: string
  readonly maxTime?: string
  readonly stepSeconds?: number
}

export function renderTimePicker(config: RenderTimePickerConfig): ReactElement {
  const { props, label, timeFormat, minTime, maxTime, stepSeconds } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const ariaLabel = label ?? (props['aria-label'] as string | undefined)
  const showAmPm = timeFormat === '12h'

  return (
    <span
      className={className}
      data-testid={testId}
      data-component="time-picker"
    >
      {label !== undefined && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="time"
        aria-label={ariaLabel}
        min={minTime}
        max={maxTime}
        step={stepSeconds}
      />
      {showAmPm && (
        <span
          aria-hidden="true"
          data-time-format="12h"
        >
          AM / PM
        </span>
      )}
    </span>
  )
}


export interface RenderDatePickerIslandConfig {
  readonly props: ElementProps
  readonly islandProps: Record<string, unknown>
  readonly label?: string
  readonly placeholder?: string
  readonly disabled?: boolean
}

export function renderDatePickerIsland(config: RenderDatePickerIslandConfig): ReactElement {
  const { props, islandProps, label, placeholder } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const buttonLabel = label
    ? placeholder
      ? `${label} — ${placeholder}`
      : label
    : (placeholder ?? 'Pick a date')
  return (
    <span
      id={id}
      className={className}
      data-testid={testId}
      data-component="date-picker"
      data-island="date-picker"
      data-island-props={JSON.stringify(islandProps)}
    >
      <button
        type="button"
        disabled
        aria-haspopup="dialog"
      >
        {buttonLabel}
      </button>
    </span>
  )
}

export interface RenderNumberInputIslandConfig {
  readonly props: ElementProps
  readonly islandProps: Record<string, unknown>
  readonly label?: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly defaultValue?: number
  readonly showStepper?: boolean
}

export function renderNumberInputIsland(config: RenderNumberInputIslandConfig): ReactElement {
  const { props, islandProps, label, min, max, step, defaultValue, showStepper } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const ariaLabel = label ?? (props['aria-label'] as string | undefined)
  const showSteppers = showStepper !== false

  return (
    <span
      id={id}
      className={className}
      data-testid={testId}
      data-component="number-input"
      data-island="number-input"
      data-island-props={JSON.stringify(islandProps)}
    >
      {label !== undefined && <label htmlFor={`${id ?? ''}-input`}>{label}</label>}
      {showSteppers && (
        <button
          type="button"
          aria-label="decrement"
          disabled
        >
          -
        </button>
      )}
      <input
        id={`${id ?? ''}-input`}
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        disabled
      />
      {showSteppers && (
        <button
          type="button"
          aria-label="increment"
          disabled
        >
          +
        </button>
      )}
    </span>
  )
}
