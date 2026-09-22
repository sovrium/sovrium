/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  computeFormFieldClasses,
  computeFormFieldErrorClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
  computeFormRequiredMarkClasses,
} from '@/presentation/design/form-layout-classes'
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
  readonly required?: boolean
  readonly controlId?: string
  readonly children: readonly React.ReactNode[]
}

/**
 * Renders a composed form field: label + optional description + control + optional error.
 *
 * Plain SSR HTML — no Base UI primitive, no client island. Native `<label
 * htmlFor=...>` provides label-click focus without hydration. ARIA wiring
 * (aria-describedby for description and error) is left to the underlying
 * input renderer / future ACs; the spec under test only asserts visible
 * text and label-click behavior.
 *
 * Required indicator is a literal `*` appended inside the label, separated
 * from the label text by a space. We render it with a sibling `<span>` so
 * the visible text remains the original label (the `*` is supplemental,
 * matching common form-field UX) and `getByText('Email')` continues to
 * resolve to the label.
 *
 * ─── PAINT (wave R-E) ──────────────────────────────────────────────────────
 *
 * Every class comes from `form-layout-classes.ts`, the module the standalone
 * form pipeline and the CRUD field shell already share. Before R-E this
 * renderer painted nothing on the root or the label and reached for
 * `text-gray-500` / `text-red-600` on the two messages — the only two stock
 * Tailwind palette classes left in `src/`. They were invisible to the theme:
 * `gray-500` is a blue-tinted grey that no Sovrium ramp contains, and neither
 * responded to `app.design.colors`, so a `field` was the one component an
 * operator could not recolour. Routing all four parts through the shared
 * contract also means a `field` and a standalone form field are now the same
 * object rather than two things that resemble each other.
 */
export function renderField(config: RenderFieldConfig): ReactElement {
  const { props, fieldLabel, fieldDescription, fieldError, required, controlId, children } = config
  const id = props.id as string | undefined
  const className = props.className as string | undefined
  const testId = props['data-testid'] as string | undefined

  return (
    <div
      id={id}
      className={resolveClasses(computeFormFieldClasses(), className)}
      data-testid={testId}
      data-component="field"
    >
      {fieldLabel !== undefined && (
        <label
          className={computeFormFieldLabelClasses()}
          htmlFor={controlId}
        >
          {fieldLabel}
          {/*
            The marker is a real sibling `<span>` so it can be tinted, but it
            is deliberately NOT `aria-hidden`: the label's accessible name was
            `"Email *"` before R-E and stays `"Email *"` after. Hiding it would
            only be correct if the control underneath were guaranteed to carry
            `aria-required`, and the control here comes from the config — so
            the asterisk is the only required signal a screen reader gets.
          */}
          {required === true && (
            <>
              {' '}
              <span className={computeFormRequiredMarkClasses()}>*</span>
            </>
          )}
        </label>
      )}
      {children}
      {/*
        Help text and error message render AFTER the control (below it in
        document order) — spec FORMCTRL-049 asserts `descBox.y >
        inputBox.y`, matching the conventional "label / control / help"
        stack. Rendering above the control breaks both the visual
        hierarchy and the spec.
      */}
      {fieldDescription !== undefined && (
        <p
          className={computeFormHelpTextClasses()}
          id={controlId ? `${controlId}-description` : undefined}
        >
          {fieldDescription}
        </p>
      )}
      {fieldError !== undefined && (
        <p
          className={computeFormFieldErrorClasses()}
          role="alert"
          id={controlId ? `${controlId}-error` : undefined}
        >
          {fieldError}
        </p>
      )}
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
