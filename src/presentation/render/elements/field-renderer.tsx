/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeFieldClasses,
  computeFieldContentClasses,
  computeFieldDescriptionClasses,
  computeFieldErrorClasses,
  computeFieldGroupClasses,
  computeFieldLabelClasses,
  computeFieldLegendClasses,
  computeFieldTitleClasses,
} from '@/presentation/design/field-default-classes'
import { computeFormRequiredMarkClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { toUncontrolledTextareaProps } from '../props/uncontrolled-form-props'
import type { ElementProps } from './html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Configuration for {@link renderField}.
 *
 * The Field component composes a label, optional description, a single child
 * input control, and an optional error message into one accessible unit.
 *
 * `props` is the standard `elementProps` (id, className, data-testid, …).
 * `fieldLabel`, `fieldDescription`, `fieldError`, `required` come from the
 * schema's top-level fields on the field component (siblings of `props`),
 * not from inside `props` — same lookup contract as the file-upload and
 * form-control islands. See the `pickFromComponent` doc-comment in
 * `island-form-components.tsx` for the rationale.
 *
 * `controlId` is the `id` of the first child component (input / textarea /
 * select / etc.) extracted from `component.children[0].props.id`. It links
 * the `<label htmlFor=...>` to the nested control so a click on the label
 * focuses the control natively (no JS required).
 *
 * `children` is the already-rendered child element array. Field is a
 * single-control wrapper, so callers typically supply exactly one child,
 * but we render whatever is provided to stay forgiving for future ACs that
 * may compose multiple controls (e.g. address line + zip).
 */
export interface RenderFieldConfig {
  readonly props: ElementProps
  readonly fieldLabel?: string
  readonly fieldDescription?: string
  readonly fieldError?: string
  /** Several messages, drawn as one list. */
  readonly errors?: readonly string[]
  /** `vertical` (the default), `horizontal`, or `responsive` (horizontal from `md` up). */
  readonly orientation?: 'vertical' | 'horizontal' | 'responsive'
  /** Makes the field a `fieldset` named by this legend. */
  readonly legend?: string
  /** A title beside a choice control, above its description. */
  readonly fieldTitle?: string
  readonly required?: boolean
  readonly controlId?: string
  readonly children: readonly React.ReactNode[]
}

/** The label above (or beside) the control, with its required mark. */
const renderLabel = (config: RenderFieldConfig): ReactElement | undefined =>
  config.fieldLabel === undefined ? undefined : (
    <label
      className={computeFieldLabelClasses()}
      htmlFor={config.controlId}
      data-slot="field-label"
    >
      {config.fieldLabel}
      {/* A real sibling, NOT aria-hidden: the control's required state may come only from here. */}
      {config.required === true && (
        <>
          {' '}
          <span className={computeFormRequiredMarkClasses()}>*</span>
        </>
      )}
    </label>
  )

/** The help text under the control. */
const renderDescription = (config: RenderFieldConfig): ReactElement | undefined =>
  config.fieldDescription === undefined ? undefined : (
    <p
      className={computeFieldDescriptionClasses()}
      id={config.controlId ? `${config.controlId}-description` : undefined}
      data-slot="field-description"
    >
      {config.fieldDescription}
    </p>
  )

/** The error: `fieldError` as one line, `errors` as one list (one item each). */
const renderError = (config: RenderFieldConfig): ReactElement | undefined => {
  const errors = config.errors ?? []
  if (config.fieldError === undefined && errors.length === 0) return undefined
  return (
    <div
      className={computeFieldErrorClasses()}
      role="alert"
      id={config.controlId ? `${config.controlId}-error` : undefined}
      data-slot="field-error"
    >
      {config.fieldError}
      {errors.length === 0 ? undefined : (
        <ul className="ml-4 flex list-disc flex-col gap-1">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A choice field's content column: the title (naming the control), then the description. */
const renderTitledContent = (config: RenderFieldConfig): ReactElement => (
  <div
    data-slot="field-content"
    className={computeFieldContentClasses()}
  >
    <label
      htmlFor={config.controlId}
      id={config.controlId ? `${config.controlId}-title` : undefined}
      data-slot="field-label"
      className={computeFieldTitleClasses()}
    >
      {config.fieldTitle}
    </label>
    {renderDescription(config)}
  </div>
)

/**
 * The parts of a field, in reading order. Each part sits in its own fixed JSX
 * slot rather than in one spread array, so React needs no key for the label,
 * description or error; the controls keep the keys `renderChildren` gave them.
 */
const renderParts = (config: RenderFieldConfig): ReactElement =>
  config.fieldTitle === undefined ? (
    <>
      {renderLabel(config)}
      {config.children}
      {renderDescription(config)}
      {renderError(config)}
    </>
  ) : (
    <>
      {config.children}
      {renderTitledContent(config)}
      {renderError(config)}
    </>
  )

/**
 * Renders a composed form field on shadcn/ui's `Field` anatomy: label (or a
 * title beside a choice control), the control, the help text, the error.
 *
 * Plain SSR HTML — no client island. Native `<label htmlFor>` gives
 * label-click focus. `orientation` lays the label above the control, beside
 * it, or beside it from `md` up; `legend` turns the field into a `fieldset`
 * named by its legend, its controls grouped inside. Every class comes from
 * `form-layout-classes.ts`, the module the form pipeline shares.
 */
export function renderField(config: RenderFieldConfig): ReactElement {
  const { props, legend } = config
  const orientation = config.orientation ?? 'vertical'
  const invalid = config.fieldError !== undefined || (config.errors?.length ?? 0) > 0
  const shared = {
    id: props.id as string | undefined,
    className: resolveClasses(
      computeFieldClasses(orientation),
      props.className as string | undefined
    ),
    'data-testid': props['data-testid'] as string | undefined,
    'data-component': 'field',
    'data-component-type': props['data-component-type'] as string | undefined,
    'data-orientation': orientation,
    'data-invalid': invalid ? 'true' : undefined,
  }
  if (legend !== undefined) {
    return (
      <fieldset
        {...shared}
        className={resolveClasses('flex flex-col gap-4', props.className as string | undefined)}
        data-slot="field-set"
      >
        <legend
          data-slot="field-legend"
          data-variant="legend"
          className={computeFieldLegendClasses()}
        >
          {legend}
        </legend>
        {renderDescription(config)}
        <div
          data-slot="field-group"
          className={computeFieldGroupClasses()}
        >
          {config.children}
        </div>
        {renderError(config)}
      </fieldset>
    )
  }
  return (
    <div
      {...shared}
      role="group"
      data-slot="field"
    >
      {renderParts(config)}
    </div>
  )
}

/**
 * Extract the `id` of the first child component for `<label htmlFor=...>` wiring.
 *
 * The Field component is a single-control wrapper, so the first child's `id`
 * is the natural target for label-click focus. Returns `undefined` if no
 * children are present or the first child has no `props.id`.
 */
export function extractFirstChildId(component: Component | undefined): string | undefined {
  const children = (component as { children?: readonly unknown[] } | undefined)?.children
  if (!Array.isArray(children) || children.length === 0) return undefined
  const firstChild = children[0] as { props?: { id?: string } } | undefined
  return firstChild?.props?.id
}

/**
 * Renders a textarea element.
 *
 * `rows`, `maxLength`, `autoResize` are top-level schema fields per
 * `textarea.ts` (siblings of `props`), so the dispatcher reads them from
 * `component` and forwards them to this renderer. `props` carries the
 * standard HTML attributes (id, name, placeholder, className, …) that flow
 * through `props.*` in the schema.
 *
 * `label` is read from `props.label` (consistent with select/checkbox/etc.
 * form-control renderers — see `pickFromComponent` doc-comment in
 * `island-form-components.tsx`) and translated into an `aria-label` so
 * `getByRole('textbox', { name: ... })` resolves. We strip the raw
 * `label` from spread props because `label` is not a valid HTML attribute
 * on `<textarea>` (React would warn or pass it through as a plain
 * attribute).
 *
 * An author's `value` becomes `defaultValue`, and a string `children`
 * becomes the same, because a textarea's content is a PROP and React warns
 * on both spellings the schema makes natural. The emitted markup is
 * unchanged — see `toUncontrolledTextareaProps`.
 *
 * When `autoResize` is `true`, we emit a `data-auto-resize` attribute on
 * the textarea. The actual resize behavior is wired by a single
 * page-level script in `page-body-scripts.tsx` (see `autoResizeScript`),
 * which runs synchronously during HTML parse and attaches an `input`
 * listener that sets `style.height = scrollHeight + 'px'` on every
 * keystroke. This mirrors the existing `clickScript` delegation pattern
 * — stateless behavioral enhancers live centrally rather than per
 * renderer, while stateful interactive controls (select, checkbox,
 * switch, slider, …) use React islands. Centralizing keeps the renderer
 * pure SSR and avoids `dangerouslySetInnerHTML` outside the page-level
 * script container.
 */
export interface RenderTextareaConfig {
  readonly props: ElementProps
  readonly rows?: number
  readonly maxLength?: number
  readonly label?: string
  readonly autoResize?: boolean
  readonly placeholder?: string
  readonly name?: string
}

export function renderTextarea(config: RenderTextareaConfig): ReactElement {
  const { props, rows, maxLength, label, autoResize, placeholder, name } = config
  // Strip `label` from spread props (not a valid HTML attribute on textarea).
  const { label: _label, ...restProps } = props as ElementProps & { label?: unknown }
  const ariaLabel = label ?? (restProps['aria-label'] as string | undefined)
  const dataAutoResize = autoResize === true ? '' : undefined

  return (
    <textarea
      {...toUncontrolledTextareaProps(restProps)}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder ?? (restProps['placeholder'] as string | undefined)}
      name={name ?? (restProps['name'] as string | undefined)}
      aria-label={ariaLabel}
      data-auto-resize={dataAutoResize}
    />
  )
}
