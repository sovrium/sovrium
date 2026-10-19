/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
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
  computeStatusBadgeDotClasses,
  computeStatusBadgeWrapperClasses,
  type StatusDotColor,
} from '../../design/feedback-default-classes'
import * as Renderers from '../elements'
import { overlayButtonSchemaFallbacks } from '../elements/button-action-builders'
import { alertComponent } from './alert-component'
import { defaultBadge } from './badge-default-component'
import { withSizeAndIcon } from './button-icon-parts'
import { withNewTabName } from './button-new-tab-name'
import { convertBadgeProps } from './component-registry-helpers'
import { contrastBadgeComponent } from './design-components'
import { fileUploadComponent } from './file-upload-component'
import { inputComponents } from './input-component'
import { inputGroupComponent } from './input-group-component'
// prettier-ignore
import {
  buildIconClassName,
  mergePrestyle,
  variantFromButtonClassName,
} from './interactive-prestyle-builders'
import { resolveInterpreterStringOverrides } from './island-child-label'
import { linkComponent } from './link-component'
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

const BUTTON_VARIANTS = new Set<ButtonVariant>([
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab',
])
const BUTTON_SIZES = new Set<ButtonSize>([
  'xs',
  'sm',
  'default',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
])

/**
 * Build the merged className for a button (the prestyled-islands rule, prestyled-by-default).
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

// Renderer body for the `form` component type, in both of its modes: the page
// language reaches an auth form's `$t:` labels, `designStyles` a form's parts.
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
    designStyles: cfg.designStyles,
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
      // Whether the prestyled hover-lift / motion classes apply; disabled and loading are inactive.
      const buttonState: ButtonState = loading ? 'loading' : disabled ? 'disabled' : 'default'
      const mergedClassName = buildButtonClassName(
        c,
        propsWithSchemaFallbacks.className as string | undefined,
        buttonState,
        designStyles?.replace
      )

      const sized = withSizeAndIcon(c, propsWithSchemaFallbacks, renderedChildren)
      return Renderers.renderButton({
        props: withNewTabName(
          { ...sized.props, className: mergedClassName },
          {
            content: sized.iconOnly ? undefined : content,
            ...{ interactions, action, ...lang },
          }
        ),
        content: sized.iconOnly ? undefined : content,
        children: sized.children,
        ...{ interactions, action, routeParams, loading, lang, component: c },
      })
    },

    link: linkComponent,

    alert: alertComponent,

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

    ...inputComponents,

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

    'date-picker': ({ elementProps, component, rawProps, currentLang, languages }) => {
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
        uiStrings: resolveInterpreterStringOverrides(['datePicker.'], currentLang, languages),
      }
      const pick = resolveInterpreterString('datePicker.pick', currentLang, languages)
      return Renderers.renderDatePickerIsland({
        props: elementProps,
        islandProps,
        label,
        // The server-drawn trigger with no label reads the picker's own word, in the page language.
        placeholder: placeholder ?? (label ? undefined : pick),
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
        errors: c['errors'] as readonly string[] | undefined,
        orientation: c['orientation'] as 'vertical' | 'horizontal' | 'responsive' | undefined,
        legend: c['legend'] as string | undefined,
        fieldTitle: c['fieldTitle'] as string | undefined,
        required: c['required'] as boolean | undefined,
        controlId: Renderers.extractFirstChildId(component),
        children: renderedChildren,
      })
    },

    'file-upload': fileUploadComponent,

    icon: ({ elementProps, renderedChildren, component }) => {
      const className = buildIconClassName(
        (component ?? {}) as Record<string, unknown>,
        elementProps['className'] as string | undefined,
        elementProps['size']
      )
      return Renderers.renderIcon({ ...elementProps, className }, renderedChildren)
    },

    badge: (context) => {
      const { elementProps, component } = context
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
          'data-slot': 'badge',
          'data-variant': 'secondary',
        })
        const statusLabel = typeof status === 'string' ? status : undefined
        return Renderers.renderStatusBadge({
          props: badgePropsForStatus,
          dotClassName,
          label: statusLabel,
        })
      }

      return defaultBadge(context, c, authorClassName)
    },

    customHTML: ({ elementProps, content, component }) => {
      // `trustedContent` is a render-time-only field carrying server-generated,
      // fully-trusted HTML (today: embedded forms expanded from `formRef` page
      // components — see `form-ref-resolver.ts`). It is rendered verbatim,
      // bypassing the rich-text allowlist sanitiser, which would otherwise
      // strip every interactive element (`<form>`, `<input>`, ...). A schema
      // author cannot supply it — the decoded `customHTML` schema only exposes
      // `content` / `htmlSrc`, so the field is absent on any validated input.
      //
      // `authoredType` travels with it: the type the author declared before the
      // render-time rewrite (a `formRef` form is a `form`), stamped in place of
      // `customHTML` so the element is named once, as written.
      const synthesized = component as
        { readonly trustedContent?: unknown; readonly authoredType?: unknown } | undefined
      const trustedContent = synthesized?.trustedContent
      if (typeof trustedContent === 'string') {
        const authoredType = synthesized?.authoredType
        const namedProps =
          typeof authoredType === 'string'
            ? { ...elementProps, 'data-component-type': authoredType }
            : elementProps
        return Renderers.renderCustomHTML(namedProps, trustedContent, true)
      }
      return Renderers.renderCustomHTML(elementProps, content)
    },

    'language-switcher': ({ elementProps, languages, currentLang, designStyles }) =>
      Renderers.renderLanguageSwitcher(elementProps, languages, currentLang, designStyles),

    // `search-input` / page-scoped `search-input` — the static SSR search shells. Both read
    // top-level schema fields (siblings of `props`); extracted to a sibling
    // module to keep this registry under its size ceiling.
    ...searchShellComponents,
  }
