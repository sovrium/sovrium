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

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { readEmbeddedFormRef } from '@/domain/models/app/pages/embedded-form-ref'
import {
  componentField,
  componentFields,
  entryAsComponent,
  rewriteComponent,
  synthesizedComponent,
} from '@/presentation/render/resolve/component-rewrite'
import { isComponentHiddenForSession } from '@/presentation/render/resolve/visibility-filter'
import { resolveDocumentLang, resolveText } from './form-field-resolver'
import {
  closedNoticeFor,
  drawEmbeddedForm,
  scopeControlIds,
  findFormForReader,
  resolveEmbedPrefill,
  readHeadingLevel,
  optionSetsFor,
} from './form-ref-embedding'
import { buildWrapperProps } from './form-ref-wrapper'
import { renderEmbeddedFormBody } from './form-renderer'
import { isInlinePrefill, type InlinePrefillShape } from './record-prefill-resolver'
import type { FormRefOptionSets } from './form-ref-option-sources'
import type { FormRefReaders } from './form-ref-readers'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Form } from '@/domain/models/app/forms'
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
 * Reads `formRef` off a component if it is a `{ type: 'form', formRef: <name> }`
 * node. Returns `undefined` for any other component type or for form
 * components that lack `formRef` (those still go through the inline form
 * rendering path). Cross-validation has already enforced that `formRef`,
 * when present, references an existing `forms[].name`.
 */
function asFormRefComponent(component: Component): FormRefComponent | undefined {
  if (component.type !== 'form') return undefined
  const ref = component.formRef
  if (typeof ref !== 'string') return undefined
  const inlinePrefillRaw: unknown = component.inlinePrefill
  return {
    formRef: ref,
    originalProps: component.props,
    inlinePrefill: isInlinePrefill(inlinePrefillRaw) ? inlinePrefillRaw : undefined,
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
   * [internal ref] / a forms spec: the host page's request query string. Threaded so an
   * embedded form's form-level `prefill: { field: '$query.<name>' }` resolves
   * against the host page URL, matching the standalone `/forms/:name` route.
   * When omitted, `$query.*` prefill entries drop out (field renders empty),
   * never leaking the literal token.
   */
  readonly query?: Readonly<Record<string, string>> | undefined
  /**
   * The table-backed choices of every embedded form, read before this
   * synchronous pass (`resolveFormRefOptionSets`), keyed by form name. A form
   * missing from it offers no table-backed choices.
   */
  readonly formOptions?: FormRefOptionSets | undefined
  /**
   * The table each embedded form writes to, as this reader may see it, read
   * before this synchronous pass (`resolveFormRefReaders`), keyed by form name.
   * A field on a column she may not read is left out of the drawn form.
   */
  readonly formReaders?: FormRefReaders | undefined
  /**
   * The forms this page embeds more than once (`repeatedFormNames`). Each embed
   * of one of them draws its controls under ids scoped to its place in the
   * page, so a label names its own embed's control and not the first one's.
   */
  readonly repeatedForms?: ReadonlySet<string> | undefined
  /** This node's place in the page, the scope its repeated embeds' ids take. */
  readonly scopePath?: string | undefined
}

/**
 * True when a component is a `formRef` embedding on any kind whose schema
 * declares `formRef` — the same predicate the page-access gate reads. Only these
 * nodes are candidates for the session-visibility skip below.
 */
function isFormRefEmbedding(component: Component): boolean {
  return readEmbeddedFormRef(component) !== undefined
}

/**
 * Expand a page-form component referencing a top-level form into an equivalent
 * `customHTML` component; the component unchanged when it is not a `formRef`
 * form or the form cannot be located (a defensive fallback: cross-validation
 * prevents it). A form whose availability window is not open draws its closed
 * notice in the form's place, as its own page does. `inlinePrefill` tokens
 * resolve against `ctx.parentRecord` (Y-5 inline-create flow).
 */
function expandFormRefComponent(
  component: Component,
  app: App,
  ctx: FormRefExpansionContext
): Component {
  const formRefInfo = asFormRefComponent(component)
  if (formRefInfo === undefined) return component
  const form = findFormForReader(formRefInfo.formRef, app, ctx)
  if (form === undefined) return component
  const titleAs = readHeadingLevel(formRefInfo.originalProps)
  const trustedContent =
    closedNoticeFor(app, form, ctx, titleAs) ??
    drawEmbeddedForm(component, app, { form, ...formRefInfo, titleAs }, ctx)
  // The embedded-form markup is server-generated, fully-trusted HTML drawn from
  // the validated `forms[]` schema. It rides `trustedContent` (NOT `content`) so
  // the `customHTML` renderer skips the rich-text sanitiser, which drops every
  // interactive element; it is synthesized AFTER schema decode, so no author
  // can supply it. `authoredType` keeps the element NAMED as the author wrote it; the node's
  // `classes` ride along (their `root` part styles the wrapper, the inner parts
  // are on the markup), and so does a page export's node id, stamped on it.
  const { classes, _exportNodeId } = componentFields(component)
  return synthesizedComponent({
    type: 'customHTML',
    props: buildWrapperProps(formRefInfo.formRef, formRefInfo.originalProps),
    trustedContent,
    authoredType: 'form',
    ...(classes === undefined ? {} : { classes }),
    ...(_exportNodeId === undefined ? {} : { _exportNodeId }),
  })
}

/**
 * Walk a component tree, expanding any `{ type: 'form', formRef: <name> }`
 * nodes into their pre-rendered `customHTML` equivalents at any depth
 * (`children` and `responsive.<breakpoint>.children`). Component
 * references (`{ component: ... }` / `{ $ref: ... }`) are passed through
 * unchanged — they are resolved later by the section renderer.
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
  return components.flatMap<NonNullable<Page['components']>[number]>((item, index) => {
    const here: FormRefExpansionContext = {
      ...ctx,
      scopePath: ctx.scopePath === undefined ? String(index) : `${ctx.scopePath}-${index}`,
    }
    // A child may be plain text (a bare string) — nothing to expand there.
    if (typeof item !== 'object' || item === null) return [item]
    if ('component' in item || '$ref' in item) return [item]
    const component = entryAsComponent(item)
    // A `formRef` embedding hidden from this session by a `when`/`roles`
    // visibility gate is NOT part of the page for that session — drop it
    // entirely rather than expanding its (role-gated) form markup into the
    // HTML. This mirrors `evaluateEmbeddedFormRefsAccess`, which already skips
    // session-hidden formRefs when deciding page access; the render path must
    // stay consistent with `applyVisibilityToComponents`, which excludes the
    // same node by the same rule.
    if (isFormRefEmbedding(component) && isComponentHiddenForSession(component, ctx.session, app)) {
      return []
    }
    const expanded = expandDialogFormRef(expandFormRefComponent(component, app, here), app, here)
    return [expandNestedFormRefs(expanded, app, here)]
  })
}

/**
 * Descend into a component's `children` and every `responsive.<breakpoint>.children`
 * so a `formRef` expands wherever it sits — a dialog in a page header, a form in a
 * dialog's body. Each level applies the same session-visibility skip as the top
 * level, and the tree walked is the one `evaluateEmbeddedFormRefsAccess` walks, so
 * no form the access gate did not see is ever expanded.
 */
function expandNestedFormRefs(
  component: Component,
  app: App,
  ctx: FormRefExpansionContext
): Component {
  const node = componentFields(component)
  const children = Array.isArray(node['children'])
    ? { children: expandFormRefs(node['children'] as Page['components'], app, ctx) }
    : {}
  const responsive = expandResponsiveChildren(componentField(component, 'responsive'), app, ctx)
  if (Object.keys(children).length === 0 && responsive === undefined) return component
  return rewriteComponent(component, {
    ...children,
    ...(responsive === undefined ? {} : { responsive }),
  })
}

/** `responsive` with each breakpoint's `children` expanded, or `undefined` when none carry any. */
function expandResponsiveChildren(
  responsive: unknown,
  app: App,
  ctx: FormRefExpansionContext
): Record<string, unknown> | undefined {
  if (typeof responsive !== 'object' || responsive === null) return undefined
  const entries = Object.entries(responsive as Record<string, unknown>)
  const hasChildren = entries.some(
    ([, value]) =>
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as { readonly children?: unknown }).children)
  )
  if (!hasChildren) return undefined
  return Object.fromEntries(
    entries.map(([breakpoint, value]) => {
      const override = value as { readonly children?: unknown } | null
      if (typeof override !== 'object' || override === null || !Array.isArray(override.children)) {
        return [breakpoint, value]
      }
      return [
        breakpoint,
        {
          ...override,
          children: expandFormRefs(override.children as Page['components'], app, ctx),
        },
      ]
    })
  )
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
  const ref = component.formRef
  if (typeof ref !== 'string') return component
  const form = findFormForReader(ref, app, ctx)
  if (form === undefined) return component

  // The form's own starting values underlay the inline prefill, which wins on
  // the keys it names and drives lock-prefill rendering for those keys.
  const titleAs = readHeadingLevel(component.props)

  // `props.label` is deliberately NOT forwarded on the dialog path. On a
  // `{ type: 'form', formRef }` component `props.label` is unambiguously the
  // submit button; on a dialog it reads as the
  // TRIGGER's label, so repurposing it for the modal's submit button would
  // silently relabel existing dialogs.
  const formBodyHtml = scopeControlIds(
    renderEmbeddedFormBody(app, form, resolveEmbedPrefill(app, form, undefined, ctx), {
      activeLang: ctx.activeLang,
      titleAs,
      omitTitle: true,
      // The dialog draws a Cancel beside the form's submit, in the page language.
      cancelLabel: resolveInterpreterString(
        'dialog.cancel',
        resolveDocumentLang(app.languages, ctx.activeLang),
        app.languages
      ),
      ...optionSetsFor(form, ctx),
    }),
    form.name,
    ctx
  )
  return rewriteComponent(component, {
    ...dialogTitleFromForm(component, form, app, ctx),
    _formRefHtml: formBodyHtml,
  })
}

/**
 * A dialog wrapping a form shows ONE title: its own, or — when it declares
 * none — the form's, as the dialog's heading. The form body is then rendered
 * without its title (`omitTitle`), so the two never stack. Returns the
 * `props` override to spread, or nothing when the dialog has its own title or
 * the form has none to lend.
 */
function dialogTitleFromForm(
  component: Component,
  form: Form,
  app: App,
  ctx: FormRefExpansionContext
): { readonly props?: Record<string, unknown> } {
  const props: Readonly<Record<string, unknown>> = component.props ?? {}
  if (typeof props['title'] === 'string' && props['title'] !== '') return {}
  if (form.title === undefined) return {}
  return { props: { ...props, title: resolveText(form.title, app.languages, '', ctx.activeLang) } }
}
