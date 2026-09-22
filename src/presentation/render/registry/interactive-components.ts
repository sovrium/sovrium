/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeButtonDefaultClasses,
  type ButtonSize,
  type ButtonState,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import {
  isOpenSpecimen,
  renderOpenDatePickerPopup,
} from '@/presentation/render/resolve/open-specimen-markup'
import {
  computeAlertClasses,
  computeBadgeClasses,
  computeStatusBadgeDotClasses,
  computeStatusBadgeWrapperClasses,
  type AlertVariant,
  type BadgeVariant,
  type StatusDotColor,
} from '../../design/feedback-default-classes'
import * as Renderers from '../elements'
import { overlayButtonSchemaFallbacks } from '../elements/button-action-builders'
import { convertBadgeProps } from './component-registry-helpers'
import { contrastBadgeComponent } from './design-components'
import { inputComponent } from './input-component'
import { inputGroupComponent } from './input-group-component'
// prettier-ignore
import {
  buildIconClassName,
  buildLinkClassName,
  mergePrestyle,
  variantFromButtonClassName,
} from './interactive-prestyle-builders'
import { localizeChildLabel } from './island-child-label'
import { pickCompField, resolveUploadActionUrl } from './island-overlay-props-builders'
import { searchShellComponents } from './search-shell-components'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

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
 * merged through {@link mergePrestyle}, so it beats the recipe on any
 * same-property conflict.
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
  return mergePrestyle(defaults, authorClassName)
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
 * merged through {@link mergePrestyle}, so it beats the recipe on any
 * same-property conflict.
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
  return mergePrestyle(defaults, authorClassName)
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
 * `props.className` is merged through {@link mergePrestyle}, so it beats the
 * recipe on any same-property conflict.
 *
 * This replaces the prior `.btn` / `.btn-{variant}` / `.btn-{size}` recipe
 * that depended on the CSS compiler's component layer being emitted.
 */
function buildButtonClassName(
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined,
  state: ButtonState,
  replaceDefaults = false
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
  return mergePrestyle(defaults, authorClassName, replaceDefaults)
}

// Renderer body for the `form` component type, in both of its modes. Threads
// the active page language (`currentLang`) + app `languages` to `renderForm` so
// an embedded auth form resolves `$t:key` submit/field-label references
// server-side.
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
      currentLang,
      languages,
      designStyles,
    }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const lang = { currentLang, languages }
      const propsWithSchemaFallbacks = overlayButtonSchemaFallbacks(elementProps, c, lang)
      const loading = c['loading'] as boolean | undefined
      const disabled = propsWithSchemaFallbacks['disabled'] === true
      // [internal ref]: a button's visual state determines whether the prestyled
      // hover-lift / motion classes apply. Disabled and loading reads as inactive.
      const buttonState: ButtonState = loading ? 'loading' : disabled ? 'disabled' : 'default'
      const mergedClassName = buildButtonClassName(
        c,
        propsWithSchemaFallbacks.className as string | undefined,
        buttonState,
        designStyles?.replace
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

    link: ({ elementProps, content, renderedChildren, component, designStyles }) => {
      const className = buildLinkClassName(
        (component ?? {}) as Record<string, unknown>,
        elementProps['className'] as string | undefined,
        designStyles?.replace
      )
      return Renderers.renderLink({ ...elementProps, className }, content, renderedChildren)
    },

    alert: ({ elementProps, content, renderedChildren, design, component }) => {
      const c = (component ?? {}) as Record<string, unknown>
      const mergedClassName = buildAlertClassName(c, elementProps.className as string | undefined)
      return Renderers.renderAlert(
        { ...elementProps, className: mergedClassName },
        content,
        renderedChildren,
        design
      )
    },

    // One entry for both modes. The dispatch reads `dataSource` off the config
    // to decide whether the form writes a record back to a bound table (the
    // PG-04 record-detail composition, the quick-edit drawer) or submits the
    // fields declared on it. `data-form` had a SECOND entry here pointing at
    // this same function, and the pair is what C3 merged: nothing about the
    // dispatch changed, one of the two keys went away.
    form: (cfg) => renderFormFromDispatch(cfg),

    // `input-group` — an input with a leading addon, a trailing addon, or an
    // attached control. Beside `input` because the two are the same control
    // wearing different chrome, and in its own MODULE because the rules it
    // keeps are about the PAIR (one height, one border, a squared seam) rather
    // than about either half.
    'input-group': inputGroupComponent,

    input: inputComponent,

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
        // The design-system console's `open` state cell. Drawn from
        // the island's own `DatePickerPopup`, without the island marker and
        // without the dialog role — the picture, not the control.
        openPopupHtml: isOpenSpecimen(rawProps)
          ? renderOpenDatePickerPopup({ label, minDate, maxDate, datePickerMode })
          : undefined,
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

    'file-upload': ({ elementProps, component, rawProps, currentLang, languages }) => {
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
      // `rawProps` is the props bag BEFORE transformation, so a `$t:` key in the
      // trigger's label arrives unresolved — the seam `localizeChildLabel`
      // already exists for on a tab's caption. An ABSENT label stays absent, so
      // the island keeps choosing its own built-in text rather than an empty one.
      const authoredLabel = rawProps?.['label'] as string | undefined
      const label =
        authoredLabel === undefined
          ? undefined
          : localizeChildLabel(authoredLabel, currentLang, languages)
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

    badge: (context) => {
      const { elementProps, content, renderedChildren, interactions, component } = context
      const c = (component ?? {}) as Record<string, unknown>
      const authorClassName = elementProps['className'] as string | undefined

      // CONTRAST VARIANT: the WCAG ratio between two colours, and the verdict
      // on it. It was its own component type once; a badge is what it always
      // drew, so the mode axis absorbed it rather than the kit carrying two
      // entries for "a small pill with a verdict in it". The body lives in
      // `design-components.tsx` — it resolves both operands through `design`,
      // which this module has no other reason to reach for.
      if (c['variant'] === 'contrast') return contrastBadgeComponent(context)

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
        // any author-supplied className; author wins same-property conflicts.
        const wrapperDefaults = computeStatusBadgeWrapperClasses()
        const mergedWrapperClassName = mergePrestyle(wrapperDefaults, authorClassName)
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

    'language-switcher': ({ elementProps, languages, currentLang }) =>
      Renderers.renderLanguageSwitcher(elementProps, languages, currentLang),

    // `search-input` / page-scoped `search-input` — the static SSR search shells. Both read
    // top-level schema fields (siblings of `props`); extracted to a sibling
    // module to keep this registry under its size ceiling.
    ...searchShellComponents,
  }
