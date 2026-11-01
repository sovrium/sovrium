/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defaultAuthFields, type AuthFormField } from '@/presentation/design/auth-form-types'
import { callerTableOf, readableFieldsOf } from '@/presentation/render/props/caller-table-inputs'
import { buildResolvedFieldDefs } from './crud-form/crud-form-field-resolver'
import type { ResolvedFieldDef } from './crud-form/crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Picks the native input type for an auth-form field.
 *
 * `email` columns become `<input type="email">`; any field whose name suggests
 * a password (`password`, `confirm_password`, …) becomes `<input
 * type="password">`; everything else falls back to a plain text input.
 */
function resolveInputType(field: ResolvedFieldDef): AuthFormField['inputType'] {
  if (field.type === 'email') return 'email'
  if (/password/i.test(field.name)) return 'password'
  return 'text'
}

/** The table an auth form is bound to (`dataSource.table`), when it names one. */
export function boundTableOf(component: Component | undefined): string | undefined {
  const dataSource = (component as { dataSource?: { table?: unknown } } | undefined)?.dataSource
  return typeof dataSource?.table === 'string' ? dataSource.table : undefined
}

/**
 * The bound table's fields its reader may read, from the per-reader answer the
 * page stamped (`props._callerTable`), as an edit form's controls are: the
 * form draws no input, label or `data-field` for one she may not read.
 * Unchanged without a stamp (no auth, a render outside the page funnel).
 */
function readableDefsOf(
  defs: readonly ResolvedFieldDef[],
  table: Tables[number] | undefined,
  component: Component
): readonly ResolvedFieldDef[] {
  const callerTable = callerTableOf(component)
  if (callerTable === undefined || table === undefined) return defs
  const readable = new Set(readableFieldsOf(table, callerTable))
  return defs.filter((def) => readable.has(def.name))
}

/** The person's name a sign-up form asks for when its `fields` list `name`. */
const NAME_FIELD: AuthFormField = {
  name: 'name',
  label: 'Name',
  required: true,
  inputType: 'text',
  autoComplete: 'name',
}

/**
 * A sign-up form whose action `fields` list `name` asks for the person's name,
 * drawn where the list places it among the fields the form draws (first when
 * listed first). Without it the account is named after its address.
 */
function withListedName(
  fields: readonly AuthFormField[],
  method: string,
  listed: readonly { readonly name: string }[] | undefined
): readonly AuthFormField[] {
  const names = (listed ?? []).map((entry) => entry.name)
  if (method !== 'signup' || !names.includes('name') || fields.some((f) => f.name === 'name'))
    return fields
  const drawn = new Set(fields.map((field) => field.name))
  const at = names.filter((name) => name === 'name' || drawn.has(name)).indexOf('name')
  return [...fields.slice(0, at), NAME_FIELD, ...fields.slice(at)]
}

/**
 * Resolves the list of fields an auth form should render (BEFORE action-level
 * `fields[]` overrides and localization are applied).
 *
 * When the form component is bound to a table via `dataSource.table`, those
 * fields (with their custom labels and placeholders) are resolved against the
 * table so the `required` flag and field type are accurate, less every field
 * its reader may not read. Otherwise the default email/password pair for the
 * method is used, with the name a sign-up form's action `fields` ask for.
 */
export function resolveAuthFormFields(
  method: string,
  tables?: Tables,
  component?: Component,
  action: {
    readonly strategy?: string
    readonly factor?: string
    readonly fields?: readonly { readonly name: string }[]
  } = {}
): readonly AuthFormField[] {
  const tableName = boundTableOf(component)
  if (component && tableName) {
    const table = tables?.find((t) => t.name === tableName)
    const resolved = readableDefsOf(
      buildResolvedFieldDefs(tables, tableName, component),
      table,
      component
    )
    if (resolved.length > 0) {
      return resolved.map((f) => ({
        name: f.name,
        label: f.displayLabel,
        required: f.required ?? false,
        placeholder: f.placeholder,
        inputType: resolveInputType(f),
      }))
    }
  }
  // A second-factor step names its code by `factor`.
  const variant = action.strategy ?? action.factor
  return withListedName(defaultAuthFields(method, variant), method, action.fields)
}
