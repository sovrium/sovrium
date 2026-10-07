/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  resolveInterpreterStringOverrides,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import {
  authFieldErrorId,
  authPendingLabel,
  authSubmitLabel,
  defaultAuthFields,
  withAuthFieldHints,
  type AuthFormField,
} from '@/presentation/design/auth-form-types'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormLayoutClasses,
} from '../../design/forms-default-classes'
import { computeInputDefaultClasses } from '../../design/input-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import {
  resolveOnSuccessRedirect,
  successPageOf,
  type AuthFieldOverride,
  type AuthFormAction,
  type AuthFormRenderContext,
} from './auth-form-action'
import { buildResolvedFieldDefs } from './crud-form/crud-form-field-resolver'
import type { ResolvedFieldDef } from './crud-form/crud-form-types'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Picks the native input type for an auth-form field.
 *
 * `email` columns become `<input type="email">`; any field whose name suggests
 * a password (`password`, `confirm_password`, …) becomes `<input
 * type="password">`; everything else falls back to a plain text input.
 */
function resolveInputType(field: ResolvedFieldDef): AuthFormField['inputType'] {
  if (field.type === 'email') return 'email'
  if (/password/i.test(field.name)) return 'password'
  return 'text'
}

/**
 * Resolves the list of fields an auth form should render (BEFORE action-level
 * `fields[]` overrides and localization are applied).
 *
 * When the form component is bound to a table via `dataSource.table`, those
 * fields (with their custom labels and placeholders) are resolved against the
 * table so the `required` flag and field type are accurate. Otherwise the
 * default email/password pair for the method is used.
 */
export function resolveAuthFormFields(
  method: string,
  tables?: Tables,
  component?: Component,
  strategy?: string
): readonly AuthFormField[] {
  const dataSource = (component as { dataSource?: { table?: string } } | undefined)?.dataSource
  const tableName = dataSource?.table
  if (component && tableName) {
    const resolved = buildResolvedFieldDefs(tables, tableName, component)
    if (resolved.length > 0) {
      return resolved.map((f) => ({
        name: f.name,
        label: f.displayLabel,
        required: f.required ?? false,
        placeholder: f.placeholder,
        inputType: resolveInputType(f),
      }))
    }
  }
  return defaultAuthFields(method, strategy)
}

/**
 * Localize a label/placeholder string through the page language + app
 * translations. Resolves `$t:key` references server-side and passes plain
 * strings through unchanged (falling back to the English literal).
 */
function localize(text: string, lang?: string, languages?: Languages): string {
  if (!lang) return resolveTranslationPattern(text, languages?.default ?? '', languages)
  return resolveTranslationPattern(text, lang, languages)
}

/**
 * Apply action-level `fields[]` label/placeholder overrides onto the resolved
 * field set, then localize every label + placeholder (and the override values,
 * which may themselves be `$t:key` references) through the page language.
 *
 * Overrides target a field by `name`; fields not listed keep their localized
 * built-in label. This runs for BOTH the table-backed and the default
 * email/password field sets, so a purely action-level `fields[]` (no bound
 * table) still customizes the rendered labels/placeholders.
 */
function applyFieldOverrides(
  fields: readonly AuthFormField[],
  overrides: readonly AuthFieldOverride[] | undefined,
  context: AuthFormRenderContext
): readonly AuthFormField[] {
  const { lang, languages } = context
  const overrideByName = new Map((overrides ?? []).map((o) => [o.name, o] as const))
  return fields.map((field) => {
    const override = overrideByName.get(field.name)
    const label = localize(override?.label ?? field.label, lang, languages)
    const rawPlaceholder = override?.placeholder ?? field.placeholder
    const placeholder =
      rawPlaceholder !== undefined ? localize(rawPlaceholder, lang, languages) : undefined
    return { ...field, label, ...(placeholder !== undefined && { placeholder }) }
  })
}

/**
 * Resolve the submit + in-flight (pending) button labels for an auth form.
 *
 * Each honors its action-level override (localized via `$t:key`) and otherwise
 * falls back to the localized built-in label for the `method`. Resolved together
 * so the pending label always mirrors the submit label's localization — a
 * French console shows `Se connecter` / `Connexion…`, never a hardcoded
 * `Loading...`.
 */
function resolveAuthLabels(
  action: AuthFormAction,
  method: string,
  lang?: string,
  languages?: Languages
): { readonly submitLabel: string; readonly pendingLabel: string } {
  return {
    submitLabel: action.submitLabel
      ? localize(action.submitLabel, lang, languages)
      : authSubmitLabel(method),
    pendingLabel: action.pendingLabel
      ? localize(action.pendingLabel, lang, languages)
      : authPendingLabel(method),
  }
}

/**
 * Builds the serialized island props for the auth form island component.
 */
function buildIslandPropsJson(config: {
  readonly method: string
  readonly action: AuthFormAction
  readonly fields: readonly AuthFormField[]
  readonly submitLabel: string
  readonly pendingLabel: string
  readonly testId: unknown
  readonly id: unknown
  readonly redirectUrl: string | undefined
  readonly uiStrings?: Readonly<Record<string, string>>
}): string {
  return JSON.stringify({
    method: config.method,
    strategy: config.action.strategy,
    factor: config.action.factor,
    trustDevice: config.action.trustDevice,
    tokenParam: config.action._invitationParam,
    uiStrings: config.uiStrings,
    fields: config.fields,
    submitLabel: config.submitLabel,
    pendingLabel: config.pendingLabel,
    redirectUrl: config.redirectUrl,
    successToast: config.action.onSuccess?.toast,
    successPage: successPageOf(config.action),
    errorToast: config.action.onError?.toast,
    'data-testid': config.testId,
    id: config.id,
  })
}

/**
 * Builds the inline style for the auth-form island wrapper.
 *
 * The generic island marker carries `display:inline-block` (a hydration-box
 * hack giving every island a nonzero pre-mount box). For a block form that
 * shrink-wraps the wrapper to its widest control — so the inner `w-full` form
 * only ever fills ~182px instead of its card. We force the auth-form wrapper to
 * a full-width BLOCK so the form spans its container and matches the design-
 * system auth-layout scene. Returned from a helper (not an inline literal) so
 * the `display`/`width` overrides win over the inherited inline style without
 * tripping the react-perf JSX object-allocation rule.
 *
 * EXCEPTION — the hide gate wins: when auth is not configured,
 * `render-page.tsx::stripAuthActionsIfUnconfigured` injects
 * `style={{ display: 'none' }}` onto the component to hide the whole form
 * (the inner SSR form keeps it, but the island re-renders without it, so the
 * wrapper is the only durable hide point post-hydration). If we unconditionally
 * forced `display:'block'` we would clobber that gate and the form would become
 * visible once the island mounts. So we only override `display` to `block` when
 * the base style is NOT already hiding the wrapper.
 */
export function buildAuthWrapperStyle(baseStyle: unknown): React.CSSProperties {
  const base = baseStyle as React.CSSProperties | undefined
  if (base?.display === 'none') return base
  return {
    ...base,
    display: 'block',
    width: '100%',
  }
}

/**
 * Builds the attributes of the SSR skeleton form. `method: 'post'` keeps a
 * submit that slips past the disabled button from writing the credentials into
 * the page address; it never actually sends (see {@link renderAuthFormSkeleton}).
 */
function buildFormDataAttrs(
  method: string,
  action: AuthFormAction,
  redirectUrl: string | undefined
): Record<string, unknown> {
  return {
    method: 'post',
    'data-action-type': 'auth',
    'data-action-method': method,
    ...(redirectUrl && { 'data-on-success-redirect': redirectUrl }),
    ...(action.onSuccess?.toast?.message && {
      'data-on-success-toast': action.onSuccess.toast.message,
    }),
    noValidate: true,
  }
}

/**
 * Renders a single auth-form field (SSR skeleton): a `<div data-field>` wrapper
 * containing a `<label>`-associated input and an empty inline-error slot.
 *
 * The wrapper carries `data-field="<name>"` so specs can scope a field's error
 * region; the inline-error `<div id={field.errorId}>` (unique per form) is hidden until the island
 * populates it with a validation message.
 *
 * Inline errors deliberately do NOT carry `role="alert"` — only the form-level
 * summary banner does. This keeps a `[role="alert"]` selector resolving to
 * exactly one element (the summary) under Playwright strict mode.
 */
function renderAuthFormField(field: AuthFormField): ReactElement {
  const errorId = authFieldErrorId(field)
  return (
    <div
      data-field={field.name}
      key={field.name}
    >
      <label className={computeFormFieldClasses()}>
        <span className={computeFormFieldLabelClasses()}>{field.label}</span>
        <input
          type={field.inputType}
          data-component-type="input"
          name={field.name}
          autoComplete={field.autoComplete}
          inputMode={field.inputMode}
          aria-invalid="false"
          aria-describedby={errorId}
          // The 'default' state; the island re-applies the recipe with 'error' on a
          // failed field, so the SSR paint and the hydrated control stay identical.
          className={computeInputDefaultClasses({ state: 'default' })}
          {...(field.placeholder && { placeholder: field.placeholder })}
        />
      </label>
      <div
        id={errorId}
        hidden
      />
    </div>
  )
}

/**
 * The author props a sign-in form's SSR skeleton `<form>` carries: the internal
 * markers dropped, and the component's type too — the island host names the
 * `form`, and a skeleton naming it as well would name one form twice.
 */
export function authSkeletonFormProps(props: ElementProps): ElementProps {
  const { 'data-component-type': _named, ...rest } = omitInternalMarkers(props)
  return rest
}

/**
 * Renders the SSR skeleton `<form>` for the auth island — the first paint and
 * the Suspense loading state that the island replaces once its script runs.
 * Extracted from {@link renderAuthForm} so both stay within the React component
 * size budget; the wrapper `<div data-island>` composes it.
 *
 * The skeleton cannot sign anyone in: the auth endpoints take JSON, which only
 * the island sends. So its submit is drawn `disabled` — which also blocks Enter
 * in a field — and the island renders its own live button in its place. Without
 * that, a press before the script ran fell back to the browser default: a GET to
 * the page's own address carrying the email and password in the URL.
 */
function renderAuthFormSkeleton(config: {
  readonly props: ElementProps
  readonly formDataAttrs: Record<string, unknown>
  readonly fields: readonly AuthFormField[]
  readonly submitLabel: string
}): ReactElement {
  const { props, formDataAttrs, fields, submitLabel } = config
  return (
    <form
      {...authSkeletonFormProps(props)}
      {...formDataAttrs}
      // className LAST so the layout class survives the `{...props}` spread (an
      // empty `props.className` would clobber it); the author's className is merged.
      className={resolveClasses(computeFormLayoutClasses(), props.className as string | undefined)}
    >
      {fields.map((field) => renderAuthFormField(field))}
      <div
        data-testid="error-summary"
        role="alert"
        hidden
      />
      {/* Result slot — empty + hidden, as the island's empty state; the island
          paints its error/success banner here on submit. */}
      <div
        data-error=""
        hidden
      />
      <button
        type="submit"
        disabled
        data-component-type="button"
        className={`${computeButtonDefaultClasses()} w-full`}
      >
        {submitLabel}
      </button>
    </form>
  )
}

/**
 * Renders an auth form as a React island with SSR skeleton.
 *
 * The island marker `data-island="auth-form"` is discovered by the island client
 * which mounts the interactive AuthFormIsland React component. The HTML form
 * inside is the loading skeleton: it paints the form at once, and its submit
 * stays disabled until the island takes over (it cannot send on its own).
 *
 * When the form component declares a `fields[]` array, the rendered inputs use
 * the schema-supplied labels/placeholders; otherwise the default email/password
 * pair is used.
 */
export function renderAuthForm(
  props: ElementProps,
  action: AuthFormAction,
  context: AuthFormRenderContext = {}
): ReactElement {
  const { tables, component, lang, languages, landingPath } = context
  const method = action.method ?? 'login'
  const redirectUrl = resolveOnSuccessRedirect(action, landingPath)
  const { submitLabel, pendingLabel } = resolveAuthLabels(action, method, lang, languages)
  // The base field set (a second-factor step names its code by `factor`), then overrides.
  const variant = action.strategy ?? action.factor
  const baseFields = resolveAuthFormFields(method, tables, component, variant)
  const fields = withAuthFieldHints(applyFieldOverrides(baseFields, action.fields, context), {
    method,
    ...(variant !== undefined && { variant }),
    ...(action._passkeyAutofill === true && { passkeyAutofill: true }),
  })
  const islandProps = buildIslandPropsJson({
    method,
    action,
    fields,
    submitLabel,
    pendingLabel,
    testId: props['data-testid'],
    id: props.id,
    redirectUrl,
    // The enrolment screens after `enableTwoFactor` speak the page language.
    ...(method === 'enableTwoFactor' && {
      uiStrings: resolveInterpreterStringOverrides(['twoFactor.'], lang, languages),
    }),
  })
  const formDataAttrs = buildFormDataAttrs(method, action, redirectUrl)
  const wrapperStyle = buildAuthWrapperStyle(props.style)

  return (
    <div
      data-island="auth-form"
      data-island-props={islandProps}
      data-component-type="form"
      data-testid={props['data-testid'] as string | undefined}
      style={wrapperStyle}
    >
      {/* SSR skeleton — used as Suspense fallback and progressive enhancement */}
      {renderAuthFormSkeleton({ props, formDataAttrs, fields, submitLabel })}
    </div>
  )
}
