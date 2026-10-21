/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What one source field becomes: its Sovrium type, its settings, how the report
 * grades the mapping, and whether its values are seeded.
 *
 * The field-type table decides the TYPE. This file decides what the type needs
 * to stand on its own, and what happens when that cannot be had:
 *
 * - A **link** needs the table it points at to be imported too; its shape (one
 *   or many, which side stores the pair) comes from `link-pairing-service`. It
 *   is optional (`required: false`) unless its source declares it NOT NULL.
 * - A **lookup** or a **count** needs the link it reads through, and a lookup
 *   the field it reads on the other table.
 * - A **formula** or a **rollup** is planned over the other fields of its
 *   table by `computed-field-service`: translated, or kept as values with a
 *   TODO quoting the original.
 *
 * When one of these is missing, the field is kept as a plain field of its
 * result type holding the values the source last computed, the report grades it
 * `degraded`, and a rollup or a formula gets a TODO quoting the original. A
 * computed field never writes seed values: the database computes it.
 */

import { computedValueType, planComputedField } from './computed-field-service'
import { fieldSettingsOf, type ConfigEntry } from './field-settings-service'
import { lookupFieldType, UNMAPPED_FIELD_TYPE } from './field-type-mappings'
import { linkKey, linkTargetOf, type LinkShape } from './link-pairing-service'
import { decideSelect, isSelectType } from './select-field-service'
import { toolPossessive } from './source-display-name-service'
import type { CanonicalField, CanonicalTable } from './canonical-base'
import type { TableSourceTool } from './field-type-mappings'
import type { FormulaFieldSource } from './formula-translation-service'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** What the decisions of one base share. */
export interface BaseIndex {
  readonly tool: TableSourceTool
  /** Sovrium table names, by source table id. */
  readonly tableNames: ReadonlyMap<string, string>
  /** Sovrium field names, by `linkKey(table, field)`. */
  readonly fieldNames: ReadonlyMap<string, string>
  /** Source field names, by `linkKey(table, field)`. */
  readonly sourceNames: ReadonlyMap<string, string>
  readonly links: ReadonlyMap<string, LinkShape>
  /** Whether the app declares sign-in accounts a collaborator can be linked to. */
  readonly accounts: boolean
}

/** What one source field becomes. */
export interface FieldDecision {
  readonly type: FieldType
  readonly settings: ConfigEntry
  readonly outcome: 'mapped' | 'degraded' | 'unmapped'
  readonly reason?: string
  readonly todo?: { readonly original: string; readonly reason: string }
  /** For a link: the Sovrium name of the table it points at. */
  readonly relatedTable?: string
  /** Whether the seed writes this field's values. */
  readonly seeded: boolean
}

/**
 * The field types whose value the database computes. An `autonumber` is not
 * one: the seed keeps the number the source gave each record.
 */
const COMPUTED: ReadonlySet<FieldType> = new Set<FieldType>([
  'created-at',
  'updated-at',
  'created-by',
  'updated-by',
])

/** The types a kept-values field may take: plain values the seed can write as they are. */
const PLAIN_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
  'number',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'rating',
  'duration',
  'checkbox',
  'date',
  'datetime',
])

interface Subject {
  readonly index: BaseIndex
  readonly table: CanonicalTable
  readonly field: CanonicalField
}

const valuesOf = ({ table, field }: Subject) =>
  table.records.map((record) => record.values[field.sourceId])

const option = (field: CanonicalField, key: string): string | undefined => {
  const value = field.options?.[key]
  return typeof value === 'string' ? value : undefined
}

const resultOf = (field: CanonicalField): Readonly<Record<string, unknown>> | undefined => {
  const result = field.options?.['result']
  return typeof result === 'object' && result !== null
    ? (result as Readonly<Record<string, unknown>>)
    : undefined
}

const nameIn = (index: BaseIndex, table: string, field: string | undefined) =>
  field === undefined ? undefined : index.fieldNames.get(linkKey(table, field))

/**
 * A computed field kept as its last values: the plain type of its result, or
 * long text when a record holds a list.
 */
export const keptValues = (
  subject: Subject,
  reason: string,
  todo?: FieldDecision['todo']
): FieldDecision => {
  const values = valuesOf(subject)
  const result = resultOf(subject.field)
  const type = keptTypeOf(subject, result, values)
  const options = result?.['options'] as Readonly<Record<string, unknown>> | undefined
  return {
    type,
    settings: fieldSettingsOf(type, { tool: subject.index.tool, options, values }),
    outcome: 'degraded',
    reason,
    ...(todo === undefined ? {} : { todo }),
    seeded: true,
  }
}

/** The plain type a kept-values field takes: its result's, a count's integer, or text. */
const keptTypeOf = (
  { index, field }: Subject,
  result: Readonly<Record<string, unknown>> | undefined,
  values: readonly unknown[]
): FieldType => {
  if (values.some((value) => Array.isArray(value))) return 'long-text'
  const resultType = typeof result?.['type'] === 'string' ? result['type'] : undefined
  const plain =
    lookupFieldType(index.tool, field.sourceType).sovrium === 'count'
      ? 'integer'
      : resultType === undefined
        ? undefined
        : lookupFieldType(index.tool, resultType).sovrium
  return plain !== undefined && PLAIN_TYPES.has(plain) ? plain : 'single-line-text'
}

const unmapped = (reason: string): FieldDecision => ({
  type: UNMAPPED_FIELD_TYPE,
  settings: {},
  outcome: 'unmapped',
  reason,
  seeded: true,
})

/**
 * Whether the source states that a link must always hold a record: only a
 * database foreign key declared `NOT NULL` does. Every other imported link is
 * optional, and says so (`required: false`), because the engine reads a link
 * with no `required` as a required one when it orders tables, and refuses a
 * loop of links between tables (A to B to C to A) that a source holds freely.
 */
const linkRequired = (field: CanonicalField): boolean => field.options?.['is_nullable'] === 'NO'

const relationship = (subject: Subject): FieldDecision => {
  const { index, table, field } = subject
  const shape = index.links.get(linkKey(table.sourceId, field.sourceId))
  const target = linkTargetOf(field)
  const relatedTable = target === undefined ? undefined : index.tableNames.get(target)
  if (shape === undefined || relatedTable === undefined || target === undefined) {
    return unmapped('The table this link points at is not imported; its values are kept as text.')
  }
  const reciprocal =
    shape.reciprocal === undefined ? undefined : index.fieldNames.get(shape.reciprocal)
  return {
    type: 'relationship',
    settings: {
      relatedTable,
      relationType: shape.relationType,
      ...(linkRequired(field) ? {} : { required: false }),
      ...(reciprocal === undefined ? {} : { reciprocalField: reciprocal }),
    },
    outcome: 'mapped',
    relatedTable,
    seeded: !shape.derived,
  }
}

/** The link a lookup, rollup or count reads through: its name and its target table. */
const throughLink = (subject: Subject) => {
  const { index, table, field } = subject
  const link = table.fields.find(
    (candidate) => candidate.sourceId === option(field, 'recordLinkFieldId')
  )
  if (link === undefined || !index.links.has(linkKey(table.sourceId, link.sourceId)))
    return undefined
  const target = linkTargetOf(link)
  const name = nameIn(index, table.sourceId, link.sourceId)
  return target === undefined || name === undefined ? undefined : { name, target }
}

const lookup = (subject: Subject): FieldDecision => {
  const through = throughLink(subject)
  const related =
    through === undefined
      ? undefined
      : nameIn(subject.index, through.target, option(subject.field, 'fieldIdInLinkedTable'))
  if (through === undefined || related === undefined) {
    return keptValues(
      subject,
      'The link or the field this lookup reads is not imported; it keeps its last values.'
    )
  }
  return {
    type: 'lookup',
    settings: { relationshipField: through.name, relatedField: related },
    outcome: 'mapped',
    seeded: false,
  }
}

const count = (subject: Subject): FieldDecision => {
  const through = throughLink(subject)
  return through === undefined
    ? keptValues(subject, 'The link this count reads is not imported; it keeps its last values.')
    : {
        type: 'count',
        settings: { relationshipField: through.name },
        outcome: 'mapped',
        seeded: false,
      }
}

/** A formula or rollup until its table's other fields are typed: its value type, planned later. */
const pendingComputed = ({ index, field }: Subject): FieldDecision => ({
  type: computedValueType(index.tool, field),
  settings: {},
  outcome: 'degraded',
  seeded: true,
})

/**
 * Plan a formula or rollup over the other fields of its table as they were
 * typed, through the formula translator and the rollup table
 * (`computed-field-service`). A field the plan keeps as values stays a plain
 * field; a record holding a list keeps it as long text.
 */
export const decideComputed = (
  index: BaseIndex,
  table: CanonicalTable,
  field: CanonicalField,
  siblings: readonly FormulaFieldSource[]
): FieldDecision => {
  const subject = { index, table, field }
  const linkedFieldName = (linkFieldId: string, fieldId: string): string | undefined => {
    const link = table.fields.find((candidate) => candidate.sourceId === linkFieldId)
    const target = link === undefined ? undefined : linkTargetOf(link)
    return target === undefined ? undefined : nameIn(index, target, fieldId)
  }
  const plan = planComputedField({ tool: index.tool, field, siblings, linkedFieldName })
  const computed = plan.type === 'formula' || plan.type === 'rollup'
  const values = valuesOf(subject)
  const type: FieldType =
    !computed && values.some((value) => Array.isArray(value)) ? 'long-text' : plan.type
  return {
    type,
    settings: computed
      ? plan.settings
      : fieldSettingsOf(type, { tool: index.tool, options: plan.valueOptions, values }),
    outcome: plan.outcome,
    ...(plan.reason === undefined ? {} : { reason: plan.reason }),
    ...(plan.todo === undefined ? {} : { todo: plan.todo }),
    seeded: !computed,
  }
}

/** A button keeps its link only when every record opens the same one. */
const button = (subject: Subject): FieldDecision => {
  const values = valuesOf(subject)
  const urls = [...new Set(values)]
  const [url] = urls
  return values.length > 0 && urls.length === 1 && typeof url === 'string'
    ? {
        type: 'button',
        settings: { action: 'url', url },
        outcome: 'degraded',
        reason: 'The button opens the one link every record showed.',
        seeded: false,
      }
    : unmapped(
        "The source does not state what the button does; each record's link is kept as text."
      )
}

const user = (subject: Subject, looked: FieldType): FieldDecision =>
  subject.index.accounts
    ? {
        type: looked,
        settings: fieldSettingsOf(looked, {
          tool: subject.index.tool,
          options: subject.field.options,
          values: valuesOf(subject),
        }),
        outcome: 'mapped',
        seeded: true,
      }
    : {
        type: 'long-text',
        settings: {},
        outcome: 'degraded',
        reason:
          'The app declares no auth block, so there is no account to link a collaborator to; their email addresses are kept as text.',
        seeded: true,
      }

/** The field types that name the account a record was written by. */
const AUTHORSHIP: ReadonlySet<FieldType> = new Set<FieldType>(['created-by', 'updated-by'])

/**
 * An authorship field in an app with no accounts: like a collaborator, there is
 * no account to point at, so the source's values are kept as text.
 */
const authorshipAsText = (): FieldDecision => ({
  type: 'long-text',
  settings: {},
  outcome: 'degraded',
  reason:
    'The app declares no auth block, so there is no account to record as author; the authors the source recorded are kept as text.',
  seeded: true,
})

const SPECIAL: Readonly<Partial<Record<FieldType, (subject: Subject) => FieldDecision>>> = {
  relationship,
  lookup,
  count,
  rollup: pendingComputed,
  formula: pendingComputed,
  button,
}

/** Decide what one source field becomes. */
export const decideField = (
  index: BaseIndex,
  table: CanonicalTable,
  field: CanonicalField
): FieldDecision => {
  const subject = { index, table, field }
  const looked = lookupFieldType(index.tool, field.sourceType)
  if (looked.outcome === 'unmapped') {
    return unmapped(
      `No Sovrium field type matches ${toolPossessive(index.tool)} "${field.sourceType}" field; its values are kept as text.`
    )
  }
  const special = SPECIAL[looked.sovrium]
  if (special !== undefined) return special(subject)
  if (looked.sovrium === 'user') return user(subject, looked.sovrium)
  if (AUTHORSHIP.has(looked.sovrium) && !index.accounts) return authorshipAsText()
  const input = { tool: index.tool, options: field.options, values: valuesOf(subject) }
  if (isSelectType(looked.sovrium)) return decideSelect(looked, input)
  const settings = fieldSettingsOf(looked.sovrium, input)
  return {
    type: looked.sovrium,
    settings,
    outcome: looked.outcome,
    ...(looked.outcome === 'degraded' ? { reason: looked.reason } : {}),
    seeded: !COMPUTED.has(looked.sovrium),
  }
}
