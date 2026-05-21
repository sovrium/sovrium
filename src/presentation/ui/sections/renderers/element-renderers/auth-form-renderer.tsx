/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  authSubmitLabel,
  defaultAuthFields,
  type AuthFormField,
} from '@/presentation/utils/auth-form-types'
import { buildResolvedFieldDefs } from './crud-form-field-resolver'
import type { ResolvedFieldDef } from './crud-form-renderer'
import type { ElementProps } from './html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

export type AuthFormAction = {
  readonly type: string
  readonly method?: string
  readonly strategy?: string
  readonly provider?: string
  readonly onSuccess?: {
    readonly navigate?: string
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
  readonly onError?: {
    readonly toast?: { readonly message?: string; readonly variant?: string }
  }
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

function buildIslandPropsJson(config: {
  readonly method: string
  readonly action: AuthFormAction
  readonly fields: readonly AuthFormField[]
  readonly testId: unknown
  readonly id: unknown
}): string {
  return JSON.stringify({
    method: config.method,
    fields: config.fields,
    redirectUrl: config.action.onSuccess?.navigate,
    successToast: config.action.onSuccess?.toast,
    errorToast: config.action.onError?.toast,
    'data-testid': config.testId,
    id: config.id,
  })
}

function buildFormDataAttrs(method: string, action: AuthFormAction): Record<string, unknown> {
  return {
    'data-action-type': 'auth',
    'data-action-method': method,
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
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
      <label>
        {field.label}
        <input
          type={field.inputType}
          name={field.name}
          autoComplete={autoComplete}
          aria-invalid="false"
          aria-describedby={`${field.name}-error`}
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

export function renderAuthForm(
  props: ElementProps,
  action: AuthFormAction,
  tables?: Tables,
  component?: Component
): ReactElement {
  const method = action.method ?? 'login'
  const submitLabel = authSubmitLabel(method)
  const fields = resolveAuthFormFields(method, tables, component)
  const islandProps = buildIslandPropsJson({
    method,
    action,
    fields,
    testId: props['data-testid'],
    id: props.id,
  })
  const formDataAttrs = buildFormDataAttrs(method, action)

  return (
    <div
      data-island="auth-form"
      data-island-props={islandProps}
      data-testid={props['data-testid'] as string | undefined}
      style={props.style as React.CSSProperties | undefined}
    >
      {}
      <form
        {...props}
        {...formDataAttrs}
      >
        {fields.map((field) => renderAuthFormField(field))}
        {}
        <div
          data-testid="error-summary"
          role="alert"
          hidden
        />
        <div data-error="" />
        <button
          type="submit"
          className="btn btn-primary"
        >
          {submitLabel}
        </button>
      </form>
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
