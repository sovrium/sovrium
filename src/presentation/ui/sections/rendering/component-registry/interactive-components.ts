/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { buildConfirmAttributes } from '../../renderers/element-renderers/button-action-builders'
import {
  computeButtonDefaultClasses,
  type ButtonSize,
  type ButtonState,
  type ButtonVariant,
} from '../../renderers/element-renderers/recipes/button-default-classes'
import {
  computeAlertClasses,
  computeBadgeClasses,
  computeStatusBadgeDotClasses,
  computeStatusBadgeWrapperClasses,
  type AlertVariant,
  type BadgeVariant,
  type StatusDotColor,
} from '../../renderers/element-renderers/recipes/feedback-default-classes'
import {
  computeInputDefaultClasses,
  type InputState,
} from '../../renderers/element-renderers/recipes/input-default-classes'
import { convertBadgeProps } from '../component-registry-helpers'
// prettier-ignore
import { buildIconClassName, buildLinkClassName, variantFromButtonClassName } from './interactive-prestyle-builders'
import { pickCompField, resolveUploadActionUrl } from './island-overlay-props-builders'
import { searchShellComponents } from './search-shell-components'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

const STATUS_DOT_COLORS = new Set<StatusDotColor>([
  'green',
  'red',
  'amber',
  'yellow',
  'blue',
  'gray',
])

/**
 * Narrow an unknown `statusColor` value (parsed from `StatusDotColorSchema`)
 * to the typed vocabulary the prestyle helper expects.
 */
function resolveStatusDotColor(value: unknown): StatusDotColor {
  return typeof value === 'string' && STATUS_DOT_COLORS.has(value as StatusDotColor)
    ? (value as StatusDotColor)
    : 'gray'
}

const BADGE_VARIANTS = new Set<BadgeVariant>(['default', 'secondary', 'destructive', 'outline'])

/**
 * Build the merged className for a `badge` ([internal ref], prestyled-by-default).
 *
 * Defaults come from {@link computeBadgeClasses} — a Tailwind recipe with
 * inline OKLCH var-fallbacks so a schema author who writes the bare
 * `{ type: 'badge', content: 'New' }` gets a complete, opinionated pill —
 * primary-tone surface, rounded-full chrome, leading-none typography — with
 * zero theme-layer dependency. Author-supplied `props.className` is
 * appended LAST so it wins at the Tailwind cascade.
 */
function buildBadgeClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const rawVariant = componentRaw['badgeVariant']
  const variant = BADGE_VARIANTS.has(rawVariant as BadgeVariant)
    ? (rawVariant as BadgeVariant)
    : undefined
  const defaults = computeBadgeClasses({ variant })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

const ALERT_VARIANTS = new Set<AlertVariant>([
  'default',
  'destructive',
  'warning',
  'info',
  'success',
])

/**
 * Build the merged className for an `alert` ([internal ref], prestyled-by-default).
 *
 * Defaults come from {@link computeAlertClasses} — a Tailwind recipe with
 * inline OKLCH var-fallbacks so a schema author who writes the bare
 * `{ type: 'alert', alertVariant: 'success', content: 'Saved' }` gets a
 * complete, opinionated notification surface — tinted-bg / matching-fg /
 * matching-border tone triple, rounded-md chrome, top-aligned icon slot —
 * with zero theme-layer dependency. Author-supplied `props.className` is
 * appended LAST so it wins at the Tailwind cascade.
 */
function buildAlertClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  // `alertVariant` is the canonical schema field per `AlertVariantSchema`; the
  // legacy SSR renderer used `variant` for back-compat, so we honor both.
  const rawVariant = componentRaw['alertVariant'] ?? componentRaw['variant']
  const variant = ALERT_VARIANTS.has(rawVariant as AlertVariant)
    ? (rawVariant as AlertVariant)
    : undefined
  const defaults = computeAlertClasses({ variant })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

/**
 * Overlay button-schema top-level fields (`label`, `confirm`) onto the
 * elementProps envelope so the renderButton helper picks them up without a
 * second extraction path. Author-supplied `props.label` / confirm attrs win. The
 * `confirm` field (string prompt OR rich object form) is mapped to its data
 * attribute(s) by {@link buildConfirmAttributes}.
 */
function overlayButtonSchemaFallbacks(
  elementProps: Record<string, unknown>,
  componentRaw: Record<string, unknown>
): Record<string, unknown> {
  const topLabel =
    typeof componentRaw['label'] === 'string' ? (componentRaw['label'] as string) : undefined
  return {
    ...elementProps,
    ...(topLabel !== undefined && elementProps.label === undefined ? { label: topLabel } : {}),
    ...buildConfirmAttributes(componentRaw['confirm'], elementProps),
  }
}

const BUTTON_VARIANTS = new Set<ButtonVariant>([
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab',
])
const BUTTON_SIZES = new Set<ButtonSize>(['sm', 'md', 'lg'])

/**
 * Build the merged className for a button ([internal ref], prestyled-by-default).
 *
 * Defaults come from {@link computeButtonDefaultClasses} — a rich Tailwind
 * recipe with inline OKLCH var-fallbacks so a schema author who writes the
 * bare `{ type: 'button', text: 'Save' }` gets a complete, opinionated button
 * with focus ring, hover lift, accent border. Author-supplied
 * `props.className` is appended LAST so it wins at the Tailwind cascade.
 *
 * This replaces the prior `.btn` / `.btn-{variant}` / `.btn-{size}` recipe
 * that depended on the CSS compiler's component layer being emitted.
 */
function buildButtonClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined,
  state: ButtonState
): string {
  const rawVariant = componentRaw['variant']
  const rawSize = componentRaw['size']
  // Schema `variant` field wins; otherwise infer from a legacy `.btn-{variant}`
  // className token so the prestyle matches the legacy component-layer class.
  const variant = BUTTON_VARIANTS.has(rawVariant as ButtonVariant)
    ? (rawVariant as ButtonVariant)
    : variantFromButtonClassName(authorClassName)
  const size = BUTTON_SIZES.has(rawSize as ButtonSize) ? (rawSize as ButtonSize) : undefined
  const defaults = computeButtonDefaultClasses({ variant, size, state })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

/**
 * Derive an input's visual state from native HTML attributes carried in
 * `elementProps`. The input schema does not currently expose a `state` field
 * ([internal ref] keeps the schema vocabulary frozen — see plan-piped-locket), so the
 * state is read from props the schema already permits:
 *
 *   - `props.disabled === true`        → `'disabled'`
 *   - `props.readOnly === true` (or `props.readonly`) → `'readonly'`
 *   - `props['aria-invalid'] === true` or `=== 'true'`  → `'error'`
 *
 * Precedence: `disabled` > `error` > `readonly` > `default` — disabled is the
 * most restrictive, so it wins over a concurrently-flagged invalid state.
 */
function deriveInputState(elementProps: Record<string, unknown>): InputState {
  if (elementProps['disabled'] === true) return 'disabled'
  const ariaInvalid = elementProps['aria-invalid']
  if (ariaInvalid === true || ariaInvalid === 'true') return 'error'
  if (elementProps['readOnly'] === true || elementProps['readonly'] === true) return 'readonly'
  return 'default'
}

/**
 * Build the merged className for an input ([internal ref], prestyled-by-default).
 *
 * Defaults come from {@link computeInputDefaultClasses} — a Tailwind recipe
 * with inline OKLCH var-fallbacks so a schema author who writes the bare
 * `{ type: 'input', placeholder: 'Email' }` gets a complete, opinionated text
 * input with rounded border, surface fill, focus ring, and state styling.
 * Author-supplied `props.className` is appended LAST so it wins at the
 * Tailwind cascade.
 */
function buildInputClassName(
  elementProps: Record<string, unknown>,
  authorClassName: string | undefined
): string {
  const state = deriveInputState(elementProps)
  const defaults = computeInputDefaultClasses({ state })
  return authorClassName ? `${defaults} ${authorClassName}` : defaults
}

// Shared renderer body for the `form` and `data-form` component types (the
// latter aliases the former). Threads the active page language (`currentLang`)
// + app `languages` to `renderForm` so an embedded auth form resolves `$t:key`
// submit/field-label references server-side.
const renderFormFromDispatch: ComponentRenderer = (cfg) =>
  Renderers.renderForm({
    props: cfg.elementProps,
    children: cfg.renderedChildren,
    action: cfg.action,
    tables: cfg.tables,
    buckets: cfg.buckets,
    component: cfg.component,
    lang: cfg.currentLang,
    languages: cfg.languages,
    landingPath: cfg.landingPath,
  })

/**
 * Interactive components (button, link, form, input, icon, badge, etc.)
 *
 * These components render interactive elements and form controls.
 */
export const interactiveComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> =
  {
    button: ({
      elementProps,
      content,
      renderedChildren,
      interactions,
      action,
      tables,
      routeParams,
      component,
    }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const propsWithSchemaFallbacks = overlayButtonSchemaFallbacks(elementProps, c)
      const loading = c['loading'] as boolean | undefined
      const disabled = propsWithSchemaFallbacks['disabled'] === true
      // [internal ref]: a button's visual state determines whether the prestyled
      // hover-lift / motion classes apply. Disabled and loading reads as inactive.
      const buttonState: ButtonState = loading ? 'loading' : disabled ? 'disabled' : 'default'
      const mergedClassName = buildButtonClassName(
        c,
        propsWithSchemaFallbacks.className as string | undefined,
        buttonState
      )

      return Renderers.renderButton({
        props: { ...propsWithSchemaFallbacks, className: mergedClassName },
        content,
        children: renderedChildren,
        interactions,
        action,
        tables,
        routeParams,
        loading,
      })
    },

    link: ({ elementProps, content, renderedChildren, component }) => {
      const className = buildLinkClassName(
        (component ?? {}) as Record<string, unknown>,
        elementProps['className'] as string | undefined
      )
      return Renderers.renderLink({ ...elementProps, className }, content, renderedChildren)
    },

    alert: ({ elementProps, content, renderedChildren, theme, component }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const mergedClassName = buildAlertClassName(c, elementProps.className as string | undefined)
      return Renderers.renderAlert(
        { ...elementProps, className: mergedClassName },
        content,
        renderedChildren,
        theme
      )
    },

    form: (cfg) => renderFormFromDispatch(cfg),

    // `data-form` aliases `form`. Both use the same `formFields` definition at
    // the schema layer and the same renderer here — the alias exists so PG-04
    // record-detail composition (and the quick-edit drawer) can author a
    // data-bound CRUD form variant distinct from the generic `form` container.
    'data-form': (cfg) => renderFormFromDispatch(cfg),

    input: ({ elementProps }) => {
      const mergedClassName = buildInputClassName(
        elementProps,
        elementProps.className as string | undefined
      )
      return Renderers.renderInput({ ...elementProps, className: mergedClassName })
    },

    // ── Specialty form-controls (SSR-only; pure native HTML, no island) ──────
    //
    // These types use plain HTML5 `<input>` variants where the browser already
    // implements the interactive behaviour we care about (time picker, number
    // input with stepper buttons, date picker). The renderers translate
    // schema-author intent (top-level `timeFormat`, `min`, `max`, `step`, …)
    // into the native attribute set; no React island is required.

    'time-picker': ({ elementProps, component, rawProps }) => {
      // `timeFormat`, `minTime`, `maxTime`, `minuteStep` are top-level schema
      // fields per `time-picker.ts` (siblings of `props`). `minuteStep` is
      // expressed in MINUTES at the schema layer; the native HTML5 `<input
      // type="time">` `step` attribute is in SECONDS, so we multiply by 60.
      const c = (component ?? {}) as Record<string, unknown>
      const timeFormat = c['timeFormat'] as string | undefined
      const minTime = c['minTime'] as string | undefined
      const maxTime = c['maxTime'] as string | undefined
      const minuteStep = c['minuteStep'] as number | undefined
      const label = rawProps?.['label'] as string | undefined
      const stepSeconds = typeof minuteStep === 'number' ? minuteStep * 60 : undefined
      return Renderers.renderTimePicker({
        props: elementProps,
        label,
        timeFormat,
        minTime,
        maxTime,
        stepSeconds,
      })
    },

    'date-picker': ({ elementProps, component, rawProps }) => {
      // `dateFormat`, `minDate`, `maxDate`, `datePickerMode` are top-level
      // schema fields per `date-picker.ts` (siblings of `props`). The popover
      // trigger + calendar grid are entirely client-side (react-day-picker),
      // so the SSR placeholder is a non-interactive button shaped like the
      // hydrated trigger; the eager `DatePickerIsland` takes over on mount.
      const c = (component ?? {}) as Record<string, unknown>
      const dateFormat = c['dateFormat'] as string | undefined
      const minDate = c['minDate'] as string | undefined
      const maxDate = c['maxDate'] as string | undefined
      const datePickerMode = c['datePickerMode'] as 'single' | 'range' | undefined
      const label = rawProps?.['label'] as string | undefined
      const placeholder = rawProps?.['placeholder'] as string | undefined
      const disabled = rawProps?.['disabled'] as boolean | undefined
      const name = rawProps?.['name'] as string | undefined
      const islandProps = {
        id: elementProps.id as string | undefined,
        label,
        placeholder,
        dateFormat,
        minDate,
        maxDate,
        datePickerMode,
        disabled,
        name,
      }
      return Renderers.renderDatePickerIsland({
        props: elementProps,
        islandProps,
        label,
        placeholder,
        disabled,
      })
    },

    'number-input': ({ elementProps, component, rawProps }) => {
      // `min`, `max`, `step`, `defaultValue`, `showStepper` are top-level
      // schema fields per `number-input.ts` (siblings of `props`). The native
      // `<input type="number">` carries `role="spinbutton"` and ArrowUp /
      // ArrowDown keyboard handling, but the schema's `showStepper` UI
      // (explicit `+` / `-` buttons) plus on-blur min/max clamping need
      // JavaScript — wired by the eager `NumberInputIsland`.
      const c = (component ?? {}) as Record<string, unknown>
      const min = c['min'] as number | undefined
      const max = c['max'] as number | undefined
      const step = c['step'] as number | undefined
      const defaultValue = c['defaultValue'] as number | undefined
      const showStepper = c['showStepper'] as boolean | undefined
      const label = rawProps?.['label'] as string | undefined
      const disabled = rawProps?.['disabled'] as boolean | undefined
      const name = rawProps?.['name'] as string | undefined
      const islandProps = {
        id: elementProps.id as string | undefined,
        label,
        min,
        max,
        step,
        defaultValue,
        showStepper,
        disabled,
        name,
      }
      return Renderers.renderNumberInputIsland({
        props: elementProps,
        islandProps,
        label,
        min,
        max,
        step,
        defaultValue,
        showStepper,
      })
    },

    textarea: ({ elementProps, component, rawProps }) => {
      // `rows`, `maxLength`, `autoResize` are top-level schema fields per
      // textarea.ts (siblings of `props`), not inside `props`. Same lookup
      // contract as the form-control islands — see `pickFromComponent`
      // doc-comment in `island-form-components.tsx`.
      //
      // `props.label` (when present) is translated into `aria-label` so
      // `getByRole('textbox', { name: ... })` resolves. Same pattern as the
      // select/checkbox renderers which read `rawProps?.label`.
      const c = (component ?? {}) as Record<string, unknown>
      const rows = c['rows'] as number | undefined
      const maxLength = c['maxLength'] as number | undefined
      const autoResize = c['autoResize'] as boolean | undefined
      const label = rawProps?.['label'] as string | undefined

      return Renderers.renderTextarea({
        props: elementProps,
        rows,
        maxLength,
        label,
        autoResize,
        placeholder: rawProps?.['placeholder'] as string | undefined,
        name: rawProps?.['name'] as string | undefined,
      })
    },

    field: ({ elementProps, component, renderedChildren }) => {
      // `fieldLabel`, `fieldDescription`, `fieldError`, `required` are top-level
      // schema fields per field.ts (siblings of `props`). The first child's
      // `props.id` is used as the label's `htmlFor` target so a click on the
      // label focuses the nested control natively (no JS / island required).
      const c = (component ?? {}) as Record<string, unknown>
      return Renderers.renderField({
        props: elementProps,
        fieldLabel: c['fieldLabel'] as string | undefined,
        fieldDescription: c['fieldDescription'] as string | undefined,
        fieldError: c['fieldError'] as string | undefined,
        required: c['required'] as boolean | undefined,
        controlId: Renderers.extractFirstChildId(component),
        children: renderedChildren,
      })
    },

    'file-upload': ({ elementProps, component, rawProps }) => {
      // `accept`, `maxFiles`, `dropZone`, `maxFileSize`, and `disabled` are
      // top-level schema fields on the file-upload component (siblings of
      // `props`), not nested inside `props` — same lookup contract as the
      // form-control islands. See the `pickFromComponent` doc-comment in
      // `island-form-components.tsx`. `pickCompField` extracts the
      // component-level → rawProps fallback in one call so the dispatcher
      // stays under the cyclomatic-complexity ceiling.
      const c = (component ?? {}) as Record<string, unknown>
      const accept = pickCompField<string>(c, rawProps, 'accept')
      const maxFiles = pickCompField<number>(c, rawProps, 'maxFiles')
      const dropZone = pickCompField<boolean>(c, rawProps, 'dropZone')
      const maxFileSize = pickCompField<number>(c, rawProps, 'maxFileSize')
      const disabled = rawProps?.['disabled'] as boolean | undefined
      const label = rawProps?.['label'] as string | undefined
      // Submission wiring (siblings of `props`): the upload destination + the
      // onSuccess effects / onError toast. The island POSTs the picked file to
      // `uploadActionUrl` and runs the configured effects on the response.
      const uploadActionUrl = resolveUploadActionUrl(pickCompField(c, rawProps, 'uploadAction'))
      const onSuccess = pickCompField(c, rawProps, 'onSuccess')
      const onError = pickCompField(c, rawProps, 'onError')

      // Hydrate (emit the island marker) when `dropZone` is true (real-time size /
      // count validation) OR when an `uploadAction` is set (the button variant
      // must hydrate to POST the picked file + run its onSuccess/onError effects).
      // The SSR placeholder is the same plain skeleton; the island re-renders on
      // mount.
      if (dropZone === true || uploadActionUrl !== undefined) {
        const islandProps = {
          accept,
          maxFiles,
          maxFileSize,
          dropZone,
          disabled,
          label,
          uploadAction: uploadActionUrl,
          onSuccess,
          onError,
          id: elementProps.id as string | undefined,
          className: elementProps.className as string | undefined,
          'data-testid': elementProps['data-testid'] as string | undefined,
        }
        return Renderers.renderFileUploadIsland({
          props: elementProps,
          islandProps,
          accept,
          maxFiles,
          dropZone,
          disabled,
          label,
        })
      }

      return Renderers.renderFileUpload({
        props: elementProps,
        accept,
        maxFiles,
        dropZone,
        disabled,
        label,
      })
    },

    icon: ({ elementProps, renderedChildren, component }) => {
      const className = buildIconClassName(
        (component ?? {}) as Record<string, unknown>,
        elementProps['className'] as string | undefined
      )
      return Renderers.renderIcon({ ...elementProps, className }, renderedChildren)
    },

    badge: ({ elementProps, content, renderedChildren, interactions, component }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const authorClassName = elementProps['className'] as string | undefined

      // STATUS-INDICATOR VARIANT: when `variant === 'status'`, the badge renders
      // a colored dot followed by the `status` label. The dot's color comes from
      // `statusColor` (mapped to the design-system v1 *solid* semantic token via
      // {@link computeStatusBadgeDotClasses}); `pulse: true` adds `animate-pulse`
      // to draw attention to active/live statuses. The dot is emitted as a
      // child `<span>` carrying a `data-status-dot` attribute so specs can
      // target it independently of the color/animation classes.
      const { variant } = c
      if (variant === 'status') {
        const { status } = c
        const statusColor = resolveStatusDotColor(c['statusColor'])
        const pulse = c['pulse'] === true
        const dotClassName = computeStatusBadgeDotClasses({ color: statusColor, pulse })
        // Merge the prestyle wrapper (pill chrome + secondary surface tone) with
        // any author-supplied className; author wins at the cascade.
        const wrapperDefaults = computeStatusBadgeWrapperClasses()
        const mergedWrapperClassName = authorClassName
          ? `${wrapperDefaults} ${authorClassName}`
          : wrapperDefaults
        // `renderStatusBadge` itself prepends `inline-flex items-center gap-1.5`
        // when no author className is present; passing our prestyle className
        // through bypasses that fallback and ensures the badge's pill chrome
        // and tone come from the prestyle recipe.
        const badgePropsForStatus = convertBadgeProps({
          ...elementProps,
          className: mergedWrapperClassName,
        })
        const statusLabel = typeof status === 'string' ? status : undefined
        return Renderers.renderStatusBadge({
          props: badgePropsForStatus,
          dotClassName,
          label: statusLabel,
        })
      }

      // Default badge variant: merge the prestyle defaults (pill chrome + tone
      // per `badgeVariant`) with any author-supplied className.
      const mergedClassName = buildBadgeClassName(c, authorClassName)
      const badgeProps = convertBadgeProps({ ...elementProps, className: mergedClassName })

      return Renderers.renderHTMLElement({
        type: 'span',
        props: badgeProps,
        content: content,
        children: renderedChildren,
        interactions: interactions,
      })
    },

    customHTML: ({ elementProps, content, component }) => {
      // `trustedContent` is a render-time-only field carrying server-generated,
      // fully-trusted HTML (today: embedded forms expanded from `formRef` page
      // components — see `form-ref-resolver.ts`). It is rendered verbatim,
      // bypassing the rich-text allowlist sanitiser, which would otherwise
      // strip every interactive element (`<form>`, `<input>`, ...). A schema
      // author cannot supply it — the decoded `customHTML` schema only exposes
      // `content` / `htmlSrc`, so the field is absent on any validated input.
      const trustedContent = (component as { trustedContent?: unknown } | undefined)?.trustedContent
      if (typeof trustedContent === 'string') {
        return Renderers.renderCustomHTML(elementProps, trustedContent, true)
      }
      return Renderers.renderCustomHTML(elementProps, content)
    },

    'language-switcher': ({ elementProps, languages }) =>
      Renderers.renderLanguageSwitcher(elementProps, languages),

    // `searchInput` / `pageSearch` — the static SSR search shells. Both read
    // top-level schema fields (siblings of `props`); extracted to a sibling
    // module to keep this registry under its size ceiling.
    ...searchShellComponents,
  }
