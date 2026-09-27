/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validation of "choices read from a table" on hosted forms.
 *
 * A form reads its choice rows with the FORM's authority, not the visitor's:
 * a public form needs no read permission on the table, and must not be given
 * one. What it exposes instead is the `displayField` and `valueField` of the
 * rows its filter selects — readable by anyone who can open the form. That
 * exposure is bounded here, at load, rather than trusted:
 *
 *  - a column the table withholds from its readers (`permissions.fields[]`
 *    with a `read` other than `all`) is refused;
 *  - a column of a sensitive type (a contact detail, a document, a person, an
 *    audit stamp, free prose) is refused;
 *  - a `$currentUser` filter on a form without `access.require` is refused —
 *    nobody is signed in to resolve it.
 *
 * The anonymous principal's read plan is deliberately NOT consulted: it would
 * refuse every non-public table, and a closed table is exactly the case this
 * feature exists for.
 *
 * Structural mistakes are refused too, each naming the form and the field:
 * `options` with `optionsSource`, `optionsSource` on an input that offers no
 * choices, an unknown table or column, and a visible relationship field whose
 * column declares no `displayField` and which carries no `optionsSource`.
 */

import { isGroupReference } from '../auth/groups/group-reference'
import { classifyPermissionRung, toPermissionValue } from '../auth/permission-evaluation'
import {
  DEFAULT_RULE_ROLES,
  MAX_REACH_DEPTH,
  resolveChoiceColumnSources,
  roleHiddenByDefaultReadRules,
  type DefaultRuleRole,
  type ReachedColumn,
  type ReachTableShape,
} from '../table-option-source-reach-validation'
import {
  validateTableOptionSourceBinding,
  type TableForOptionSource,
} from '../table-option-source-validation'
import { fieldOptionSource } from './form-option-source-service'
import type { SelectOptionSource } from '../table-option-source'

interface ColumnShape {
  readonly name: string
  readonly type?: string
  readonly relatedTable?: string
  readonly displayField?: string
  readonly relationshipField?: string
  readonly relatedField?: string
  readonly formula?: string
}

interface TableShape extends TableForOptionSource, ReachTableShape {
  readonly fields?: ReadonlyArray<ColumnShape>
  readonly permissions?: {
    readonly fields?: ReadonlyArray<{ readonly field: string; readonly read?: unknown }>
  }
}

interface FieldShape {
  readonly kind: string
  readonly name?: string
  readonly column?: string
  readonly inputType?: string
  readonly hidden?: boolean
  readonly options?: unknown
  readonly optionsSource?: SelectOptionSource
}

interface FormShape {
  readonly name: string
  readonly submitTo: { readonly table?: string }
  readonly access?: { readonly require?: unknown }
  readonly fields?: ReadonlyArray<FieldShape>
}

/** Minimal app shape the rule reads. */
export interface AppForFormOptionSourceValidation {
  readonly forms?: ReadonlyArray<FormShape>
  readonly tables?: ReadonlyArray<TableShape>
}

/** Standalone inputs that offer a choice list. */
const CHOICE_INPUT_TYPES: ReadonlySet<string> = new Set(['select', 'multi-select', 'radio'])

/**
 * Column types never published as a choice: contact details, documents,
 * people, audit stamps and free prose.
 */
const SENSITIVE_COLUMN_TYPES: ReadonlySet<string> = new Set([
  'email',
  'phone-number',
  'long-text',
  'rich-text',
  'single-attachment',
  'multiple-attachments',
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
])

/** True for a `$currentUser` reference, in its string or its object spelling. */
const isCurrentUserValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.startsWith('$currentUser.')
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly kind?: unknown }).kind === 'currentUser'
  )
}

/** A form nobody has to sign in to: no gate, or a gate open to all. */
const isPublicForm = (form: Readonly<FormShape>): boolean => {
  const rung = classifyPermissionRung(toPermissionValue(form.access?.require))
  return rung === 'undeclared' || rung === 'everyone'
}

/** A column read gated on a session or a role — withheld from some reader. */
const isRestrictedRead = (read: unknown): boolean => {
  const rung = classifyPermissionRung(toPermissionValue(read))
  return rung === 'any-session' || rung === 'roles'
}

/**
 * The built-in roles whose default read rules bind this form's readers.
 *
 * A `group:<name>` entry admits a member of that group whatever their role —
 * a `member` or a `viewer` included — so a list naming any group is held to
 * both, exactly as a form open to every signed-in visitor is.
 */
const defaultRuleRolesFor = (form: Readonly<FormShape>): ReadonlyArray<DefaultRuleRole> => {
  const value = toPermissionValue(form.access?.require)
  if (classifyPermissionRung(value) !== 'roles' || !Array.isArray(value)) return DEFAULT_RULE_ROLES
  const entries: ReadonlyArray<string> = value
  if (entries.some(isGroupReference)) return DEFAULT_RULE_ROLES
  return DEFAULT_RULE_ROLES.filter((role) => entries.includes(role))
}

/** Why ONE reached column may not be published, or `undefined` when it may. */
const reachedColumnError = (
  reached: Readonly<ReachedColumn>,
  tables: ReadonlyArray<TableShape>,
  roles: ReadonlyArray<DefaultRuleRole>
): string | undefined => {
  const type = reached.column?.type
  if (type !== undefined && SENSITIVE_COLUMN_TYPES.has(type)) {
    return `a sensitive column of type '${type}' — a contact detail, document, person or audit stamp is never a choice`
  }
  const table = tables.find((candidate) => candidate.name === reached.table)
  const rule = table?.permissions?.fields?.find((entry) => entry.field === reached.field)
  if (rule !== undefined && isRestrictedRead(rule.read)) {
    return `read-restricted on table '${reached.table}' (permissions.fields[].read) — a form must not publish what the table withholds from its readers`
  }
  // Only `tables` is passed: with no role ladder, `member` and `viewer` are never
  // read as admin-equivalent — the conservative answer for a public list.
  const hiddenFrom = roleHiddenByDefaultReadRules({ tables }, reached.table, reached.field, roles)
  if (hiddenFrom !== undefined) {
    return `hidden from a signed-in '${hiddenFrom}' by the built-in default read rules (table '${reached.table}' declares no permissions.fields) — a form must not publish what a signed-in reader may not read; if everyone who opens the form may see it, declare so on table '${reached.table}': permissions: { fields: [{ field: '${reached.field}', read: 'all' }] }`
  }
  return undefined
}

/**
 * Why ONE named column may not be published, or `undefined` when it may.
 *
 * The column is followed to every column its value is read from — a lookup
 * or rollup to the related column, a formula to the columns it names — and
 * each is held to the same rules, so a computed column cannot carry onto a
 * public page what its source would be refused for.
 */
interface ExposureContext {
  readonly table: Readonly<TableShape>
  readonly tables: ReadonlyArray<TableShape>
  readonly roles: ReadonlyArray<DefaultRuleRole>
}

const columnExposureError = (
  role: 'displayField' | 'valueField',
  columnName: string,
  { table, tables, roles }: ExposureContext
): string | undefined => {
  const { columns, truncated } = resolveChoiceColumnSources(table.name, columnName, tables)
  if (truncated) {
    return `optionsSource ${role} '${columnName}' on table '${table.name}' is computed over a chain deeper than ${MAX_REACH_DEPTH} columns — its source cannot be vouched for`
  }
  return columns.reduce<string | undefined>((acc, reached, index) => {
    if (acc !== undefined) return acc
    const reason = reachedColumnError(reached, tables, roles)
    if (reason === undefined) return undefined
    return index === 0
      ? `optionsSource ${role} '${columnName}' on table '${table.name}' is ${reason}`
      : `optionsSource ${role} '${columnName}' on table '${table.name}' reads '${reached.table}.${reached.field}', which is ${reason}`
  }, undefined)
}

/** The exposure rules for one resolved source. */
const exposureError = (
  source: Readonly<SelectOptionSource>,
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined => {
  const table = tables.find((candidate) => candidate.name === source.table)
  if (table === undefined) return undefined
  const { valueField } = source
  const context: ExposureContext = { table, tables, roles: defaultRuleRolesFor(form) }
  const columnError =
    columnExposureError('displayField', source.displayField, context) ??
    (valueField === undefined ? undefined : columnExposureError('valueField', valueField, context))
  if (columnError !== undefined) return columnError
  if (isPublicForm(form) && (source.filter ?? []).some((f) => isCurrentUserValue(f.value))) {
    return `optionsSource filter references $currentUser, but form '${form.name}' declares no access.require — nobody is signed in to resolve it`
  }
  return undefined
}

/** The rules a standalone field's `optionsSource` must satisfy before its source is read. */
const standaloneShapeError = (field: Readonly<FieldShape>): string | undefined => {
  if (field.optionsSource === undefined) return undefined
  if (field.options !== undefined) {
    return 'options and optionsSource are mutually exclusive — remove one'
  }
  if (!CHOICE_INPUT_TYPES.has(field.inputType ?? '')) {
    return `optionsSource only applies to a select, multi-select or radio field, not inputType '${field.inputType ?? ''}'`
  }
  return undefined
}

/** The rules a table-bound field must satisfy before its source is read. */
const tableFieldShapeError = (
  field: Readonly<FieldShape>,
  column: Readonly<ColumnShape> | undefined
): string | undefined => {
  if (column === undefined) return undefined
  if (column.type !== 'relationship') {
    return field.optionsSource === undefined
      ? undefined
      : `optionsSource only applies to a relationship column, not column '${column.name}' of type '${column.type ?? 'unknown'}'`
  }
  if (field.optionsSource !== undefined || field.hidden === true) return undefined
  if (column.displayField === undefined) {
    return `relationship column '${column.name}' declares no displayField and the field carries no optionsSource — name the column to show`
  }
  return undefined
}

/** The column a table-bound field writes, looked up on the form's target table. */
const targetColumn = (
  field: Readonly<FieldShape>,
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>
): ColumnShape | undefined => {
  if (field.kind !== 'table-field') return undefined
  const target = tables.find((table) => table.name === form.submitTo.table)
  return target?.fields?.find((candidate) => candidate.name === field.column)
}

/** Validate the source ONE field reads, once its shape is known to be right. */
const sourceError = (
  source: Readonly<SelectOptionSource>,
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>,
  subject: string
): string | undefined => {
  const binding = validateTableOptionSourceBinding(source, tables, `${subject}: optionsSource`)
  if (binding !== undefined) return binding
  const exposure = exposureError(source, form, tables)
  return exposure === undefined ? undefined : `${subject}: ${exposure}`
}

/** Validate ONE field; returns the message, or `undefined`. */
const fieldError = (
  field: Readonly<FieldShape>,
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>,
  subject: string
): string | undefined => {
  const column = targetColumn(field, form, tables)
  const shape =
    field.kind === 'standalone' ? standaloneShapeError(field) : tableFieldShapeError(field, column)
  if (shape !== undefined) return `${subject}: ${shape}`
  // A hidden relationship renders a hidden input carrying its prefill — it
  // reads no table, so there is nothing to publish.
  if (field.hidden === true && field.kind === 'table-field') return undefined
  const source = fieldOptionSource(field, column)
  return source === undefined ? undefined : sourceError(source, form, tables, subject)
}

/**
 * Validate every form field that reads its choices from a table.
 *
 * Returns the first error message, naming the form and the field, or
 * `undefined` when every source may be read and served.
 */
export const validateFormOptionSources = (
  app: AppForFormOptionSourceValidation
): string | undefined => {
  const tables = app.tables ?? []
  return (app.forms ?? []).reduce<string | undefined>((acc, form, formIndex) => {
    if (acc !== undefined) return acc
    return (form.fields ?? []).reduce<string | undefined>((fieldAcc, field) => {
      if (fieldAcc !== undefined) return fieldAcc
      const id = field.kind === 'table-field' ? field.column : field.name
      const subject = `forms[${formIndex}] '${form.name}' field '${id ?? '?'}'`
      return fieldError(field, form, tables, subject)
    }, undefined)
  }, undefined)
}
