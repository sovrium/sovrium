/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import {
  authPendingLabel,
  authSubmitLabel,
  defaultAuthFields,
  type AuthFormField,
} from '@/presentation/utils/auth-form-types'
import { buildResolvedFieldDefs } from './crud-form/crud-form-field-resolver'
import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormLayoutClasses,
} from './recipes/forms-default-classes'
import { computeInputDefaultClasses } from './recipes/input-default-classes'
import type { ResolvedFieldDef } from './crud-form/crud-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** Per-field label/placeholder override declared on an auth action. */
export type AuthFieldOverride = {
  readonly name: string
  readonly label?: string
  readonly placeholder?: string
}

/**
 * Auth action shape for form rendering
 */
export type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  /** Custom submit-button label (supports `$t:key`). Overrides the built-in. */
  readonly submitLabel?: string
  /** Custom in-flight (pending) submit-button label (supports `$t:key`). */
  readonly pendingLabel?: string
  /** Per-field label/placeholder overrides (each supports `$t:key`). */
  readonly fields?: readonly AuthFieldOverride[]
  readonly onSuccess?: {
    /**
     * Post-login redirect mode. `'role-landing'` sends the user to `auth.landingPath`, where the per-role
     * landing resolver redirects each role to its own `defaultLanding`.
     * Other/undefined values fall back to the explicit `navigate` path.
     */
    readonly type?: string
    readonly navigate?: string
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
  readonly onError?: {
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
}

/**
 * Bundle of optional inputs threaded from the section renderer into
 * {@link renderAuthForm}: the bound table + component (for table-backed field
 * resolution) and the active page language + app translations (for `$t:key`
 * localization of submit/field labels). Bundled into one object to keep the
 * renderer parameter count under the ESLint `max-params` ceiling.
 */
export interface AuthFormRenderContext {
  readonly tables?: Tables
  readonly component?: Component
  readonly lang?: string
  readonly languages?: Languages
  /**
   * App-level `auth.landingPath`. When the
   * form's `onSuccess.type === 'role-landing'`, the post-login redirect target
   * resolves to this path; the existing per-role landing resolver
   * (render-page.tsx → resolveLandingPath) then routes each role onward.
   */
  readonly landingPath?: string
}

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
  component?: Component
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
  return defaultAuthFields(method)
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
 * Resolves the post-login redirect target for an auth form.
 *
 * `onSuccess.type === 'role-landing'` sends
 * the user to `auth.landingPath`; the per-role landing resolver then routes
 * each role to its own `defaultLanding`. When `landingPath` is not configured
 * the mode degrades gracefully to no redirect. Any other `onSuccess` shape
 * uses the explicit `navigate` path unchanged.
 */
function resolveOnSuccessRedirect(
  action: AuthFormAction,
  landingPath?: string
): string | undefined {
  if (action.onSuccess?.type === 'role-landing') return landingPath
  return action.onSuccess?.navigate
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
}): string {
  return JSON.stringify({
    method: config.method,
    fields: config.fields,
    submitLabel: config.submitLabel,
    pendingLabel: config.pendingLabel,
    redirectUrl: config.redirectUrl,
    successToast: config.action.onSuccess?.toast,
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
function buildAuthWrapperStyle(baseStyle: unknown): React.CSSProperties {
  const base = baseStyle as React.CSSProperties | undefined
  if (base?.display === 'none') return base
  return {
    ...base,
    display: 'block',
    width: '100%',
  }
}

/**
 * Builds data attributes for the SSR fallback form.
 */
function buildFormDataAttrs(
  method: string,
  action: AuthFormAction,
  redirectUrl: string | undefined
): Record<string, unknown> {
  return {
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
 * region; the inline-error `<div id="<name>-error">` is hidden until the island
 * populates it with a validation message.
 *
 * Inline errors deliberately do NOT carry `role="alert"` — only the form-level
 * summary banner does. This keeps a `[role="alert"]` selector resolving to
 * exactly one element (the summary) under Playwright strict mode.
 */
function renderAuthFormField(field: AuthFormField): ReactElement {
  const autoComplete =
    field.inputType === 'email'
      ? 'email'
      : field.inputType === 'password'
        ? 'new-password'
        : undefined
  return (
    <div
      data-field={field.name}
      key={field.name}
    >
      <label className={computeFormFieldClasses()}>
        <span className={computeFormFieldLabelClasses()}>{field.label}</span>
        <input
          type={field.inputType}
          name={field.name}
          autoComplete={autoComplete}
          aria-invalid="false"
          aria-describedby={`${field.name}-error`}
          // SSR skeleton renders the 'default' state (aria-invalid="false"); the
          // island re-applies computeInputDefaultClasses with the 'error' state
          // once a field fails validation. Sharing the recipe keeps the SSR paint
          // and the hydrated control byte-identical and on the design-system
          // auth-layout look (full-width + bordered + focus ring).
          className={computeInputDefaultClasses({ state: 'default' })}
          {...(field.placeholder && { placeholder: field.placeholder })}
        />
      </label>
      <div
        id={`${field.name}-error`}
        hidden
      />
    </div>
  )
}

/**
 * Renders the SSR skeleton `<form>` for the auth island — the progressive-
 * enhancement fallback and Suspense loading state that the island hydrates over
 * (the form still works via native POST if JS fails to load). Extracted from
 * {@link renderAuthForm} so both stay within the React component size budget;
 * the wrapper `<div data-island>` composes it.
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
      {...props}
      {...formDataAttrs}
      // className LAST so the layout class survives the `{...props}` spread —
      // a `props.className` key (even empty/undefined) would otherwise clobber
      // an earlier `className=`, stripping the full-width flex stack. Author
      // className is merged in, not lost.
      className={[computeFormLayoutClasses(), props.className as string | undefined]
        .filter(Boolean)
        .join(' ')}
    >
      {fields.map((field) => renderAuthFormField(field))}
      {/* Summary error banner — populated by the island on submit */}
      <div
        data-testid="error-summary"
        role="alert"
        hidden
      />
      {/* Form-level result slot — empty + `hidden` here so it reserves no
          layout gap and hydrates byte-identically to the island's empty state.
          The island paints an operator-grade error/success banner (with
          role="alert"/"status") into this slot on submit, client-side. */}
      <div
        data-error=""
        hidden
      />
      <button
        type="submit"
        className="btn btn-primary w-full"
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
 * inside serves as both a loading skeleton and progressive enhancement fallback
 * (form still works via native POST if JS fails to load).
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
  // Submit + in-flight labels (action overrides win, else localized built-ins).
  const { submitLabel, pendingLabel } = resolveAuthLabels(action, method, lang, languages)
  // Resolve the base field set, then layer action-level overrides + localization.
  const baseFields = resolveAuthFormFields(method, tables, component)
  const fields = applyFieldOverrides(baseFields, action.fields, context)
  const islandProps = buildIslandPropsJson({
    method,
    action,
    fields,
    submitLabel,
    pendingLabel,
    testId: props['data-testid'],
    id: props.id,
    redirectUrl,
  })
  const formDataAttrs = buildFormDataAttrs(method, action, redirectUrl)
  const wrapperStyle = buildAuthWrapperStyle(props.style)

  return (
    <div
      data-island="auth-form"
      data-island-props={islandProps}
      data-testid={props['data-testid'] as string | undefined}
      style={wrapperStyle}
    >
      {/* SSR skeleton — used as Suspense fallback and progressive enhancement */}
      {renderAuthFormSkeleton({ props, formDataAttrs, fields, submitLabel })}
    </div>
  )
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Renders an OAuth form with a single button that redirects to the OAuth provider
 */
export function renderOAuthForm(props: ElementProps, action: AuthFormAction): ReactElement {
  const provider = action.provider ?? ''
  const oauthUrl = `/api/auth/sign-in/${provider}`
  const redirectTarget = action.onSuccess?.navigate

  const formProps: Record<string, unknown> = {
    ...props,
    ...(redirectTarget && { 'data-redirect': redirectTarget }),
  }

  return (
    <form {...formProps}>
      <a href={oauthUrl}>
        <button type="button">Sign in with {capitalize(provider)}</button>
      </a>
    </form>
  )
}
