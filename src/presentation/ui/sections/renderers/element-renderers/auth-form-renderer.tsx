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

export type AuthFieldOverride = {
  readonly name: string
  readonly label?: string
  readonly placeholder?: string
}

export type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  readonly submitLabel?: string
  readonly pendingLabel?: string
  readonly fields?: readonly AuthFieldOverride[]
  readonly onSuccess?: {
    readonly type?: string
    readonly navigate?: string
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
  readonly onError?: {
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
}

export interface AuthFormRenderContext {
  readonly tables?: Tables
  readonly component?: Component
  readonly lang?: string
  readonly languages?: Languages
  readonly landingPath?: string
}

function resolveInputType(field: ResolvedFieldDef): AuthFormField['inputType'] {
  if (field.type === 'email') return 'email'
  if (/password/i.test(field.name)) return 'password'
  return 'text'
}

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

function localize(text: string, lang?: string, languages?: Languages): string {
  if (!lang) return resolveTranslationPattern(text, languages?.default ?? '', languages)
  return resolveTranslationPattern(text, lang, languages)
}

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

function resolveOnSuccessRedirect(
  action: AuthFormAction,
  landingPath?: string
): string | undefined {
  if (action.onSuccess?.type === 'role-landing') return landingPath
  return action.onSuccess?.navigate
}

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

function buildAuthWrapperStyle(baseStyle: unknown): React.CSSProperties {
  const base = baseStyle as React.CSSProperties | undefined
  if (base?.display === 'none') return base
  return {
    ...base,
    display: 'block',
    width: '100%',
  }
}

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
      className={[computeFormLayoutClasses(), props.className as string | undefined]
        .filter(Boolean)
        .join(' ')}
    >
      {fields.map((field) => renderAuthFormField(field))}
      {}
      <div
        data-testid="error-summary"
        role="alert"
        hidden
      />
      {}
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

export function renderAuthForm(
  props: ElementProps,
  action: AuthFormAction,
  context: AuthFormRenderContext = {}
): ReactElement {
  const { tables, component, lang, languages, landingPath } = context
  const method = action.method ?? 'login'
  const redirectUrl = resolveOnSuccessRedirect(action, landingPath)
  const { submitLabel, pendingLabel } = resolveAuthLabels(action, method, lang, languages)
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
      {}
      {renderAuthFormSkeleton({ props, formDataAttrs, fields, submitLabel })}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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
