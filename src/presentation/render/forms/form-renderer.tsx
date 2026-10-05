/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- FormHead and
   FormPage are SSR-only React components co-located with the
   `renderFormPage` / `renderEmbedFormPage` / `renderEmbeddedFormBody`
   serialisation helpers that compose them. They never participate in
   client-side HMR, so splitting them across files would only add
   indirection without an HMR benefit. Mirrors the same pattern in
   `./form-field-elements.tsx` and `crud-form-fields.tsx`. */

/**
 * Per-field SSR rendering and the prefill / locked-prefill variants now
 * live in `./form-field-elements.tsx`; this file owns the form-document
 * orchestration (FormHead / FormBody / FormPage / renderEmbeddedFormBody)
 * and the field-resolution pipeline.
 */

import { type CSSProperties } from 'react'
import { renderToString } from 'react-dom/server'
import { markdownToText } from '@/domain/kernel/markdown/markdown-to-text'
import { findDeclaredDirection } from '@/domain/models/app/languages/language-detection'
import { getVersionedCssPath } from '@/infrastructure/css/versioned-css-path'
import { resolveBadge } from '@/presentation/render/page/badge-placement'
import { DemoNotice } from '@/presentation/render/page/demo-notice'
import { SovriumBadge } from '@/presentation/render/page/sovrium-badge'
import { FormBody } from './form-body'
import { type PrefillValue } from './form-field-elements'
import {
  resolveAllFields,
  resolveDocumentLang,
  resolveFormDensityStep,
  resolveText,
  stepDescriptionsHtml,
  stepItems,
} from './form-field-resolver'
import { resolveFormPrefill, type FormPrefillContext } from './form-prefill-resolver'
import { FormBodyStep } from './form-renderer-multi-step'
import { prefillColumnsOf } from './record-prefill-resolver'
import type { EmbeddedFormPrefillContext } from './form-body'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'

/**
 * Pure HTML head fragment — title and description are resolved upstream
 * so this stays a focused renderer.
 */
const FormHead = ({
  title,
  description,
  cssHref,
}: {
  readonly title: string
  readonly description: string
  readonly cssHref?: string
}) => (
  <head>
    <meta charSet="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>{title}</title>
    <meta
      name="description"
      content={description || title}
    />
    {/* [internal ref]: link the globally-compiled theme stylesheet (also
        serves the standalone form page so the embed shell inherits the
        same theme tokens — including CSS variables like --color-primary
        and --color-text — without a separate per-form bundle). */}
    <link
      rel="stylesheet"
      href={cssHref ?? '/assets/output.css'}
    />
  </head>
)

/**
 * Build the per-form theme style overlay from `display.theme`. Each token
 * maps onto a scoped CSS custom property on the form's `<main>` element so
 * the override applies to THIS form only (a sibling form without the block
 * inherits the app theme). Returns `undefined` when no theme is declared so
 * React omits the `style` attribute entirely.
 */
function formThemeStyle(form: Readonly<Form>): CSSProperties | undefined {
  const theme = form.display?.theme
  if (!theme) return undefined
  const primary = theme.primaryColor ? { '--color-primary': theme.primaryColor } : {}
  const background = theme.backgroundColor ? { '--color-background': theme.backgroundColor } : {}
  const radius = theme.borderRadius ? { '--radius': theme.borderRadius } : {}
  const style = { ...primary, ...background, ...radius }
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined
}

/**
 * Platform chrome of a STANDALONE form page: the "Built with Sovrium" badge and
 * the demo context notice. Standalone form pages are the badge's
 * highest-distribution surface, and `placement: footer` matters most here — a
 * floating pill sits over a long form's submit button. The embed variant
 * renders none of it: a fixed pill or panel inside a small third-party iframe
 * would cover form fields, and the host page carries its own.
 */
function FormPageChrome({
  app,
  lang,
}: {
  readonly app: App
  readonly lang?: string
}): React.JSX.Element {
  const badgePlacement = resolveBadge(app.badge)
  return (
    <>
      {badgePlacement !== undefined && (
        <SovriumBadge
          lang={lang}
          placement={badgePlacement}
        />
      )}
      <DemoNotice lang={lang} />
    </>
  )
}

/**
 * Standalone form page React component. Renders a complete HTML document
 * for SSR — the form posts to `/api/forms/{name}/submissions` via the
 * native `<form action>` attribute and a regular `submit` button.
 */
function FormPage({
  app,
  form,
  embed = false,
  activeLang,
  prefill,
  optionSets,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  readonly activeLang?: string
  readonly prefill?: Readonly<Record<string, PrefillValue>>
  readonly optionSets?: FormOptionSets
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name, activeLang)
  const documentLang = resolveDocumentLang(languages, activeLang)
  // The document's direction follows its language, exactly as a page's does:
  // without `dir` an Arabic form lays its labels and inputs out left to right.
  const direction = findDeclaredDirection(languages, documentLang)
  // Standalone prefill (literal / $query / $user) renders as editable
  // initial values, so it routes through the prefill context with
  // `lockPrefill: false`. An empty map is treated as "no prefill".
  const prefillContext =
    prefill && Object.keys(prefill).length > 0 ? { prefill, lockPrefill: false } : undefined
  const themeStyle = formThemeStyle(form)

  return (
    <html
      lang={documentLang}
      dir={direction}
      data-density={resolveFormDensityStep(app, form)}
    >
      <FormHead
        title={title}
        // The description renders as inline markdown on the page; a search result
        // or a link preview shows the meta verbatim, so it keeps the words only.
        description={markdownToText(resolveText(form.description, languages, '', activeLang))}
        cssHref={getVersionedCssPath(app)}
      />
      <body>
        <main
          className="form-page"
          data-form-name={form.name}
          {...(themeStyle ? { style: themeStyle } : {})}
        >
          <FormBody
            app={app}
            form={form}
            embed={embed}
            activeLang={activeLang}
            prefillContext={prefillContext}
            {...(optionSets !== undefined ? { optionSets } : {})}
          />
        </main>
        {!embed && (
          <FormPageChrome
            app={app}
            lang={activeLang}
          />
        )}
      </body>
    </html>
  )
}

/**
 * Resolve `forms[].prefill` (literal / $query / $user) against the request
 * context. Returns undefined when no context was supplied (legacy callers).
 *
 * Per-field `defaultValue` (declared inline on `forms[].fields[]`) is also
 * merged into the prefill map: it's resolved against the same context (so
 * `$user.email` / `$query.utm` work on individual fields too) and `prefill`
 * entries declared at the form level take precedence over per-field
 * defaults when both target the same field name.
 */
function resolveStandalonePrefill(
  app: Readonly<App>,
  form: Readonly<Form>,
  prefillCtx: FormPrefillContext | undefined
): Readonly<Record<string, PrefillValue>> | undefined {
  if (!prefillCtx) return undefined
  return resolveFormStartingValues(app, form, prefillCtx)
}

/**
 * A form's own starting values: every field's `defaultValue`, overlaid by the
 * form's `prefill` map, resolved against `prefillCtx`. The ONE merge both a
 * standalone form page and a form embedded in a page (`form-ref-resolver.ts`)
 * start from, so the same form never starts differently in two places.
 *
 * Defaults are keyed by the field's submit name (`column` for table-bound
 * fields, `name` for standalone); a form-level `prefill` entry wins over a
 * field's default on the same key.
 */
export function resolveFormStartingValues(
  app: Readonly<App>,
  form: Readonly<Form>,
  prefillCtx: FormPrefillContext
): Readonly<Record<string, PrefillValue>> {
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, PrefillValue>> }
  const fieldDefaults = Object.fromEntries(
    form.fields.flatMap((field) => {
      const f = field as {
        readonly defaultValue?: PrefillValue
        readonly name?: string
        readonly column?: string
      }
      if (f.defaultValue === undefined) return []
      const key = f.column ?? f.name
      if (key === undefined) return []
      return [[key, f.defaultValue] as const]
    })
  )
  const columns = prefillColumnsOf(app.tables, form.submitTo.table)
  return resolveFormPrefill({ ...fieldDefaults, ...(prefill ?? {}) }, { ...prefillCtx, columns })
}

/**
 * Render a complete HTML document for the given form, prefixed with a
 * `<!DOCTYPE html>` declaration so it can be sent verbatim from a Hono
 * handler. `embed` selects the embed body variant (`share.embeddable`
 * enforcement lives in a downstream tier).
 */
function renderFormDocument(opts: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly embed: boolean
  readonly activeLang: string | undefined
  readonly prefillCtx: FormPrefillContext | undefined
}): string {
  const { app, form, embed, activeLang, prefillCtx } = opts
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
      embed={embed}
      activeLang={activeLang}
      prefill={resolveStandalonePrefill(app, form, prefillCtx)}
      {...(prefillCtx?.optionSets !== undefined ? { optionSets: prefillCtx.optionSets } : {})}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}

export function renderFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  prefillCtx?: FormPrefillContext
): string {
  return renderFormDocument({ app, form, embed: false, activeLang, prefillCtx })
}

export function renderEmbedFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  prefillCtx?: FormPrefillContext
): string {
  return renderFormDocument({ app, form, embed: true, activeLang, prefillCtx })
}

/**
 * Render a single step's HTML fragment for a multi-step form.
 *
 * Returns the HTML for a `<div class="form-step">` block containing the
 * step's title/description, its declared fields (with values from the
 * per-session draft prefilled), and Previous/Next/Submit buttons sized
 * to the step's position in the visible-step sequence.
 *
 * Consumed by:
 *   - `GET /api/forms/:name/steps/:stepId` — server-mediated navigation
 *     between steps (Previous button, deep-link back to a step).
 *   - The advance endpoint when it streams the next step's HTML to the
 *     runtime as part of the Next-button response (richer flow; for the
 *     foundation we only return `{ nextStepId }` JSON).
 *
 * `draftValues` is keyed by the field's submitter-facing identifier
 * (`column` for table-bound, `name` for standalone). Values flow into
 * the per-field `prefillValue` slot so each input gets a `value=...`
 * attribute on the SSR render.
 *
 * Returns the empty string when the form is not multi-step or the step
 * id is not registered.
 */
export interface StepFragmentState {
  /** The per-session draft, keyed by each field's submit identifier. */
  readonly draftValues: Readonly<Record<string, unknown>>
  /** The choices read from tables for this request, as the full page carries them. */
  readonly optionSets?: FormOptionSets
}

export function renderFormStepFragment(
  app: Readonly<App>,
  form: Readonly<Form>,
  stepId: string,
  { draftValues, optionSets = {} }: StepFragmentState
): string {
  const steps = form.steps ?? []
  if (steps.length === 0) return ''
  const stepIndex = steps.findIndex((s) => s.id === stepId)
  if (stepIndex < 0) return ''
  const step = steps[stepIndex]!
  // Evaluated against the draft, so a condition on an earlier step's answer
  // is already applied to this step as served.
  const resolvedFields = resolveAllFields(app as App, form as Form, undefined, {
    conditionValues: draftValues,
    optionSets,
  })
  const prefillMap = Object.fromEntries(
    Object.entries(draftValues).map(([key, value]) => [key, value as PrefillValue])
  ) as Readonly<Record<string, PrefillValue>>
  const totalVisible = steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalVisible - 1
  return renderToString(
    <FormBodyStep
      step={step}
      stepIndex={stepIndex}
      isFirst={isFirst}
      isLast={isLast}
      stepFields={stepItems(resolvedFields, step.fields)}
      prefillMap={prefillMap}
      lockPrefill={false}
      descriptionHtml={stepDescriptionsHtml([step], app.languages, undefined)[step.id] ?? ''}
    />
  )
}

/**
 * Render JUST the form body (title + form + fields + submit button) as an
 * HTML string, with no surrounding `<html>`/`<body>`/`<main>` wrappers.
 *
 * Used by the page renderer to expand `formRef` page-form components into
 * inline content that can be embedded inside any host page. The host page
 * supplies its own document chrome, layout, and access semantics — this
 * helper just produces the form markup.
 *
 * `prefillContext`, when supplied, applies inline-prefill values resolved
 * from the host page's `dataSource: { mode: 'single' }` record. With
 * `lockPrefill: false` (default) the values become initial input values;
 * with `lockPrefill: true` the prefilled fields render as hidden inputs
 * and the form gets a `data-inline-prefill="locked"` marker so the
 * submission handler can revalidate the parent on POST.
 */
// eslint-disable-next-line max-params -- P9/P8 thread the host page's activeLang + titleAs render hint alongside the existing (app, form, prefillContext) embed API
export function renderEmbeddedFormBody(
  app: Readonly<App>,
  form: Readonly<Form>,
  prefillContext?: EmbeddedFormPrefillContext,
  activeLang?: string,
  opts?: {
    readonly titleAs?: 'h1' | 'h2' | 'h3'
    readonly optionSets?: FormOptionSets
    /** Draw no form title — the host (a dialog) heads the form itself. */
    readonly omitTitle?: boolean
    /** A Cancel beside the submit, already translated — the host is a dialog. */
    readonly cancelLabel?: string
  }
): string {
  // `embed={false}` so the embedded form gets standalone-like attributes (no
  // `data-embed`) and `mountRuntime` so the inline client runtime is emitted —
  // it intercepts the submit and honors `onSuccess.redirect` instead of the
  // native 303-to-Referer (GAP-H3 / [internal ref]). Exactly one embedded form
  // runs per host page, so the runtime's single-form lookup never collides.
  //
  // `activeLang` (P9) localizes the embedded form's `$t:` strings to the host
  // page's locale; `opts.titleAs` (P8) optionally demotes the form-title
  // heading so the embed does not create a second page <h1>.
  return renderToString(
    <FormBody
      app={app as App}
      form={form as Form}
      embed={false}
      embedded={true}
      mountRuntime={true}
      prefillContext={prefillContext}
      activeLang={activeLang}
      titleAs={opts?.titleAs}
      omitTitle={opts?.omitTitle}
      cancelLabel={opts?.cancelLabel}
      {...(opts?.optionSets !== undefined ? { optionSets: opts.optionSets } : {})}
    />
  )
}
