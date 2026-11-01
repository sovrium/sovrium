/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Field resolution pipeline shared by `form-renderer.tsx`: each `Form['fields']`
 * entry becomes the `ResolvedFormField` the components in
 * `./form-field-elements.tsx` draw. Sliced out to keep the renderer under its cap.
 */

import { resolveDensityStep } from '@/domain/models/app/design/density-service'
import {
  buildConditionValueMap,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/app/forms/form-field-helpers'
import { renderInlineMarkdown } from '@/presentation/render/markdown/inline-markdown'
import { calculationItem } from './form-calculation-item'
import { resolveDocumentLang } from './form-document-lang'
import { resolveText } from './form-field-text'
import { withFieldEngineWords } from './form-recorder-label'
import { resolveSignatureField, resolveStandaloneField } from './form-standalone-field'
import { resolveTableField } from './form-table-field'
import type { FieldResolutionContext } from './form-field-text'
import type { ResolvedFormField } from './form-resolved-field'
import type { App } from '@/domain/models/app'
import type { DensityStepName } from '@/domain/models/app/design'
import type { Form, FormField, SectionField } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Languages } from '@/domain/models/app/languages'
import type { Table } from '@/domain/models/app/tables'

// Re-exported for the embedded-form resolver, which reads both from here.
export { resolveDocumentLang } from './form-document-lang'

/**
 * The density step a standalone form document runs at, resolved exactly as a
 * page's is — by the zone its path falls in, then the app default, then
 * `compact`. A form with no public `path` is served at `/forms/{name}`, so that
 * is the path its zone is looked up with.
 */
export function resolveFormDensityStep(
  app: Pick<App, 'design' | 'languages'>,
  form: Pick<Form, 'name' | 'path'>
): DensityStepName {
  return resolveDensityStep(
    app.design,
    form.path ?? `/forms/${form.name}`,
    app.languages?.supported.map((language) => language.code)
  )
}

/** What one render knows beyond the config: the values it is served with and the choices read for it. */
export interface FormServedState {
  readonly conditionValues?: Readonly<Record<string, unknown>>
  readonly optionSets?: FormOptionSets
}

/**
 * A `kind: section` entry, resolved to an item that renders its heading and
 * description where it is declared. It carries no control, so it is never
 * submitted; its `name` is a render key only, and cannot collide with a column
 * because a column name may not begin with a dot.
 */
const resolveSectionItem = (
  field: Readonly<SectionField>,
  index: number,
  languages: Languages | undefined,
  activeLang: string | undefined
): ResolvedFormField => ({
  name: `.section-${index}`,
  inputElement: 'section',
  htmlInputType: 'section',
  label: resolveText(field.heading, languages, '', activeLang),
  placeholder: '',
  helpText: resolveText(field.description, languages, '', activeLang),
  required: false,
  hidden: false,
})

/**
 * Resolve one FormField into the renderer's shape: a section to a heading item
 * that submits nothing, a calculation to a read-only input the runtime fills.
 */
function resolveField(
  field: Readonly<FormField>,
  table: Readonly<Table> | undefined,
  languages: Languages | undefined,
  context: FieldResolutionContext & { readonly index: number }
): ResolvedFormField | undefined {
  const { activeLang, optionSets } = context
  if (field.kind === 'calculation')
    return calculationItem(field, languages, activeLang, resolveText)
  if (field.kind === 'section') {
    return resolveSectionItem(field, context.index, languages, activeLang)
  }
  if (field.kind === 'signature') return resolveSignatureField(field, languages, activeLang)
  if (field.kind === 'standalone') {
    return resolveStandaloneField(field, languages, activeLang, optionSets)
  }
  return resolveTableField(field, table, languages, context)
}

/**
 * Apply a field's `visibleWhen` / `requiredWhen` to its resolved shape,
 * evaluated against the values the page is served with (the prefill, or a
 * multi-step draft) — the same helpers the submit pipeline uses, so the
 * served page and the server's judgement agree. `requiredWhen` wins over
 * `required`, as on submit. A config-`hidden` field is left alone: it has no
 * on-screen wrapper, and its rules stay with the server.
 */
function withConditionState(
  field: Readonly<FormField>,
  resolved: ResolvedFormField,
  values: Parameters<typeof isFieldVisible>[1]
): ResolvedFormField {
  if (resolved.hidden) return resolved
  const conditional = field as Parameters<typeof isFieldVisible>[0]
  const conditionHidden = !isFieldVisible(conditional, values)
  const required =
    conditional.requiredWhen !== undefined
      ? isFieldRequired(conditional, values)
      : resolved.required
  if (!conditionHidden && required === resolved.required) return resolved
  return { ...resolved, required, ...(conditionHidden ? { conditionHidden } : {}) }
}

/**
 * Resolve fields and look up the bound table for `kind: 'table-field'`.
 * Returns the rendered-shape fields ready for the React tree.
 *
 * `activeLang`, when supplied, threads the `?lang=` query parameter into
 * `$t:` resolution for each field's label/placeholder/helpText.
 *
 * `served.conditionValues` are the values the page is served with (the
 * resolved prefill, or a multi-step draft), keyed by field name. Each field's
 * `visibleWhen` / `requiredWhen` is evaluated against them so the served
 * page already carries the state the inline runtime would apply; an empty
 * map means nothing has been answered yet. `served.optionSets` are the choices
 * read from tables for this render (`resolveFormOptionSources`), keyed the same
 * way; a table-backed field with no entry offers no choices.
 */
export function resolveAllFields(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  served: FormServedState = {}
): ReadonlyArray<ResolvedFormField> {
  const { conditionValues = {}, optionSets = {} } = served
  const table =
    form.submitTo.table !== undefined
      ? app.tables?.find((candidate) => candidate.name === form.submitTo.table)
      : undefined
  const values = buildConditionValueMap(form, conditionValues)
  return form.fields.flatMap((field, index) => {
    const resolved = resolveField(field, table, app.languages, { activeLang, optionSets, index })
    if (resolved === undefined) return []
    // Help text is translated first, then rendered: a `$t:` value may carry markdown.
    const withHelp = {
      ...withFieldEngineWords(
        resolved,
        resolveDocumentLang(app.languages, activeLang),
        app.languages
      ),
      helpTextHtml: renderInlineMarkdown(resolved.helpText),
    }
    return [withConditionState(field, withHelp, values)]
  })
}

/** A field together with the section items declared immediately before it. */
export interface FieldWithSections {
  readonly field: ResolvedFormField
  readonly sections: ReadonlyArray<ResolvedFormField>
}

/**
 * Attach each section item to the field declared after it. A layout that does
 * not draw every field on one page — one question per screen, one step at a
 * time — shows a section with the field it introduces; a section with no field
 * after it introduces nothing and is dropped.
 */
export function attachSectionsToNextField(
  fields: ReadonlyArray<ResolvedFormField>
): ReadonlyArray<FieldWithSections> {
  return fields.reduce<{
    readonly groups: ReadonlyArray<FieldWithSections>
    readonly pending: ReadonlyArray<ResolvedFormField>
  }>(
    (acc, field) =>
      field.inputElement === 'section'
        ? { groups: acc.groups, pending: [...acc.pending, field] }
        : { groups: [...acc.groups, { field, sections: acc.pending }], pending: [] },
    { groups: [], pending: [] }
  ).groups
}

/**
 * The items one step of a multi-step form draws: its fields, each preceded by
 * the sections that introduce it, with a section heading one level below the
 * step's own title.
 */
export function stepItems(
  fields: ReadonlyArray<ResolvedFormField>,
  stepFieldNames: ReadonlyArray<string>
): ReadonlyArray<ResolvedFormField> {
  return attachSectionsToNextField(fields).flatMap((group) =>
    stepFieldNames.includes(group.field.name)
      ? [
          ...group.sections.map((section) => ({ ...section, sectionLevel: 3 as const })),
          group.field,
        ]
      : []
  )
}

/**
 * Each step's description, translated FIRST and then rendered as inline
 * markdown — a `$t:` key may hold the markdown — keyed by step id.
 */
export function stepDescriptionsHtml(
  steps: NonNullable<Form['steps']>,
  languages: Languages | undefined,
  activeLang: string | undefined
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    steps.map((step) => [
      step.id,
      renderInlineMarkdown(resolveText(step.description, languages, '', activeLang)),
    ])
  )
}

export { resolveText }
