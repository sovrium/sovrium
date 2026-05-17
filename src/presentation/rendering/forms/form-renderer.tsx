/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- FormHead /
   FormBody / FormPage are SSR-only React components co-located with the
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

import { type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { FormFieldElement, type PrefillValue } from './form-field-elements'
import { resolveAllFields, resolveText } from './form-field-resolver'
import { FormBodyOneQuestion } from './form-renderer-one-question'
import { FormRuntimeMount } from './form-runtime'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Embed-time prefill context resolved by `form-ref-resolver`.
 *
 * `prefill` maps form-field names (matching `column` for table-bound
 * fields, `name` for standalone) to scalar/array values already resolved
 * from `$parent.<field>` tokens. `lockPrefill` toggles the rendering mode
 * for those fields:
 *   - `false` (default): prefill becomes the field's `defaultValue` /
 *     `value` so the submitter can override it inline.
 *   - `true`: the field renders as a `<input type="hidden">` only — the
 *     value is submitted but no UI is shown. Server-side parent
 *     revalidation kicks in on submit so a stale parent ID still surfaces
 *     a 422 instead of silently linking to a deleted row.
 */
interface EmbeddedFormPrefillContext {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

/**
 * Pure HTML head fragment — title and description are resolved upstream
 * so this stays a focused renderer.
 */
const FormHead = ({
  title,
  description,
}: {
  readonly title: string
  readonly description: string
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
  </head>
)

/**
 * Inner form body — title, optional description, and the `<form>` itself
 * with all resolved fields and a submit button.
 *
 * Extracted so the same shape can be rendered both standalone (wrapped in a
 * full HTML document by `FormPage`) and inline (embedded inside a host page
 * via `renderEmbeddedFormBody`). Keeps a single source of truth for the
 * form's DOM structure, attribute set, and field resolution.
 */
/**
 * Build the `<form>` element attribute set.
 *
 * Comments preserved from the prior inline declaration:
 * When `lockPrefill: true`, the host page tags the form with
 * `data-inline-prefill` so the submission handler can revalidate the
 * parent record on POST. The tag also serves as the source-of-truth
 * flag for the test suite — it distinguishes inline-create submissions
 * from standalone form submits even when the locked column is also
 * present in the body. Cast is necessary because TS narrows conditional
 * spreads to optional keys (`{ 'data-embed'?: string | undefined }`)
 * which doesn't widen to Record<string, string>.
 *
 * The runtime intercepts submit and runs its own constraint-validation
 * pass via `checkValidity()` on each input, so the browser's native
 * pre-submit validation popup must be suppressed (otherwise it fires
 * BEFORE our submit listener and we never see the event). Embedded
 * forms keep native validation on — the host page may not have a
 * runtime mounted, and we still want the popup as a baseline UX.
 */
function buildFormAttributes(
  form: Readonly<Form>,
  embed: boolean,
  lockPrefill: boolean
): Readonly<Record<string, string>> {
  return {
    method: 'POST',
    action: `/api/forms/${form.name}/submissions`,
    'data-form-name': form.name,
    ...(embed ? { 'data-embed': 'true' } : {}),
    ...(lockPrefill ? { 'data-inline-prefill': 'locked' } : {}),
  } as Readonly<Record<string, string>>
}

function FormBody({
  app,
  form,
  embed = false,
  prefillContext,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  readonly prefillContext?: EmbeddedFormPrefillContext
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name)
  const description = resolveText(form.description, languages, '')
  const resolvedFields = resolveAllFields(app, form)

  const lockPrefill = prefillContext?.lockPrefill === true
  const prefillMap = prefillContext?.prefill ?? {}
  const formAttributes = buildFormAttributes(form, embed, lockPrefill)

  const commonProps = {
    title,
    description,
    formAttributes,
    resolvedFields,
    prefillMap,
    lockPrefill,
  }
  const isMultiStep = form.layout === 'multi-step' && form.steps && form.steps.length > 0
  const isOneQuestion = form.layout === 'one-question'
  const body: ReactNode = isMultiStep ? (
    <FormBodyMultiStep
      {...commonProps}
      steps={form.steps!}
    />
  ) : isOneQuestion ? (
    <FormBodyOneQuestion {...commonProps} />
  ) : (
    <FormBodyFlat {...commonProps} />
  )

  return (
    <>
      {body}
      {/* Suppress the runtime script when rendered as an embedded fragment —
          the host page provides its own runtime (or none) and a duplicate
          script tag would otherwise re-bind submit handlers in confusing
          ways. The standalone /forms/:name route enables it; the
          renderEmbeddedFormBody flow (used by `formRef` page expansion)
          leaves it off. */}
      {!embed && <FormRuntimeMount form={form} />}
    </>
  )
}

interface FormBodyShared {
  readonly title: string
  readonly description: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

function FormBodyFlat({
  title,
  description,
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
}: FormBodyShared) {
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <form {...formAttributes}>
        {resolvedFields.map((field) => (
          <FormFieldElement
            key={field.name}
            field={field}
            prefillValue={prefillMap[field.name]}
            lockPrefill={lockPrefill}
          />
        ))}
        <button type="submit">Submit</button>
      </form>
    </>
  )
}

// One-question-at-a-time body lives in `./form-renderer-one-question.tsx`
// (sliced out so this file stays under the project's max-lines cap).

/**
 * Multi-step body rendering.
 *
 * The initial GET `/forms/:name` lands on step 1 of the form. Only that
 * step's fields appear in the SSR HTML — the renderer does NOT inline the
 * remaining steps' inputs. Subsequent steps are fetched on demand by the
 * inline runtime via `GET /api/forms/:name/steps/:stepId` (returns an HTML
 * fragment with prefilled values from the per-session draft store).
 *
 * Why per-step SSR instead of "all steps in DOM, JS-toggle hidden":
 *   - APP-FORMS-039 explicitly forbids step-N field inputs from leaking
 *     into the initial HTML response (the test asserts
 *     `expect(html).not.toMatch(/<input[^>]+name="subject"/)` on a
 *     multi-step form whose step 1 contains only `email`).
 *   - It also matches the canonical multi-step UX: the back-end mediates
 *     navigation, so a no-JS submitter still completes the form via
 *     traditional form posts (Next button submits to the advance route
 *     and the server renders the next step's HTML).
 *
 * Progress indicator and Previous button live in the wrapper next to the
 * `<form>` so the runtime can swap step contents without re-rendering them.
 */
function FormStepProgress({ totalVisible }: { readonly totalVisible: number }) {
  return (
    <div
      className="form-progress"
      data-form-progress="true"
      role="status"
      aria-label="Step progress"
    >
      {`Step 1 of ${totalVisible}`}
    </div>
  )
}

interface MultiStepFormProps extends FormBodyShared {
  readonly activeStep: NonNullable<Form['steps']>[number]
  readonly isLast: boolean
}

function MultiStepFormElement({
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
  activeStep,
  isLast,
}: MultiStepFormProps) {
  return (
    <form
      {...formAttributes}
      data-layout="multi-step"
      data-active-step={activeStep.id}
    >
      <FormBodyStep
        step={activeStep}
        stepIndex={0}
        isFirst={true}
        isLast={isLast}
        stepFields={resolvedFields.filter((f) => activeStep.fields.includes(f.name))}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
      />
      {/* Submit button stays in markup but hidden until the submitter
          reaches the last step; runtime toggles visibility per step. */}
      <button
        type="submit"
        {...(isLast ? {} : { hidden: true })}
      >
        Submit
      </button>
    </form>
  )
}

function FormBodyMultiStep(props: FormBodyShared & { readonly steps: NonNullable<Form['steps']> }) {
  const { title, description, steps } = props
  const activeStep = steps[0]
  if (activeStep === undefined) {
    return (
      <>
        <h1 className="form-title">{title}</h1>
        {description && <p className="form-description">{description}</p>}
      </>
    )
  }
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <FormStepProgress totalVisible={steps.length} />
      <MultiStepFormElement
        {...props}
        activeStep={activeStep}
        isLast={steps.length === 1}
      />
    </>
  )
}

function FormStepNav({ isFirst, isLast }: { readonly isFirst: boolean; readonly isLast: boolean }) {
  return (
    <div className="form-step-nav">
      {!isFirst && (
        <button
          type="button"
          className="step-previous"
        >
          Previous
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          className="step-next"
        >
          Next
        </button>
      )}
    </div>
  )
}

function FormBodyStep({
  step,
  stepIndex,
  isFirst,
  isLast,
  stepFields,
  prefillMap,
  lockPrefill,
}: {
  readonly step: NonNullable<Form['steps']>[number]
  readonly stepIndex: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly stepFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}) {
  return (
    <div
      className="form-step"
      data-step={step.id}
      data-step-index={stepIndex}
      data-step-active="true"
    >
      {step.title && <h2 className="step-title">{step.title}</h2>}
      {step.description && <p className="step-description">{step.description}</p>}
      {stepFields.map((field) => (
        <FormFieldElement
          key={field.name}
          field={field}
          prefillValue={prefillMap[field.name]}
          lockPrefill={lockPrefill}
        />
      ))}
      <FormStepNav
        isFirst={isFirst}
        isLast={isLast}
      />
    </div>
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
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name)
  const description = resolveText(form.description, languages, '')

  return (
    <html lang={languages?.default ?? 'en'}>
      <FormHead
        title={title}
        description={description}
      />
      <body>
        <main className="form-page">
          <FormBody
            app={app}
            form={form}
            embed={embed}
          />
        </main>
      </body>
    </html>
  )
}

/**
 * Render a complete HTML document for the given form. Returns the
 * serialised string with a leading `<!DOCTYPE html>` declaration so it
 * can be sent verbatim from a Hono handler.
 */
export function renderFormPage(app: Readonly<App>, form: Readonly<Form>): string {
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}

/**
 * Render the embed variant of a form (same content, body class differs to
 * allow embed-specific styling). Foundation tier keeps this minimal — the
 * embed-specific styling and `share.embeddable` enforcement live in
 * downstream tiers.
 */
export function renderEmbedFormPage(app: Readonly<App>, form: Readonly<Form>): string {
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
      embed={true}
    />
  )
  return `<!DOCTYPE html>\n${html}`
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
export function renderFormStepFragment(
  app: Readonly<App>,
  form: Readonly<Form>,
  stepId: string,
  draftValues: Readonly<Record<string, unknown>>
): string {
  const steps = form.steps ?? []
  if (steps.length === 0) return ''
  const stepIndex = steps.findIndex((s) => s.id === stepId)
  if (stepIndex < 0) return ''
  const step = steps[stepIndex]!
  const resolvedFields = resolveAllFields(app as App, form as Form)
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
      stepFields={resolvedFields.filter((f) => step.fields.includes(f.name))}
      prefillMap={prefillMap}
      lockPrefill={false}
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
export function renderEmbeddedFormBody(
  app: Readonly<App>,
  form: Readonly<Form>,
  prefillContext?: EmbeddedFormPrefillContext
): string {
  return renderToString(
    <FormBody
      app={app as App}
      form={form as Form}
      embed={true}
      prefillContext={prefillContext}
    />
  )
}
