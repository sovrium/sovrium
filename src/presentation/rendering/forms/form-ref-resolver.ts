/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isComponentHiddenForSession } from '@/presentation/rendering/visibility-filter'
import { resolveFormPrefill, type FormPrefillContext } from './form-prefill-resolver'
import { renderEmbeddedFormBody } from './form-renderer'
import {
  isInlinePrefill,
  resolveRecordPrefillMap,
  type InlinePrefillShape,
  type PrefillValue,
} from './record-prefill-resolver'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SessionInfo } from '@/domain/types/session-info'

interface FormRefComponent {
  readonly formRef: string
  readonly originalProps: Record<string, unknown> | undefined
  readonly inlinePrefill: InlinePrefillShape | undefined
}

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

export interface FormRefExpansionContext {
  readonly parentRecord?: Readonly<Record<string, unknown>>
  readonly session?: SessionInfo | undefined
  readonly activeLang?: string | undefined
  readonly query?: Readonly<Record<string, string>> | undefined
}

function resolveFormLevelPrefill(
  form: Readonly<Form>,
  ctx: FormRefExpansionContext
): Readonly<Record<string, PrefillValue>> {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, PrefillValue>> }
  if (prefill === undefined) return {}
  const prefillCtx: FormPrefillContext = { query: ctx.query ?? {} }
  return resolveFormPrefill(prefill, prefillCtx)
}

function readHeadingLevel(originalProps: Record<string, unknown> | undefined): 'h1' | 'h2' | 'h3' {
  const raw = originalProps?.['headingLevel']
  return raw === 'h2' || raw === 'h3' ? raw : 'h1'
}

function isFormRefEmbedding(component: Component): boolean {
  if (component.type !== 'form' && component.type !== 'dialog') return false
  return typeof (component as { readonly formRef?: unknown }).formRef === 'string'
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

  const resolvedPrefill = {
    ...resolveFormLevelPrefill(form, ctx),
    ...resolveRecordPrefillMap(formRefInfo.inlinePrefill, ctx.parentRecord),
  }
  const lockPrefill = formRefInfo.inlinePrefill?.lockPrefill === true
  const titleAs = readHeadingLevel(formRefInfo.originalProps)

  const formBodyHtml = renderEmbeddedFormBody(
    app,
    form,
    { prefill: resolvedPrefill, lockPrefill },
    ctx.activeLang,
    { titleAs }
  )
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
  return components.flatMap((item) => {
    if ('component' in item || '$ref' in item) return [item]
    const component = item as Component
    if (isFormRefEmbedding(component) && isComponentHiddenForSession(component, ctx.session)) {
      return []
    }
    return [expandDialogFormRef(expandFormRefComponent(component, app, ctx), app, ctx)]
  })
}

function expandDialogFormRef(
  component: Component,
  app: App,
  ctx: FormRefExpansionContext
): Component {
  if (component.type !== 'dialog') return component
  const ref = (component as { readonly formRef?: unknown }).formRef
  if (typeof ref !== 'string') return component
  const form = app.forms?.find((f) => f.name === ref)
  if (form === undefined) return component

  const inlinePrefillRaw = (component as { readonly inlinePrefill?: unknown }).inlinePrefill
  const inlinePrefill = isInlinePrefill(inlinePrefillRaw) ? inlinePrefillRaw : undefined
  const resolvedPrefill = {
    ...resolveFormLevelPrefill(form, ctx),
    ...resolveRecordPrefillMap(inlinePrefill, ctx.parentRecord),
  }
  const lockPrefill = inlinePrefill?.lockPrefill === true
  const titleAs = readHeadingLevel(component.props)

  const formBodyHtml = renderEmbeddedFormBody(
    app,
    form,
    { prefill: resolvedPrefill, lockPrefill },
    ctx.activeLang,
    { titleAs }
  )
  return { ...(component as Record<string, unknown>), _formRefHtml: formBodyHtml } as Component
}
