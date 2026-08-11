/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Form-control SSR renderers — small focused helpers extracted from
 * `interactive-renderers.tsx` to keep that file under the 300-line cap.
 * Each renderer emits either a fully-functional native HTML control
 * (`renderTimePicker`, `renderNumberInput`) or an SSR placeholder paired
 * with an `data-island` marker for client-side hydration
 * (`renderFileUploadIsland`, `renderDatePickerIsland`,
 * `renderNumberInputIsland`).
 */

import { type ReactElement } from 'react'
import {
  computeFileUploadDropzoneClasses,
  computeFileUploadDropzoneHintClasses,
  computeFileUploadDropzoneIconClasses,
  computeFileUploadDropzoneTextClasses,
} from './recipes/forms-default-classes'
import {
  computeTimePickerAmPmClasses,
  computeTimePickerFieldClasses,
  computeTimePickerWrapperClasses,
} from './recipes/specialty-ssr-default-classes'
import type { ElementProps } from './html-element-renderer'

/**
 * Configuration for {@link renderFileUploadIsland}.
 *
 * Emits an SSR placeholder visually identical to the basic file-upload
 * skeleton but with `data-island="file-upload"` / `data-island-props="..."`
 * markers so the client-side island can take over on mount. Used for the
 * dropzone variant (and any future client-validated upload mode) where we
 * need real-time size / count feedback.
 */
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

  // The SSR placeholder is *visual only* — it intentionally does NOT render
  // a real `<input type="file">`. The eager-imported `FileUploadIsland`
  // mounts synchronously on `DOMContentLoaded` and emits its own input with
  // the React change-handler attached. Rendering a placeholder input here
  // would race with Playwright's `setInputFiles(...)` — the test would set
  // the file on the SSR input, which is then unmounted by `createRoot.render`
  // before the change can propagate.
  //
  // [internal ref]: when `dropZone: true`, paint the prestyled dashed-border drop-
  // target stack (icon + primary copy + hint) via `forms-default-classes`.
  // The non-dropzone variant keeps the simple "button-like" skeleton — its
  // chrome is owned by the eager-hydrating `FileUploadIsland`'s
  // `UploadLabel` (which already ships the same border + bg + shadow
  // recipe via Tailwind utility classes).
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
      {dropZone ? (
        <div
          className={computeFileUploadDropzoneClasses()}
          aria-disabled={disabled ? 'true' : undefined}
        >
          <span
            aria-hidden="true"
            className={computeFileUploadDropzoneIconClasses()}
          >
            ⬆
          </span>
          <span className={computeFileUploadDropzoneTextClasses()}>{skeletonLabel}</span>
          <span className={computeFileUploadDropzoneHintClasses()}>Drag or click to browse</span>
        </div>
      ) : (
        <span
          className="border-border bg-background text-foreground inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm"
          aria-disabled={disabled ? 'true' : undefined}
        >
          <span aria-hidden="true">+</span>
          <span>{skeletonLabel}</span>
        </span>
      )}
    </div>
  )
}

/**
 * Configuration for {@link renderTimePicker}.
 *
 * `props.id` carries through as the input's id (already wired via `elementProps`).
 * `label` is mirrored into both `aria-label` and a sibling `<label>` so
 * `getByLabel(label)` and `getByRole('textbox', { name: label })` both resolve.
 * `timeFormat` ('12h' | '24h'): when '12h' we emit a non-interactive AM/PM
 * indicator text alongside the input. The native HTML5 `<input type="time">`
 * always uses the browser's locale-based formatting internally, so the
 * indicator text is purely a visual cue for the schema-author intent — the
 * spec asserts the literal string "AM" or "PM" is somewhere on the page.
 */
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
  const authorClassName = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const ariaLabel = label ?? (props['aria-label'] as string | undefined)
  const showAmPm = timeFormat === '12h'

  // [internal ref] prestyle: merge wrapper recipe with any author-supplied className;
  // author wins at the cascade because Tailwind sorts later utilities last.
  const wrapperPrestyle = computeTimePickerWrapperClasses()
  const wrapperClassName = authorClassName
    ? `${wrapperPrestyle} ${authorClassName}`
    : wrapperPrestyle
  const fieldClassName = computeTimePickerFieldClasses()
  const ampmClassName = computeTimePickerAmPmClasses()

  return (
    <span
      className={wrapperClassName}
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
        className={fieldClassName}
      />
      {showAmPm && (
        <span
          aria-hidden="true"
          data-time-format="12h"
          className={ampmClassName}
        >
          AM / PM
        </span>
      )}
    </span>
  )
}

// NOTE ([internal ref] merge cleanup): `renderNumberInput` (plain SSR variant) was
// removed because the only call site uses `renderNumberInputIsland`. If a
// non-interactive number-input renderer is needed later, restore from git
// history.

/**
 * Configuration for {@link renderDatePickerIsland}.
 *
 * The SSR placeholder renders a non-interactive `<button>` carrying the
 * island marker (`data-island="date-picker"`) — the eager
 * `DatePickerIsland` takes over on mount and replaces it with the real
 * popover + calendar grid.
 */
export interface RenderDatePickerIslandConfig {
  readonly props: ElementProps
  readonly islandProps: Record<string, unknown>
  readonly label?: string
  readonly placeholder?: string
  readonly disabled?: boolean
}

export function renderDatePickerIsland(config: RenderDatePickerIslandConfig): ReactElement {
  // `disabled` is part of `islandProps` so the React island reads it after
  // hydration; the SSR placeholder is always non-interactive (it's just a
  // visual skeleton waiting for `createRoot.render` to swap in the real
  // popover trigger).
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

/**
 * Configuration for {@link renderNumberInputIsland}.
 *
 * Emits the visual skeleton (label + input + optional `+` / `-` stepper
 * buttons) plus the `data-island="number-input"` marker. The eager
 * `NumberInputIsland` re-renders the same structure with click handlers
 * wired and on-blur min/max clamping.
 */
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
