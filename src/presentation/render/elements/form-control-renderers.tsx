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
import { ClockGlyph, MinusGlyph, PlusGlyph } from '@/presentation/design/control-glyphs'
import {
  computeDateTriggerClasses,
  DATE_CONTROL_ROOT_CLASSES,
} from '@/presentation/design/date-trigger-default-classes'
import {
  computeFieldClasses,
  computeFieldLabelClasses,
} from '@/presentation/design/field-default-classes'
import {
  fileUploadDropzoneHint,
  computeFileUploadDropzoneClasses,
  computeFileUploadTriggerClasses,
} from '@/presentation/design/file-upload-default-classes'
import { FileUploadDropzoneParts } from '@/presentation/design/file-upload-dropzone-parts'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
  computeInputGroupFieldClasses,
  computeInputGroupIconButtonClasses,
  computeInputGroupLabelClasses,
  computeInputGroupRootClasses,
} from '@/presentation/design/input-group-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
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
  const { props, islandProps, dropZone, disabled, label, accept, maxFiles } = config
  const id = props.id as string | undefined
  const strings = islandProps['uiStrings'] as Readonly<Record<string, string>> | undefined
  const fallback = strings?.['fileUpload.button'] ?? 'Upload file'
  const ariaLabel = (props['aria-label'] as string | undefined) ?? label ?? fallback
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const buttonText = label ?? ariaLabel
  const maxFileSize = islandProps['maxFileSize'] as number | undefined
  const dropzoneHint = fileUploadDropzoneHint({ accept, maxFiles, maxFileSize }, strings)
  const controlState = disabled === true ? 'disabled' : 'default'
  const ariaDisabled = disabled === true ? 'true' : undefined

  // The SSR placeholder is *visual only* — it intentionally does NOT render
  // a real `<input type="file">`. The island mounts on `DOMContentLoaded` and
  // emits its own input with the React change-handler attached; a placeholder
  // input here would race with Playwright's `setInputFiles(...)`, the file set
  // on an input `createRoot.render` then unmounts.
  //
  // Both branches paint from the recipes the island reads, and say the same
  // words, so the control does not move or change its text on mount. The
  // drop zone's Browse files button is drawn disabled until the island takes
  // over: a press before then would open nothing.
  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="file-upload"
      data-island="file-upload"
      data-component-type={hostComponentType(props)}
      data-island-props={JSON.stringify(islandProps)}
      data-dropzone={dropZone ? 'true' : undefined}
    >
      {dropZone ? (
        <div
          data-slot="empty"
          className={computeFileUploadDropzoneClasses({ state: controlState })}
          aria-disabled={ariaDisabled}
        >
          <FileUploadDropzoneParts
            hint={dropzoneHint}
            disabled
            strings={strings}
          />
        </div>
      ) : (
        <span
          data-slot="button"
          data-variant="outline"
          className={computeFileUploadTriggerClasses({ disabled: disabled === true })}
          aria-disabled={ariaDisabled}
        >
          {buttonText}
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

  // shadcn/ui `Field` around one `InputGroup`: the label sits ABOVE the group,
  // and the group is the one bordered box holding the time input and a clock
  // in an end addon. The author's className joins the field's through
  // `resolveClasses`, so it wins any same-property conflict with the recipe.
  return (
    <div
      className={resolveClasses(computeFieldClasses(), authorClassName)}
      data-slot="field"
      data-testid={testId}
      data-component="time-picker"
      data-component-type={props['data-component-type'] as string | undefined}
    >
      {label !== undefined && (
        <label
          htmlFor={id}
          data-slot="field-label"
          className={computeFieldLabelClasses()}
        >
          {label}
        </label>
      )}
      <div
        role="group"
        data-slot="input-group"
        className={computeInputGroupClasses()}
      >
        <input
          id={id}
          type="time"
          aria-label={ariaLabel}
          min={minTime}
          max={maxTime}
          step={stepSeconds}
          data-slot="input-group-control"
          className={`${computeInputGroupFieldClasses()} appearance-none [&::-webkit-calendar-picker-indicator]:hidden`}
        />
        <div
          data-slot="input-group-addon"
          data-align="inline-end"
          className={computeInputGroupAddonClasses({ align: 'inline-end' })}
        >
          {showAmPm && (
            <span
              aria-hidden="true"
              data-time-format="12h"
            >
              AM / PM
            </span>
          )}
          <ClockGlyph />
        </div>
      </div>
    </div>
  )
}

// NOTE: there is no plain SSR `renderNumberInput`; the only call site uses
// `renderNumberInputIsland`.

/**
 * Configuration for {@link renderDatePickerIsland}.
 *
 * The SSR placeholder renders a non-interactive `<button>` carrying the
 * island marker (`data-island="date-picker"`) — the eager
 * `DatePickerIsland` takes over on mount and replaces it with the real
 * popover + calendar grid. The placeholder paints from the island's own
 * recipes, so the control keeps its width and height when it does.
 */
export interface RenderDatePickerIslandConfig {
  readonly props: ElementProps
  readonly islandProps: Record<string, unknown>
  readonly label?: string
  readonly placeholder?: string
  readonly disabled?: boolean
  /**
   * Draw the control with its calendar DOWN, as a still depiction.
   *
   * Set only by the design-system console's `open` state cell, through the
   * state vocabulary's own reach. It replaces the island marker rather than
   * adding to it: a drawing that hydrated would open on a click and stop being
   * a drawing, so the two are mutually exclusive by construction.
   */
  readonly openPopupHtml?: string
}

export function renderDatePickerIsland(config: RenderDatePickerIslandConfig): ReactElement {
  // `disabled` is part of `islandProps` so the React island reads it after
  // hydration; the SSR placeholder is always non-interactive (it's just a
  // visual skeleton waiting for `createRoot.render` to swap in the real
  // popover trigger).
  const { props, islandProps, label, placeholder, openPopupHtml } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined
  const depicted = openPopupHtml !== undefined
  const buttonLabel = label
    ? placeholder
      ? `${label} — ${placeholder}`
      : label
    : (placeholder ?? 'Pick a date')
  // The id is the trigger's, never the host's: the island's trigger carries it too (RGAA 8.2).
  const trigger = (
    <button
      type="button"
      id={id}
      disabled
      aria-haspopup="dialog"
      // The trigger of an open control reports itself open. On the live
      // control this is the island's job; here it is the one attribute that
      // keeps the drawn trigger and the drawn panel telling the same story.
      aria-expanded={depicted ? 'true' : undefined}
      className={depicted ? undefined : computeDateTriggerClasses()}
    >
      {buttonLabel}
    </button>
  )
  return (
    <span
      className={className}
      data-testid={testId}
      data-component="date-picker"
      // NO island marker on a depiction. An admin design system spec asserts the
      // absence, and the reason is not tidiness: the eager `DatePickerIsland`
      // would replace this subtree on mount with a CLOSED trigger, so the cell
      // labelled `open` would flash a calendar and then contradict its label.
      data-island={depicted ? undefined : 'date-picker'}
      data-component-type={hostComponentType(props)}
      data-island-props={depicted ? undefined : JSON.stringify(islandProps)}
      data-specimen-open={depicted ? 'true' : undefined}
    >
      {depicted ? (
        <>
          {trigger}
          {/* The island's own `DatePickerPopup` markup, rendered server-side;
          `open-specimen-markup.ts` says why a string is safe here. */}
          {/* eslint-disable-next-line sovrium/require-sanitized-html -- server-rendered markup: renderToStaticMarkup output, which escapes every text and attribute value */}
          <span dangerouslySetInnerHTML={{ __html: openPopupHtml }} />
        </>
      ) : (
        // Drawn from the island's recipes, so it keeps its size on mount.
        <span className={DATE_CONTROL_ROOT_CLASSES}>{trigger}</span>
      )}
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

  // The skeleton draws the island's own anatomy — a field, its label above one
  // input group of decrement, number and increment — so nothing moves when the
  // island mounts and replaces it. Everything is disabled until then.
  return (
    <div
      id={id}
      className={className}
      data-testid={testId}
      data-component="number-input"
      data-island="number-input"
      data-component-type={hostComponentType(props)}
      data-island-props={JSON.stringify(islandProps)}
    >
      <div
        className={computeInputGroupRootClasses()}
        data-slot="field"
      >
        {label !== undefined && (
          <label
            htmlFor={`${id ?? ''}-input`}
            data-slot="field-label"
            className={computeInputGroupLabelClasses()}
          >
            {label}
          </label>
        )}
        <div
          role="group"
          data-slot="input-group"
          className={computeInputGroupClasses({ fit: true })}
        >
          {showSteppers && numberInputSkeletonStep('decrement')}
          <input
            id={`${id ?? ''}-input`}
            type="number"
            aria-label={ariaLabel}
            min={min}
            max={max}
            step={step}
            defaultValue={defaultValue}
            disabled
            data-slot="input-group-control"
            className={`${computeInputGroupFieldClasses({ fit: true })} text-center tabular-nums`}
          />
          {showSteppers && numberInputSkeletonStep('increment')}
        </div>
      </div>
    </div>
  )
}

/** One disabled step button of the number-input skeleton, in its addon. */
function numberInputSkeletonStep(direction: 'increment' | 'decrement'): ReactElement {
  const align = direction === 'increment' ? 'inline-end' : 'inline-start'
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={computeInputGroupAddonClasses({ align })}
    >
      <button
        type="button"
        aria-label={direction}
        disabled
        data-slot="input-group-button"
        className={computeInputGroupIconButtonClasses()}
      >
        {direction === 'increment' ? <PlusGlyph /> : <MinusGlyph />}
      </button>
    </div>
  )
}
