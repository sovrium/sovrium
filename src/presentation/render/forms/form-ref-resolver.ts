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
import { isComponentHiddenForSession } from '@/presentation/render/resolve/visibility-filter'
import { resolveDocumentLang, resolveText } from './form-field-resolver'
import { applyNodeFormParts } from './form-part-classes'
import { type FormPrefillContext } from './form-prefill-resolver'
import { embedHeaderOptions, formForEmbedHeader } from './form-ref-header'
import { formForReader, type FormRefReaders } from './form-ref-readers'
import { buildWrapperProps } from './form-ref-wrapper'
import { renderEmbeddedFormBody, resolveFormStartingValues } from './form-renderer'
import {
  isInlinePrefill,
  prefillColumnsOf,
  prefillUserOf,
  resolveRecordPrefillMap,
  type InlinePrefillShape,
  type PrefillValue,
} from './record-prefill-resolver'
import type { EmbeddedFormPrefillContext } from './form-body'
import type { FormRefOptionSets } from './form-ref-option-sources'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
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

/** The attributes that hold control ids, or lists of them, in an embed's markup. */
const ID_REFERENCE_ATTRIBUTE = /\b(id|for|aria-labelledby|aria-describedby)="([^"]*)"/g

/**
 * The embed's markup with every control id (`field-…`) — and every reference
 * to one — prefixed by `scope`, when the page embeds `formName` more than once.
 * The same markup back otherwise, so a form placed once keeps its plain ids.
 */
function scopeControlIds(html: string, formName: string, ctx: FormRefExpansionContext): string {
  if (ctx.repeatedForms?.has(formName) !== true) return html
  const scope = `embed-${ctx.scopePath ?? '0'}`
  return html.replace(ID_REFERENCE_ATTRIBUTE, (_match, attribute: string, value: string) => {
    const scoped = value
      .split(' ')
      .map((token) => (token.startsWith('field-') ? `${scope}-${token}` : token))
      .join(' ')
    return `${attribute}="${scoped}"`
  })
}

/** The referenced form as this page's reader may see it, or `undefined` when undeclared. */
function findFormForReader(
  name: string,
  app: App,
  ctx: FormRefExpansionContext
): Readonly<Form> | undefined {
  const form = app.forms?.find((f) => f.name === name)
  return form === undefined ? undefined : formForReader(form, app, ctx.formReaders?.[name])
}

/**
 * The embedded form's own starting values — its fields' `defaultValue`s under
 * its form-level `prefill` map — resolved through the SAME merge
 * and the SAME request facts the standalone `/forms/:name` page starts from
 * (`resolveFormStartingValues`): the host page's query string, and the signed-in
 * viewer for `$user.*` (absent for an anonymous visitor, so the entry drops
 * exactly as it does on the standalone page). A form therefore starts alike
 * wherever it is shown. The host's inline prefill, which the page author writes
 * for this page, is resolved separately and wins on the keys it names.
 */
function resolveFormLevelPrefill(
  app: App,
  form: Readonly<Form>,
  ctx: FormRefExpansionContext
): Readonly<Record<string, PrefillValue>> {
  const user = prefillUserOf(ctx.session)
  const prefillCtx: FormPrefillContext = {
    query: ctx.query ?? {},
    ...(user === undefined ? {} : { user }),
  }
  return resolveFormStartingValues(app, form, prefillCtx)
}

/**
 * Resolve the host's inline prefill for an embedded form, and describe how it
 * applies over the form's own starting values: it wins on the keys it names,
 * and — when locked — only those keys ride in hidden inputs.
 */
function resolveEmbedPrefill(
  app: App,
  form: Readonly<Form>,
  inlinePrefill: InlinePrefillShape | undefined,
  ctx: FormRefExpansionContext
): EmbeddedFormPrefillContext {
  const inline = resolveRecordPrefillMap(inlinePrefill, ctx.parentRecord, {
    session: ctx.session,
    columns: prefillColumnsOf(app.tables, form.submitTo.table),
  })
  return {
    prefill: { ...resolveFormLevelPrefill(app, form, ctx), ...inline },
    lockPrefill: inlinePrefill?.lockPrefill === true,
    lockedKeys: Object.keys(inlinePrefill?.prefill ?? {}),
  }
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
 * Apply the host component's `props.label` submit-button override to the form
 * being embedded.
 *
 * `label` is one of the four display-layer overrides the criterion names as
 * honored, alongside `props.variant`, `responsive` and `visibility`. It was the
 * only one of the four with no reader: `buildWrapperProps` surfaces `variant`
 * (and `className`/`id`/`data-testid`) onto the wrapper `<div>`, and
 * `readHeadingLevel` above reads `headingLevel`, but nothing consulted `label`.
 * The published example in `as-developer/pages/data-components/data-form.md`
 * (`props: { label: Subscribe }`) was therefore inert config — accepted by the
 * schema, documented as honored, and silently discarded at render time.
 *
 * Expressed as a shallow clone whose `display.submitLabel` carries the override,
 * rather than as a new render-time parameter threaded through `FormBody`.
 * `display.submitLabel` IS the submit-button label, so the override is the same
 * kind of thing as the value it replaces, and it then flows through the one
 * `resolveText(form.display?.submitLabel, …)` call `buildFormBodyShared` already
 * makes — which means a `$t:` token in the override localizes to the host page's
 * active language for free, with no second resolution path to keep in step.
 *
 * The clone is local to this render: `app.forms[]` is never mutated, so the same
 * form embedded on another page (or served standalone at `/forms/:name`) keeps
 * its own label. A non-string or empty override is ignored — an override has to
 * say something to override.
 */
function applySubmitLabelOverride(
  form: Readonly<Form>,
  originalProps: Record<string, unknown> | undefined
): Readonly<Form> {
  const raw = originalProps?.['label']
  if (typeof raw !== 'string' || raw.length === 0) return form
  return { ...form, display: { ...form.display, submitLabel: raw } }
}

/** The render option carrying `form`'s pre-read choices, when any were read. */
function optionSetsFor(
  form: Readonly<Form>,
  ctx: FormRefExpansionContext
): { readonly optionSets?: FormOptionSets } {
  const optionSets = ctx.formOptions?.[form.name]
  return optionSets === undefined ? {} : { optionSets }
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
  const form = findFormForReader(formRefInfo.formRef, app, ctx)
  if (form === undefined) return component

  // Defaults + `$query` prefill are EDITABLE starting values; the inline prefill
  // wins on the keys it names and, when locked, renders them as hidden inputs.
  const titleAs = readHeadingLevel(formRefInfo.originalProps)

  const formBodyHtml = scopeControlIds(
    renderEmbeddedFormBody(
      app,
      formForEmbedHeader(applySubmitLabelOverride(form, formRefInfo.originalProps), component),
      resolveEmbedPrefill(app, form, formRefInfo.inlinePrefill, ctx),
      ctx.activeLang,
      { titleAs, ...embedHeaderOptions(component), ...optionSetsFor(form, ctx) }
    ),
    form.name,
    ctx
  )
  // The embedded-form markup is server-generated, fully-trusted HTML, drawn by
  // `renderEmbeddedFormBody` from the validated `forms[]` schema, never from
  // user input. It rides `trustedContent` (NOT `content`) so the `customHTML`
  // renderer skips the rich-text allowlist sanitiser, which drops every
  // interactive element (`<form>`, `<input>`, `<button>`, `<select>`, `<label>`).
  // `trustedContent` is safe from injection: this component is synthesized at
  // render time, AFTER schema decode, so a schema author can never supply it.
  //
  // `authoredType` keeps the element NAMED as the author wrote it, and the
  // node's `classes` ride along: their `root` part styles the wrapper, and the
  // inner parts are already written onto the markup.
  const { classes } = component as { readonly classes?: unknown }
  return {
    type: 'customHTML',
    props: buildWrapperProps(formRefInfo.formRef, formRefInfo.originalProps),
    trustedContent: applyNodeFormParts(formBodyHtml, app.design, component),
    authoredType: 'form',
    ...(classes === undefined ? {} : { classes }),
  } as Component
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
  return components.flatMap((item, index) => {
    const here: FormRefExpansionContext = {
      ...ctx,
      scopePath: ctx.scopePath === undefined ? String(index) : `${ctx.scopePath}-${index}`,
    }
    // A child may be plain text (a bare string) — nothing to expand there.
    if (typeof item !== 'object' || item === null) return [item]
    if ('component' in item || '$ref' in item) return [item]
    const component = item as Component
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
  const node = component as {
    readonly children?: unknown
    readonly responsive?: unknown
  }
  const children = Array.isArray(node.children)
    ? { children: expandFormRefs(node.children as Page['components'], app, ctx) }
    : {}
  const responsive = expandResponsiveChildren(node.responsive, app, ctx)
  if (Object.keys(children).length === 0 && responsive === undefined) return component
  return {
    ...(component as Record<string, unknown>),
    ...children,
    ...(responsive === undefined ? {} : { responsive }),
  } as Component
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
  const ref = (component as { readonly formRef?: unknown }).formRef
  if (typeof ref !== 'string') return component
  const form = findFormForReader(ref, app, ctx)
  if (form === undefined) return component

  const inlinePrefillRaw = (component as { readonly inlinePrefill?: unknown }).inlinePrefill
  const inlinePrefill = isInlinePrefill(inlinePrefillRaw) ? inlinePrefillRaw : undefined
  // The form's own starting values underlay the inline prefill, which wins on
  // the keys it names and drives lock-prefill rendering for those keys.
  const titleAs = readHeadingLevel(component.props)

  // `props.label` is deliberately NOT forwarded on the dialog path. On a
  // `{ type: 'form', formRef }` component `props.label` is unambiguously the
  // submit button; on a dialog it reads as the
  // TRIGGER's label, so repurposing it for the modal's submit button would
  // silently relabel existing dialogs.
  const formBodyHtml = scopeControlIds(
    renderEmbeddedFormBody(
      app,
      form,
      resolveEmbedPrefill(app, form, inlinePrefill, ctx),
      ctx.activeLang,
      {
        titleAs,
        omitTitle: true,
        // The dialog draws a Cancel beside the form's submit, in the page language.
        cancelLabel: resolveInterpreterString(
          'dialog.cancel',
          resolveDocumentLang(app.languages, ctx.activeLang),
          app.languages
        ),
        ...optionSetsFor(form, ctx),
      }
    ),
    form.name,
    ctx
  )
  return {
    ...(component as Record<string, unknown>),
    ...dialogTitleFromForm(component, form, app, ctx),
    _formRefHtml: formBodyHtml,
  } as Component
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
  const props = (component.props ?? {}) as Record<string, unknown>
  if (typeof props['title'] === 'string' && props['title'] !== '') return {}
  if (form.title === undefined) return {}
  return { props: { ...props, title: resolveText(form.title, app.languages, '', ctx.activeLang) } }
}
