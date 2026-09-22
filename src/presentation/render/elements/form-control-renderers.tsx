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
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  FILE_UPLOAD_DROPZONE_PROMPT,
  fileUploadDropzoneHint,
  computeFileUploadDropzoneClasses,
  computeFileUploadDropzoneHintClasses,
  computeFileUploadDropzoneIconClasses,
  computeFileUploadDropzoneTextClasses,
} from '@/presentation/design/file-upload-default-classes'
import { UploadGlyph } from '@/presentation/design/form-glyphs'
import { computeFormFieldLabelClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeTimePickerAmPmClasses,
  computeTimePickerFieldClasses,
  computeTimePickerWrapperClasses,
} from '../../design/specialty-ssr-default-classes'
import { toUncontrolledFormProps } from '../props/uncontrolled-form-props'
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
  const skeletonLabel = dropZone ? FILE_UPLOAD_DROPZONE_PROMPT : buttonText
  const dropzoneHint = fileUploadDropzoneHint({ accept: config.accept, maxFiles: config.maxFiles })
  const controlState = disabled === true ? 'disabled' : 'default'
  const ariaDisabled = disabled === true ? 'true' : undefined

  // The SSR placeholder is *visual only* — it intentionally does NOT render
  // a real `<input type="file">`. The eager-imported `FileUploadIsland`
  // mounts synchronously on `DOMContentLoaded` and emits its own input with
  // the React change-handler attached. Rendering a placeholder input here
  // would race with Playwright's `setInputFiles(...)` — the test would set
  // the file on the SSR input, which is then unmounted by `createRoot.render`
  // before the change can propagate.
  //
  // [internal ref]: when `dropZone: true`, paint the prestyled dashed-border drop-
  // target stack (glyph + prompt + constraint hint).
  //
  // R-E: both branches now paint from the SHARED recipes in
  // `presentation/utils/recipes` — the drop target from
  // `file-upload-default-classes`, the button from
  // `computeButtonDefaultClasses` — and the copy comes from the same module,
  // so the words cannot drift either. The comment that stood here claimed the
  // island "already ships the same recipe"; it did not. Measured before R-E,
  // the skeleton drew `p-6 border-2 gap-2` on `bg-subtle` saying "Drop files
  // or browse — Attachments", and `UploadLabel` drew `min-h-[120px] px-4 py-2
  // shadow-sm` on `bg-background` saying "Drag and drop files here or browse
  // — Attachments". The control changed size, colour and wording on mount;
  // the claim of sameness is what let that stand unnoticed.
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
          className={computeFileUploadDropzoneClasses({ state: controlState })}
          aria-disabled={ariaDisabled}
        >
          <UploadGlyph className={computeFileUploadDropzoneIconClasses()} />
          <span className={computeFileUploadDropzoneTextClasses()}>{skeletonLabel}</span>
          {dropzoneHint !== undefined && (
            <span className={computeFileUploadDropzoneHintClasses()}>{dropzoneHint}</span>
          )}
        </div>
      ) : (
        <span
          className={computeButtonDefaultClasses({ variant: 'secondary', state: controlState })}
          aria-disabled={ariaDisabled}
        >
          {skeletonLabel}
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

  // [internal ref] prestyle: merge wrapper recipe with any author-supplied className.
  // The author wins same-property conflicts because `resolveClasses` drops the
  // recipe's losing class — NOT because Tailwind sorts later utilities last,
  // which it does not do by concatenation order.
  const wrapperPrestyle = computeTimePickerWrapperClasses()
  const wrapperClassName = resolveClasses(wrapperPrestyle, authorClassName)
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
  return (
    <span
      id={id}
      className={className}
      data-testid={testId}
      data-component="date-picker"
      // NO island marker on a depiction. `[internal ref]` asserts the
      // absence, and the reason is not tidiness: the eager `DatePickerIsland`
      // would replace this subtree on mount with a CLOSED trigger, so the cell
      // labelled `open` would flash a calendar and then contradict its label.
      data-island={depicted ? undefined : 'date-picker'}
      data-island-props={depicted ? undefined : JSON.stringify(islandProps)}
      data-specimen-open={depicted ? 'true' : undefined}
    >
      <button
        type="button"
        disabled
        aria-haspopup="dialog"
        // The trigger of an open control reports itself open. On the live
        // control this is the island's job; here it is the one attribute that
        // keeps the drawn trigger and the drawn panel telling the same story.
        aria-expanded={depicted ? 'true' : undefined}
      >
        {buttonLabel}
      </button>
      {depicted && (
        // Markup from the island's own `DatePickerPopup`, produced server-side
        // from decoded config — see `presentation/rendering/open-specimen-markup.ts`
        // for why it arrives as a string and why that is safe here.
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR markup emission
        <span dangerouslySetInnerHTML={{ __html: openPopupHtml }} />
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

  return (
    <span
      id={id}
      className={className}
      data-testid={testId}
      data-component="number-input"
      data-island="number-input"
      data-island-props={JSON.stringify(islandProps)}
    >
      {/*
        The SSR label carries the SAME recipe the island paints on its own
        label. Not cosmetic symmetry: an unruled label inherits the document
        root (16px) while the hydrated one reads the form-label step, so the
        two spellings would make the label RESIZE the moment the island mounts.
      */}
      {label !== undefined && (
        <label
          htmlFor={`${id ?? ''}-input`}
          className={computeFormFieldLabelClasses()}
        >
          {label}
        </label>
      )}
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

/**
 * Configuration for {@link renderOneTimeCodeInput}.
 *
 * `label` is mirrored into both `aria-label` and a sibling `<label>` so a
 * verification page needs no `id` for the control to be findable by its name —
 * the same pairing {@link renderTimePicker} uses, and for the same reason.
 */
export interface RenderOneTimeCodeInputConfig {
  readonly props: ElementProps
  readonly label?: string
}

/**
 * The verification-code entry (`inputType: 'one-time-code'`).
 *
 * Two attributes carry the whole capability, and neither is decoration:
 * `autocomplete="one-time-code"` is what a phone keys its offer-the-code-from-
 * the-SMS behaviour on, and `inputmode="numeric"` is what brings up a digit
 * keypad instead of an alphabetic keyboard for six digits.
 *
 * The rendered `type` is `text`, NOT the schema literal. `one-time-code` is not
 * an HTML input type: a browser meeting it falls back to `text` anyway, but
 * does so while discarding the numeric keyboard this control exists to get. So
 * the literal is translated here rather than forwarded, and the author-facing
 * vocabulary stays the one the schema documents.
 *
 * Whatever the visual treatment, the VALUE is one string. A segmented control
 * that submitted six fields would be a different contract from every other
 * input on the page.
 */
export function renderOneTimeCodeInput(config: RenderOneTimeCodeInputConfig): ReactElement {
  const { props, label } = config
  const { type: _discardedType, ...rest } = props
  const id = props.id as string | undefined
  const ariaLabel = label ?? (props['aria-label'] as string | undefined)
  return (
    <>
      {label !== undefined && id !== undefined && <label htmlFor={id}>{label}</label>}
      <input
        {...toUncontrolledFormProps(rest)}
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        aria-label={ariaLabel}
        data-component="one-time-code"
      />
    </>
  )
}
