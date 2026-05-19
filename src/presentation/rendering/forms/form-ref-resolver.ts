/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderEmbeddedFormBody } from './form-renderer'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

interface FormRefComponent {
  readonly formRef: string
  readonly originalProps: Record<string, unknown> | undefined
  readonly inlinePrefill: InlinePrefillShape | undefined
}

interface InlinePrefillShape {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill?: boolean
}

type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

function asFormRefComponent(component: Component): FormRefComponent | undefined {
  if (component.type !== 'form') return undefined
  const ref = (component as { readonly formRef?: unknown }).formRef
  if (typeof ref !== 'string') return undefined
  const inlinePrefillRaw = (component as { readonly inlinePrefill?: unknown }).inlinePrefill
  return {
    formRef: ref,
    originalProps: component.props,
    inlinePrefill: isInlinePrefill(inlinePrefillRaw) ? inlinePrefillRaw : undefined,
  }
}

function isInlinePrefill(value: unknown): value is InlinePrefillShape {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly prefill?: unknown }
  return typeof candidate.prefill === 'object' && candidate.prefill !== null
}

function composeWrapperClass(variant: unknown, className: unknown): string {
  const base = 'embedded-form'
  const variantClass = typeof variant === 'string' ? `embedded-form--${variant}` : undefined
  const passthrough = typeof className === 'string' && className.length > 0 ? className : undefined
  return [base, variantClass, passthrough]
    .filter((token): token is string => typeof token === 'string' && token.length > 0)
    .join(' ')
}

function buildWrapperProps(
  formRef: string,
  originalProps: Record<string, unknown> | undefined
): Record<string, unknown> {
  const variant = originalProps?.['variant']
  const className = originalProps?.['className']
  const id = originalProps?.['id']
  const testId = originalProps?.['data-testid']
  return {
    ...(typeof id === 'string' ? { id } : {}),
    className: composeWrapperClass(variant, className),
    'data-form-ref': formRef,
    ...(typeof variant === 'string' ? { 'data-variant': variant } : {}),
    ...(typeof testId === 'string' ? { 'data-testid': testId } : {}),
  }
}

function resolvePrefillValue(
  value: PrefillValue,
  parentRecord: Readonly<Record<string, unknown>> | undefined
): PrefillValue | undefined {
  if (typeof value !== 'string') return value
  if (!value.startsWith('$parent.')) return value
  if (parentRecord === undefined) return undefined
  const segment = value.slice('$parent.'.length)
  const resolved = parentRecord[segment]
  if (resolved === undefined || resolved === null) return undefined
  if (Array.isArray(resolved)) {
    return resolved.filter((item): item is string => typeof item === 'string')
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
  return String(resolved)
}

function resolvePrefillMap(
  inlinePrefill: InlinePrefillShape | undefined,
  parentRecord: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, PrefillValue>> {
  if (inlinePrefill === undefined) return {}
  const entries = Object.entries(inlinePrefill.prefill)
    .map(([key, raw]): readonly [string, PrefillValue | undefined] => [
      key,
      resolvePrefillValue(raw, parentRecord),
    ])
    .filter((entry): entry is readonly [string, PrefillValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}

export interface FormRefExpansionContext {
  readonly parentRecord?: Readonly<Record<string, unknown>>
}

function expandFormRefComponent(
  component: Component,
  app: App,
  ctx: FormRefExpansionContext
): Component {
  const formRefInfo = asFormRefComponent(component)
  if (formRefInfo === undefined) return component
  const form = app.forms?.find((f) => f.name === formRefInfo.formRef)
  if (form === undefined) return component

  const resolvedPrefill = resolvePrefillMap(formRefInfo.inlinePrefill, ctx.parentRecord)
  const lockPrefill = formRefInfo.inlinePrefill?.lockPrefill === true

  const formBodyHtml = renderEmbeddedFormBody(app, form, {
    prefill: resolvedPrefill,
    lockPrefill,
  })
  return {
    type: 'customHTML',
    props: buildWrapperProps(formRefInfo.formRef, formRefInfo.originalProps),
    trustedContent: formBodyHtml,
  } as unknown as Component
}

export function expandFormRefs(
  components: Page['components'],
  app: App,
  ctx: FormRefExpansionContext = {}
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return expandFormRefComponent(item as Component, app, ctx)
  })
}
