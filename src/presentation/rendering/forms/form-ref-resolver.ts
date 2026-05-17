/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Expand `{ type: 'form', formRef: <name> }` page components into
 * pre-rendered `customHTML` equivalents containing the embedded form's
 * markup (title + `<form>` + fields + submit button).
 *
 * The expansion is performed at page-render time, after schema validation
 * has already enforced that `formRef` references an existing `forms[].name`
 * and that no inline `dataSource`/`fields`/`fieldGroups` conflict with the
 * reference (see `validatePageFormRefs` in `forms-validation.ts`).
 *
 * By rewriting the component to `customHTML`, the embedded form inherits
 * the host page's chrome (`<html>`, `<body>`, `<main>`, sidebar, headers)
 * and access semantics — there is no second SSR pass and no extra route.
 *
 * Display-only host overrides flow through to the wrapping `<div>`:
 *   - `props.variant` → `data-variant` and `embedded-form--<variant>` class
 *   - `props.className` / `props.id` / `props['data-testid']` pass through
 *
 * Other overrides (`responsive`, inline `fields`/`fieldGroups`/`dataSource`)
 * are intentionally dropped: they are either rejected by cross-validation
 * or have no meaning when the embedded form's structure comes from
 * `forms[]`. A future tier may surface a developer-time warning for them.
 */

import { renderEmbeddedFormBody } from './form-renderer'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Locator for a page-form component that references a top-level form.
 *
 * `formRef` is the kebab-case `forms[].name` value the page component wants
 * to embed; `originalProps` carries the host component's `props` (and only
 * its `props`) so `expandFormRefComponent` can preserve cosmetic overrides
 * such as `variant`/`className`/`data-testid` on the wrapping `<div>`.
 */
interface FormRefComponent {
  readonly formRef: string
  readonly originalProps: Record<string, unknown> | undefined
  readonly inlinePrefill: InlinePrefillShape | undefined
}

/**
 * Shape of the `inlinePrefill` block (kept loose so the resolver does not
 * import the schema types and accepts both decoded and raw inputs).
 */
interface InlinePrefillShape {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill?: boolean
}

type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * Reads `formRef` off a component if it is a `{ type: 'form', formRef: <name> }`
 * node. Returns `undefined` for any other component type or for form
 * components that lack `formRef` (those still go through the inline form
 * rendering path). Cross-validation has already enforced that `formRef`,
 * when present, references an existing `forms[].name`.
 */
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

/**
 * Type guard for `inlinePrefill` to keep the resolver tolerant of both
 * decoded schemas and bare-object inputs (the test fixtures use `as never`
 * to bypass typing). Validates only the structural minimum: `prefill` is a
 * non-null object. Per-key value validation happens at substitution time.
 */
function isInlinePrefill(value: unknown): value is InlinePrefillShape {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { readonly prefill?: unknown }
  return typeof candidate.prefill === 'object' && candidate.prefill !== null
}

/**
 * Compose the wrapper `<div>`'s `className` from the host component's
 * `props.className` and an optional `embedded-form--<variant>` token.
 *
 * The base `embedded-form` class is always present so application stylesheets
 * can target the wrapper unconditionally; the per-variant suffix lets authors
 * style `props.variant: 'compact'` differently from `props.variant: 'wide'`.
 */
function composeWrapperClass(variant: unknown, className: unknown): string {
  const base = 'embedded-form'
  const variantClass = typeof variant === 'string' ? `embedded-form--${variant}` : undefined
  const passthrough = typeof className === 'string' && className.length > 0 ? className : undefined
  return [base, variantClass, passthrough]
    .filter((token): token is string => typeof token === 'string' && token.length > 0)
    .join(' ')
}

/**
 * Build the synthesized prop bag for the `customHTML` wrapper. Carries
 * pass-through cosmetic attributes (`id`, `data-testid`) and synthesised
 * data hooks (`data-form-ref`, optional `data-variant`).
 *
 * Returned as `Record<string, unknown>` and cast at the call site because
 * the `customHTML` schema does not declare `data-*` attributes — they pass
 * through React's `<div {...props}>` at render time without schema noise.
 */
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

/**
 * Resolve a single prefill value against the host page's `$parent` record.
 *
 * - String tokens of the form `'$parent.<segment>'` look up the segment on
 *   the parent record. Missing segments resolve to `undefined` so the
 *   caller can decide whether to skip or render an empty input.
 * - Any other literal (string without `$parent.` prefix, number, boolean,
 *   array) passes through unchanged — useful for static defaults
 *   (`status: 'open'`) sitting alongside parent-derived values.
 *
 * Kept synchronous and pure: the parent record is supplied by the caller
 * (resolved upstream by `resolvePageDataSources`) so this helper has no
 * I/O concerns.
 */
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
    // Multi-relationship arrays come back as Postgres TEXT[] (string[]).
    // Coerce to readonly to match the PrefillValue contract.
    return resolved.filter((item): item is string => typeof item === 'string')
  }
  if (typeof resolved === 'number' || typeof resolved === 'boolean') return resolved
  return String(resolved)
}

/**
 * Resolve every prefill entry on a form component against the host record.
 *
 * Returns an empty map when `inlinePrefill` is missing, when the host page
 * has no parent record (e.g. a list-mode dataSource), or when every value
 * resolved to `undefined`. Filtering empties here keeps the renderer's
 * substitution loop simple.
 */
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

/**
 * Optional context threaded through `expandFormRefs` so `inlinePrefill`
 * tokens can resolve against the host page's `$parent` record.
 *
 * `parentRecord` mirrors the shape produced by `resolvePageDataSources`
 * for `mode: 'single'` data sources (a flat record map). When undefined,
 * `$parent.<field>` tokens drop out of the prefill map and the rendered
 * form falls back to its declarative defaults.
 */
export interface FormRefExpansionContext {
  readonly parentRecord?: Readonly<Record<string, unknown>>
}

/**
 * Expand a single page-form component that references a top-level form into
 * an equivalent `customHTML` component. Returns the original component
 * unchanged if the component is not a `formRef` form OR if the referenced
 * form cannot be located (cross-validation should prevent this; it is a
 * defensive fallback to avoid runtime crashes in malformed schemas that
 * bypassed validation).
 *
 * When `inlinePrefill` is present and `ctx.parentRecord` is supplied,
 * `$parent.<field>` tokens resolve against the host page's record so
 * relationship columns auto-fill (Y-5 inline-create flow). `lockPrefill`
 * routes the resolved values into hidden `<input type="hidden">` markup
 * so the submitter cannot edit them.
 */
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
    content: formBodyHtml,
  } as unknown as Component
}

/**
 * Walk a component list, expanding any `{ type: 'form', formRef: <name> }`
 * nodes into their pre-rendered `customHTML` equivalents. Component
 * references (`{ component: ... }` / `{ $ref: ... }`) are passed through
 * unchanged — they are resolved later by the section renderer and
 * `formRef` shorthand only appears on direct components today.
 *
 * `ctx.parentRecord`, when supplied, is forwarded to the per-component
 * expander so `inlinePrefill` tokens can resolve against the host page's
 * `dataSource: { mode: 'single' }` record.
 */
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
