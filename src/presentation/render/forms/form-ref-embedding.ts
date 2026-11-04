/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a formRef embedding draws and reads beside the form: the form the reader
 * may see, its markup (or, while its availability window is not open, its
 * closed notice), its starting values, its heading level and submit label, its
 * option sets, and control ids scoped so two embedded forms on one page never
 * share one.
 */

import { evaluateAvailabilityWindow } from '@/domain/models/app/forms/form-availability-flow'
import { renderNow } from '@/presentation/render/page/render-clock'
import { renderClosedFormNotice } from './form-closed-renderer'
import { composerWrapper } from './form-composer'
import { renderNativeSuccessPage } from './form-native-success'
import { applyNodeFormParts } from './form-part-classes'
import { embedHeaderOptions, formForEmbedHeader } from './form-ref-header'
import { formForReader } from './form-ref-readers'
import { renderEmbeddedFormBody, resolveFormStartingValues } from './form-renderer'
import {
  prefillColumnsOf,
  prefillUserOf,
  resolveRecordPrefillMap,
  type InlinePrefillShape,
  type PrefillValue,
} from './record-prefill-resolver'
import type { EmbeddedFormPrefillContext } from './form-body'
import type { FormPrefillContext } from './form-prefill-resolver'
import type { FormRefExpansionContext } from './form-ref-resolver'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Component } from '@/domain/models/app/pages/components'

/** Control ids in an embed's markup: its attributes, and an island's props (`"id":"…"`, `"describedBy":"…"`, escaped). */
const ID_REFERENCE =
  /\b(id|for|aria-labelledby|aria-describedby|describedBy)(="|&quot;:&quot;)([^"&]*)/g

/**
 * The embed's markup with every control id (`field-…`) — and every reference
 * to one — prefixed by `scope`, when the page embeds `formName` more than once.
 * The same markup back otherwise, so a form placed once keeps its plain ids.
 */
export function scopeControlIds(
  html: string,
  formName: string,
  ctx: FormRefExpansionContext
): string {
  if (ctx.repeatedForms?.has(formName) !== true) return html
  const scope = `embed-${ctx.scopePath ?? '0'}`
  return html.replace(ID_REFERENCE, (_m, attribute: string, sep: string, ids: string) => {
    const scoped = ids
      .split(' ')
      .map((token) => (token.startsWith('field-') ? `${scope}-${token}` : token))
      .join(' ')
    return `${attribute}${sep}${scoped}`
  })
}

/** The referenced form as this page's reader may see it, or `undefined` when undeclared. */
export function findFormForReader(
  name: string,
  app: App,
  ctx: FormRefExpansionContext
): Readonly<Form> | undefined {
  const form = app.forms?.find((f) => f.name === name)
  return form === undefined ? undefined : formForReader(form, app, ctx.formReaders?.[name])
}

/**
 * The embedded form's own starting values — its fields' `defaultValue`s under
 * its form-level `prefill` map — through the SAME merge and request facts the
 * standalone `/forms/:name` page starts from (`resolveFormStartingValues`): the
 * host page's query string, the signed-in viewer for `$user.*` (absent for an
 * anonymous visitor, so the entry drops as it does there), and the choices
 * read for it, where a lookup default finds its row. A form therefore starts
 * alike wherever it is shown; the host's inline prefill is resolved apart.
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
    ...optionSetsFor(form, ctx),
  }
  return resolveFormStartingValues(app, form, prefillCtx)
}

/**
 * Resolve the host's inline prefill (against this request) and how it applies over the form's own
 * starting values: it wins on the keys it names, and when locked only those ride in hidden inputs.
 */
export function resolveEmbedPrefill(
  app: App,
  form: Readonly<Form>,
  inlinePrefill: InlinePrefillShape | undefined,
  ctx: FormRefExpansionContext
): EmbeddedFormPrefillContext {
  const inline = resolveRecordPrefillMap(inlinePrefill, ctx.parentRecord, {
    session: ctx.session,
    query: ctx.query,
    columns: prefillColumnsOf(app.tables, form.submitTo.table),
  })
  return {
    prefill: { ...resolveFormLevelPrefill(app, form, ctx), ...inline },
    lockPrefill: inlinePrefill?.lockPrefill === true,
    lockedKeys: Object.keys(inlinePrefill?.prefill ?? {}),
  }
}

/**
 * Read the `props.headingLevel` render hint off a formRef component's `props`
 * bag. An embedded title is a section of its host page, so it is an `<h2>`
 * unless the author writes `'h1'` or `'h3'`; only a form on its own page is
 * headed by an `<h1>` by default. It is a pure render hint — deliberately NOT
 * surfaced on the wrapper `<div>` (see `buildWrapperProps`), so it never leaks
 * onto the DOM as an attribute.
 */
export function readHeadingLevel(
  originalProps: Record<string, unknown> | undefined
): 'h1' | 'h2' | 'h3' {
  const raw = originalProps?.['headingLevel']
  return raw === 'h1' || raw === 'h3' ? raw : 'h2'
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
 * The clone is local to this render: `app.forms[]` is never mutated, so the same
 * form embedded on another page (or served standalone at `/forms/:name`) keeps
 * its own label. A non-string or empty override is ignored — an override has to
 * say something to override.
 */
export function applySubmitLabelOverride(
  form: Readonly<Form>,
  originalProps: Record<string, unknown> | undefined
): Readonly<Form> {
  const raw = originalProps?.['label']
  if (typeof raw !== 'string' || raw.length === 0) return form
  return { ...form, display: { ...form.display, submitLabel: raw } }
}

/** The render option carrying `form`'s pre-read choices, when any were read. */
export function optionSetsFor(
  form: Readonly<Form>,
  ctx: FormRefExpansionContext
): { readonly optionSets?: FormOptionSets } {
  const optionSets = ctx.formOptions?.[form.name]
  return optionSets === undefined ? {} : { optionSets }
}

/**
 * The notice an embed draws INSTEAD of the form while the form's availability
 * window is not open — the same decision and the same words the standalone
 * `/forms/:name` page makes and shows, in the host page's language, read at the
 * render's instant. `undefined` while the window is open, so the form is drawn.
 */
export function closedNoticeFor(
  app: App,
  form: Readonly<Form>,
  ctx: FormRefExpansionContext,
  headingAs: 'h1' | 'h2' | 'h3'
): string | undefined {
  const windowState = evaluateAvailabilityWindow(form.availability, renderNow().getTime())
  if (windowState.kind === 'open') return undefined
  const request =
    windowState.kind === 'not-yet-open'
      ? { activeLang: ctx.activeLang, opensAt: windowState.opensAt }
      : { activeLang: ctx.activeLang }
  return renderClosedFormNotice(app, form, windowState.kind, { request, headingAs })
}

/**
 * The embedded form's markup. Defaults + `$query` prefill are EDITABLE starting
 * values; the inline prefill wins on the keys it names and, when locked, renders
 * them as hidden inputs. A post made without JavaScript comes back with its
 * success page in the form's place.
 */
export function drawEmbeddedForm(
  component: Component,
  app: App,
  embed: {
    readonly form: Readonly<Form>
    readonly originalProps: Record<string, unknown> | undefined
    readonly inlinePrefill: InlinePrefillShape | undefined
    readonly titleAs: 'h1' | 'h2' | 'h3'
  },
  ctx: FormRefExpansionContext
): string {
  const { form, originalProps, inlinePrefill, titleAs } = embed
  const formBodyHtml = scopeControlIds(
    renderNativeSuccessPage(app, form, { ...ctx, titleAs }) ??
      renderEmbeddedFormBody(
        app,
        formForEmbedHeader(applySubmitLabelOverride(form, originalProps), component),
        resolveEmbedPrefill(app, form, inlinePrefill, ctx),
        {
          activeLang: ctx.activeLang,
          titleAs,
          ...embedHeaderOptions(component),
          ...optionSetsFor(form, ctx),
        }
      ),
    form.name,
    ctx
  )
  const composed = composerWrapper(app, component, ctx.activeLang)
  return composed(applyNodeFormParts(formBodyHtml, app.design, component))
}
