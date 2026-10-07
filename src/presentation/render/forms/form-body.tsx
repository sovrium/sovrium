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
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
  computeFormHelpTextClasses,
  computeHostedFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { renderInlineMarkdown } from '@/presentation/render/markdown/inline-markdown'
import { buildFormAttributes } from './form-attributes'
import { FormFieldElement, type PrefillValue, type ResolvedFormField } from './form-field-elements'
import {
  resolveAllFields,
  resolveDocumentLang,
  resolveText,
  stepDescriptionsHtml,
} from './form-field-resolver'
import { DescriptionText } from './form-help-text'
import { HoneypotInput } from './form-honeypot'
import { FlatFormActions } from './form-layout-keys'
import { bodyLinkOverrides, type FormBodyLink } from './form-link-answers'
import { FormBodyMultiStep, type FormBodyShared } from './form-renderer-multi-step'
import { FormBodyOneQuestion } from './form-renderer-one-question'
import { FormRuntimeMount } from './form-runtime'
import { SaveForLater } from './form-save-for-later'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'

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
  /**
   * With `lockPrefill`, the keys the lock applies to — the ones the host's
   * inline prefill names. Every other prefilled value (a field's own default,
   * the form's `prefill` map) stays an editable starting value. Absent, the
   * lock covers every key in `prefill`.
   */
  readonly lockedKeys?: readonly string[]
}

/**
 * Mark the fields whose prefilled value stays editable although the prefill is
 * locked: those the lock does not name (`lockedKeys`).
 */
function markEditablePrefill(
  fields: readonly ResolvedFormField[],
  prefillContext: EmbeddedFormPrefillContext | undefined
): readonly ResolvedFormField[] {
  const lockedKeys = prefillContext?.lockPrefill === true ? prefillContext.lockedKeys : undefined
  if (lockedKeys === undefined) return fields
  return fields.map((field) =>
    lockedKeys.includes(field.name) ? field : { ...field, prefillEditable: true }
  )
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
  embedded,
  prefillContext,
  activeLang,
  titleAs,
  optionSets,
  link,
}: {
  readonly app: App
  readonly form: Form
  readonly embed: boolean
  readonly embedded: boolean
  readonly prefillContext: EmbeddedFormPrefillContext | undefined
  readonly activeLang: string | undefined
  readonly titleAs: 'h1' | 'h2' | 'h3' | undefined
  readonly optionSets: FormOptionSets | undefined
  readonly link: FormBodyLink | undefined
}): FormBodyShared {
  const { languages } = app
  const lockPrefill = prefillContext?.lockPrefill === true
  const prefillMap = prefillContext?.prefill ?? {}
  const lang = resolveDocumentLang(languages, activeLang)
  const { action, offer } = bodyLinkOverrides(form, { embed, embedded, link, lang, languages })
  return {
    title: resolveText(form.title, languages, form.name, activeLang),
    descriptionHtml: renderInlineMarkdown(resolveText(form.description, languages, '', activeLang)),
    ...(form.steps !== undefined
      ? { stepDescriptionsHtml: stepDescriptionsHtml(form.steps, languages, activeLang) }
      : {}),
    submitLabel: resolveText(
      form.display?.submitLabel,
      languages,
      resolveInterpreterString(
        'form.submit',
        resolveDocumentLang(languages, activeLang),
        languages
      ),
      activeLang
    ),
    resolvedFields: markEditablePrefill(
      resolveAllFields(app, form, activeLang, {
        conditionValues: prefillMap,
        ...(optionSets !== undefined ? { optionSets } : {}),
      }),
      prefillContext
    ),
    prefillMap,
    lockPrefill,
    titleAs: titleAs ?? 'h1',
    formAttributes: buildFormAttributes(form, { embed, embedded, lockPrefill, action }),
    ...offer,
    ...(form.fieldGroups ? { fieldGroups: form.fieldGroups } : {}),
    layoutKeys: { labelPlacement: form.labelPlacement, stickyActions: form.stickyActions },
    // Defaults are `honeypot: true` when antiSpam is absent.
    ...(effectiveAntiSpam(form).honeypot ? { antiSpamHoneypot: true } : {}),
  }
}

/** What a form body is rendered from. */
interface FormBodyProps {
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
   * the submit and honors `onSuccess.redirect` (GAP-H3 / a forms spec).
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
  /**
   * Choices read from tables for this render, keyed by field submit
   * identifier (`resolveFormOptionSources`). Absent, a table-backed field
   * offers no choices.
   */
  readonly optionSets?: FormOptionSets
  /**
   * Draw no form title: the host already heads the form — a dialog shows one
   * title, its own or the form's (`expandDialogFormRef`).
   */
  readonly omitTitle?: boolean
  /** A Cancel beside the submit, labelled — drawn by a dialog hosting the form. */
  readonly cancelLabel?: string
  /** A private link's page: where the form posts, and whether it is an edit. */
  readonly link?: FormBodyLink
}

/**
 * What a host changes on the form it holds: `''` draws no title (the host
 * heads the form itself), and a dialog adds a Cancel beside the submit.
 */
function hostOverrides(
  omitTitle: boolean | undefined,
  cancelLabel: string | undefined
): Partial<Pick<FormBodyShared, 'title' | 'cancelLabel'>> {
  return {
    ...(omitTitle === true ? { title: '' } : {}),
    ...(cancelLabel === undefined ? {} : { cancelLabel }),
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
  optionSets,
  omitTitle,
  cancelLabel,
  link,
}: FormBodyProps) {
  const shouldMountRuntime = mountRuntime ?? !embed
  const commonProps: FormBodyShared = {
    ...buildFormBodyShared({
      app,
      form,
      embed,
      embedded,
      prefillContext,
      activeLang,
      titleAs,
      optionSets,
      link,
    }),
    ...hostOverrides(omitTitle, cancelLabel),
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
            honors `onSuccess.redirect` (GAP-H3 / a forms spec). Exactly one
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
  // against an empty map (a forms spec: conditional sections hidden first).
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
          {group.description !== undefined && (
            <p className={computeFormHelpTextClasses()}>{group.description}</p>
          )}
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

function FormBodyFlat({
  title,
  descriptionHtml,
  submitLabel,
  formAttributes,
  resolvedFields,
  fieldGroups,
  prefillMap,
  lockPrefill,
  antiSpamHoneypot,
  titleAs = 'h1',
  embedded = false,
  cancelLabel,
  saveForLater,
  layoutKeys,
  formAttributes: { 'data-form-name': formName = '' },
}: FormBodyShared) {
  const TitleTag = titleAs
  // Embedded/dialog bodies have no `.form-page` shell, so the standalone
  // `.form-page`-scoped `-mt-3` never reaches them — add a positive top margin
  // so the description reads clearly below the title (not cramped). Standalone
  // forms left-align the submit (`sm:self-start`); embedded/dialog forms
  // end-align it with `self-end` in the form's flex COLUMN (moot on mobile, where
  // `w-full` fills the row) — not an auto margin, so a grid `body` part lets a
  // `col-span-full` submit fill its row.
  const descriptionClass = embedded ? 'form-description mt-2' : 'form-description'
  const submitAlign = embedded ? 'self-end' : 'sm:self-start'
  return (
    <>
      {title !== '' && <TitleTag className="form-title">{title}</TitleTag>}
      <DescriptionText
        html={descriptionHtml}
        className={descriptionClass}
      />
      <form
        className={computeHostedFormLayoutClasses(layoutKeys?.labelPlacement)}
        {...formAttributes}
      >
        {antiSpamHoneypot && <HoneypotInput />}
        {renderFlatFormFields({ resolvedFields, fieldGroups, prefillMap, lockPrefill })}
        <FlatFormActions
          layoutKeys={layoutKeys}
          submitLabel={submitLabel}
          submitAlign={submitAlign}
          cancelLabel={cancelLabel}
        />
        {saveForLater !== undefined && (
          <SaveForLater
            formName={formName}
            labels={saveForLater}
          />
        )}
      </form>
    </>
  )
}

// One-question-at-a-time body lives in `./form-renderer-one-question.tsx`
// (sliced out so this file stays under the project's max-lines cap).
