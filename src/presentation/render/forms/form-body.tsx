/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-field SSR rendering and the prefill / locked-prefill variants now
 * live in `./form-field-elements.tsx`; this file owns the form-document
 * orchestration (FormHead / FormBody / FormPage / renderEmbeddedFormBody)
 * and the field-resolution pipeline.
 */

import { type ReactNode } from 'react'
import { effectiveAntiSpam } from '@/domain/models/app/forms/anti-spam-defaults'
import { isGroupVisible } from '@/domain/models/app/forms/field-groups-flow'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { FormFieldElement, type PrefillValue } from './form-field-elements'
import { resolveAllFields, resolveText } from './form-field-resolver'
import { FormBodyMultiStep, type FormBodyShared } from './form-renderer-multi-step'
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
export interface EmbeddedFormPrefillContext {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

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

/**
 * Build the shared layout props for a form body. Resolves all `$t:` text
 * (title / description / submit label / fields) for the active language and
 * assembles the form's HTML attribute set.
 */
function buildFormBodyShared({
  app,
  form,
  embed,
  prefillContext,
  activeLang,
  titleAs,
}: {
  readonly app: App
  readonly form: Form
  readonly embed: boolean
  readonly prefillContext: EmbeddedFormPrefillContext | undefined
  readonly activeLang: string | undefined
  readonly titleAs: 'h1' | 'h2' | 'h3' | undefined
}): FormBodyShared {
  const { languages } = app
  const lockPrefill = prefillContext?.lockPrefill === true
  return {
    title: resolveText(form.title, languages, form.name, activeLang),
    description: resolveText(form.description, languages, '', activeLang),
    submitLabel: resolveText(form.display?.submitLabel, languages, 'Submit', activeLang),
    resolvedFields: resolveAllFields(app, form, activeLang),
    prefillMap: prefillContext?.prefill ?? {},
    lockPrefill,
    titleAs: titleAs ?? 'h1',
    formAttributes: buildFormAttributes(form, embed, lockPrefill),
    ...(form.fieldGroups ? { fieldGroups: form.fieldGroups } : {}),
    // [internal ref]: defaults are `honeypot: true` when antiSpam is absent.
    ...(effectiveAntiSpam(form).honeypot ? { antiSpamHoneypot: true } : {}),
  }
}

export function FormBody({
  app,
  form,
  embed = false,
  embedded = false,
  mountRuntime,
  prefillContext,
  activeLang,
  titleAs,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  /**
   * Whether the body is rendered EMBEDDED in a host page / dialog (via
   * `renderEmbeddedFormBody`) rather than as the standalone `.form-page` shell.
   * Distinct from `embed` (the third-party iframe variant): a dialog `formRef`
   * expands with `embed={false}` but `embedded={true}`. Drives the flat body's
   * non-cramped header spacing and end-aligned submit. Defaults to `false`.
   */
  readonly embedded?: boolean
  /**
   * Whether to emit the inline client runtime (`FormRuntimeMount`).
   *
   * Defaults to `!embed` so the standalone `/forms/:name` page mounts the
   * runtime and the `?embed=true` third-party-embed variant does NOT (the
   * host page owns post-submit behavior there). The page `formRef` expansion
   * (`renderEmbeddedFormBody`) overrides this to `true` so an embedded form
   * gets the SAME interactive runtime as a standalone form — it intercepts
   * the submit and honors `onSuccess.redirect` (GAP-H3 / [internal ref]).
   */
  readonly mountRuntime?: boolean
  readonly prefillContext?: EmbeddedFormPrefillContext
  readonly activeLang?: string
  /**
   * P8: heading tag for the form title. Defaults to `'h1'`; an embedded
   * formRef opts into `'h2'`/`'h3'` via `props.headingLevel`. Standalone
   * `FormPage` never sets it (the form title is the page's single <h1>).
   */
  readonly titleAs?: 'h1' | 'h2' | 'h3'
}) {
  const shouldMountRuntime = mountRuntime ?? !embed
  const commonProps: FormBodyShared = {
    ...buildFormBodyShared({ app, form, embed, prefillContext, activeLang, titleAs }),
    embedded,
  }
  const isMultiStep = form.layout === 'multi-step' && form.steps && form.steps.length > 0
  const body: ReactNode = isMultiStep ? (
    <FormBodyMultiStep
      {...commonProps}
      steps={form.steps!}
    />
  ) : form.layout === 'one-question' ? (
    <FormBodyOneQuestion {...commonProps} />
  ) : (
    <FormBodyFlat {...commonProps} />
  )

  return (
    <>
      {body}
      {/* Mount the inline client runtime when `shouldMountRuntime` is set.
          - Standalone /forms/:name route → mounts (default `!embed`).
          - ?embed=true third-party embed → NOT mounted; the host page owns
            post-submit behavior.
          - page `formRef` expansion (renderEmbeddedFormBody) → mounts
            (mountRuntime=true) so the embedded form intercepts submit and
            honors `onSuccess.redirect` (GAP-H3 / [internal ref]). Exactly one
            embedded form runs per page, so there is no double-binding. */}
      {shouldMountRuntime && (
        <FormRuntimeMount
          form={form}
          languages={app.languages}
          activeLang={activeLang}
        />
      )}
    </>
  )
}

/**
 * Render the flat-layout `<form>` body. When `fieldGroups[]` is declared,
 * fields render under labeled section headers in declaration order; a group
 * whose `visibleWhen` evaluates false against the (empty) initial values is
 * omitted entirely (label + fields). Fields not listed in any group render
 * after the grouped sections, preserving source order.
 */
function renderFlatFormFields({
  resolvedFields,
  fieldGroups,
  prefillMap,
  lockPrefill,
}: Pick<FormBodyShared, 'resolvedFields' | 'fieldGroups' | 'prefillMap' | 'lockPrefill'>) {
  const renderField = (field: FormBodyShared['resolvedFields'][number]) => (
    <FormFieldElement
      key={field.name}
      field={field}
      prefillValue={prefillMap[field.name]}
      lockPrefill={lockPrefill}
    />
  )
  if (!fieldGroups || fieldGroups.length === 0) {
    return <>{resolvedFields.map(renderField)}</>
  }
  // Initial render has no submitted values, so conditional groups evaluate
  // against an empty map ([internal ref]: conditional sections hidden first).
  const visibleGroups = fieldGroups.filter((group) => isGroupVisible(group, {}))
  const groupedNames = new Set<string>(visibleGroups.flatMap((g) => Array.from(g.fields)))
  const ungrouped = resolvedFields.filter((f) => !groupedNames.has(f.name))
  return (
    <>
      {visibleGroups.map((group) => (
        <section
          key={group.label}
          className={`form-group ${computeFormGroupClasses()}`}
        >
          <h2 className={`form-group-label ${computeFormGroupLabelClasses()}`}>{group.label}</h2>
          {group.fields
            .map((name) => resolvedFields.find((f) => f.name === name))
            .filter((f): f is FormBodyShared['resolvedFields'][number] => f !== undefined)
            .map(renderField)}
        </section>
      ))}
      {ungrouped.map(renderField)}
    </>
  )
}

/**
 * [internal ref]: When `antiSpam.honeypot: true`, render a conventionally-
 * named hidden input (`_hp`) with all four invisibility markers — humans
 * cannot tab into it, see it, or have their password manager auto-fill it,
 * but a naive bot that fills every input will trigger the server-side
 * detection (`submit-form-honeypot.ts`).
 */
// The honeypot markup is emitted as a raw, fully-static HTML string (no
// interpolation of any value, untrusted or otherwise) for two reasons:
//
// 1. [internal ref] asserts the SSR HTML contains the *lowercase* standard DOM
//     attribute `autocomplete="off"` (case-sensitive: `/autocomplete="off"/`),
//     and real password managers also key on the lowercase attribute. Under
//     this app's React 19 `renderToString` path, the recognized `autoComplete`
//     JSX prop is emitted verbatim as camelCase `autoComplete="off"` — it is
//     NOT lowercased the way `tabIndex` → `tabindex` is — so a plain JSX prop
//     cannot satisfy the assertion.
//  2. Passing a lowercase `autocomplete` JSX prop (e.g. via a spread) makes
//     React reject it as an unrecognized DOM property and log
//     `Invalid DOM property \`autocomplete\`. Did you mean \`autoComplete\`?`
//     on every SSR render — terminal noise with no benefit.
//
// Injecting the constant markup verbatim sidesteps both: React never validates
// the attribute, and the exact lowercase `autocomplete="off"` reaches the HTML.
//
// Both constants live at module level so React allocates nothing fresh per SSR
// pass (react-perf/jsx-no-new-object-as-prop) — the `__html` payload and the
// wrapper style are stable across renders.
const HONEYPOT_INNER_HTML = {
  __html:
    '<input type="text" name="_hp" tabindex="-1" aria-hidden="true" autocomplete="off" style="display:none" />',
} as const

// Wrapper uses `display: contents` so it adds no box of its own — the honeypot's
// own `display:none` keeps the field invisible/untabbable for humans while a
// naive bot that fills every input still trips `_hp` (submit-form-honeypot.ts).
const HONEYPOT_WRAPPER_STYLE = { display: 'contents' } as const

function HoneypotInput() {
  return (
    <span
      style={HONEYPOT_WRAPPER_STYLE}
      dangerouslySetInnerHTML={HONEYPOT_INNER_HTML}
    />
  )
}

function FormBodyFlat({
  title,
  description,
  submitLabel,
  formAttributes,
  resolvedFields,
  fieldGroups,
  prefillMap,
  lockPrefill,
  antiSpamHoneypot,
  titleAs = 'h1',
  embedded = false,
}: FormBodyShared) {
  const TitleTag = titleAs
  // Embedded/dialog bodies have no `.form-page` shell, so the standalone
  // `.form-page`-scoped `-mt-3` never reaches them — add a positive top margin
  // so the description reads clearly below the title (not cramped). Standalone
  // forms left-align the submit (`sm:self-start`); embedded/dialog forms
  // end-align it — `ml-auto` is a cross-axis auto margin in the form's flex
  // COLUMN, so it disables the default stretch and pushes the (auto-width)
  // button to the right edge (a no-op on mobile where `w-full` fills the row).
  const descriptionClass = embedded ? 'form-description mt-2' : 'form-description'
  const submitAlign = embedded ? 'ml-auto' : 'sm:self-start'
  return (
    <>
      <TitleTag className="form-title">{title}</TitleTag>
      {description && <p className={descriptionClass}>{description}</p>}
      <form
        className={computeFormLayoutClasses()}
        {...formAttributes}
      >
        {antiSpamHoneypot && <HoneypotInput />}
        {renderFlatFormFields({ resolvedFields, fieldGroups, prefillMap, lockPrefill })}
        <button
          type="submit"
          className={`${computeButtonDefaultClasses()} mt-2 w-full sm:w-auto ${submitAlign}`}
        >
          {submitLabel}
        </button>
      </form>
    </>
  )
}

// One-question-at-a-time body lives in `./form-renderer-one-question.tsx`
// (sliced out so this file stays under the project's max-lines cap).
