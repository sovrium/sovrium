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
  /**
   * The current request session, used to drop embedded `formRef`s that a
   * `when`/`roles` visibility gate hides from this session. When omitted, no
   * visibility-based skipping is applied (every formRef expands).
   */
  readonly session?: SessionInfo | undefined
  /**
   * P9: the host page's active language (the `/:lang/` URL prefix). Threaded
   * into `renderEmbeddedFormBody` so the embedded form resolves its `$t:`
   * title / submit label / onSuccess strings against the same locale as the
   * rest of the page. When omitted the embedded form resolves the default
   * locale (legacy behaviour).
   */
  readonly activeLang?: string | undefined
  /**
   * GAP-3 / [internal ref]: the host page's request query string. Threaded so an
   * embedded form's form-level `prefill: { field: '$query.<name>' }` resolves
   * against the host page URL, matching the standalone `/forms/:name` route.
   * When omitted, `$query.*` prefill entries drop out (field renders empty),
   * never leaking the literal token.
   */
  readonly query?: Readonly<Record<string, string>> | undefined
}

/**
 * Resolve a form's form-level `prefill` map (literal / `$query` / `$user`) into
 * concrete embedded initial values. Only `$query` is honoured on
 * the embedded path — `$user.*` is intentionally NOT resolved (it would require
 * the standalone route's auth-gate to avoid leaking session state, so it safely
 * drops to empty here). Returns an empty map when the form declares no prefill.
 */
function resolveFormLevelPrefill(
  form: Readonly<Form>,
  ctx: FormRefExpansionContext
): Readonly<Record<string, PrefillValue>> {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, PrefillValue>> }
  if (prefill === undefined) return {}
  const prefillCtx: FormPrefillContext = { query: ctx.query ?? {} }
  return resolveFormPrefill(prefill, prefillCtx)
}

/**
 * Read the opt-in `props.headingLevel` render hint off a formRef component's
 * `props` bag. Returns `'h1'` (the default) for anything other than an explicit
 * `'h2'`/`'h3'` so an existing embedded form keeps its `<h1 class="form-title">`
 * unless the author opts into demoting it. It is a pure
 * render hint — deliberately NOT surfaced on the wrapper `<div>` (see
 * `buildWrapperProps`), so it never leaks onto the DOM as an attribute.
 */
function readHeadingLevel(originalProps: Record<string, unknown> | undefined): 'h1' | 'h2' | 'h3' {
  const raw = originalProps?.['headingLevel']
  return raw === 'h2' || raw === 'h3' ? raw : 'h1'
}

/**
 * True when a component is a `formRef` embedding (`{ type: 'form' | 'dialog',
 * formRef: <name> }`). Only these nodes are expanded — and only these are
 * candidates for the session-visibility skip below.
 */
function isFormRefEmbedding(component: Component): boolean {
  if (component.type !== 'form' && component.type !== 'dialog') return false
  return typeof (component as { readonly formRef?: unknown }).formRef === 'string'
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

  // Form-level `$query` prefill provides EDITABLE initial values;
  // inline `$parent` prefill (Y-5) wins on key collisions and drives the
  // lock-prefill (hidden-input) rendering mode.
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
  // The embedded-form markup is server-generated, fully-trusted HTML — it
  // is produced by `renderEmbeddedFormBody` from the validated `forms[]`
  // schema, never from user input. It is emitted on the synthesized
  // component's `trustedContent` field (NOT `content`) so the `customHTML`
  // renderer skips the rich-text allowlist sanitiser. That sanitiser drops
  // every interactive element (`<form>`, `<input>`, `<button>`, `<select>`,
  // `<label>`) — running it here would strip the form to bare label text.
  // `trustedContent` is safe from injection: this component is synthesized
  // at render time, AFTER schema decode, so a schema author can never
  // supply the field (the decoded `customHTML` schema only exposes
  // `content` / `htmlSrc`).
  return {
    type: 'customHTML',
    props: buildWrapperProps(formRefInfo.formRef, formRefInfo.originalProps),
    trustedContent: formBodyHtml,
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
  return components.flatMap((item) => {
    if ('component' in item || '$ref' in item) return [item]
    const component = item as Component
    // A `formRef` embedding hidden from this session by a `when`/`roles`
    // visibility gate is NOT part of the page for that session — drop it
    // entirely rather than expanding its (role-gated) form markup into the
    // HTML. This mirrors `evaluateEmbeddedFormRefsAccess`, which already skips
    // session-hidden formRefs when deciding page access; the render path must
    // stay consistent (otherwise `applyVisibilityToComponents`' `display:none`
    // is silently dropped by `buildWrapperProps` and the form renders fully
    // visible to a role that must not see it).
    if (isFormRefEmbedding(component) && isComponentHiddenForSession(component, ctx.session)) {
      return []
    }
    return [expandDialogFormRef(expandFormRefComponent(component, app, ctx), app, ctx)]
  })
}

/**
 * Expand a `{ type: 'dialog', formRef: <name> }` component by resolving the
 * referenced top-level form into the dialog's modal-body HTML.
 *
 * Unlike `{ type: 'form', formRef }` (which is rewritten to `customHTML`), a
 * dialog stays a `dialog` component — the dialog island owns the modal /
 * focus-trap / Esc / backdrop behaviour. We only need to populate its body, so
 * the resolved form markup is stashed on a render-time-only `_formRefHtml`
 * field that the dialog SSR renderer serializes into the island's
 * `childrenHtml` prop. Like the form-component path, the markup is trusted
 * server-generated HTML produced from the validated `forms[]` schema.
 *
 * Returns the component unchanged when it is not a dialog with a string
 * `formRef`, or when the referenced form cannot be located (defensive — cross-
 * validation enforces the reference is valid).
 */
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
  // Form-level `$query` prefill underlays the inline `$parent`
  // prefill; the latter wins on collisions and drives lock-prefill rendering.
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
