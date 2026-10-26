/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which hidden fields with a default keep only what the server rendered.
 *
 * A field declared `hidden: true` with a `defaultValue` is drawn as a hidden
 * input holding what its prefill resolves to — the form's own `prefill`, or the
 * `inlinePrefill` of a page embedding the form — and posted back like any other
 * input. The visitor never chose it, so the submission keeps it only when the
 * server could have rendered it for this submitter, re-derived from the
 * configuration; anything else stores the default.
 *
 * This module is the form's pure half: which fields are held this way, keyed
 * by the identifier the submission carries them under, and the form's own
 * sources for each. A hidden `relationship` or `user` field is left to the
 * stricter hidden-link pin (`hidden-link-pin-service.ts`), and a lookup
 * default (an object) is resolved apart; neither is listed here.
 */

import { fieldSubmitIdentifier } from '@/domain/models/app/forms/form-field-helpers'
import {
  classifyPinSource,
  type PinSource,
} from '@/domain/models/app/forms/hidden-link-pin-service'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** One hidden field with a default: the key it is submitted under, and the form's own sources. */
export interface DefaultPinnedField {
  /** The submitted key: the column of a table field, the name of a standalone one. */
  readonly key: string
  /** The form's own `prefill` entry for the field (when it names one), then its default. */
  readonly formSources: readonly PinSource[]
}

/** Classify a prefill value a scalar field could hold: a boolean is the text it renders as. */
export const classifyScalarSource = (value: unknown): PinSource =>
  typeof value === 'boolean'
    ? { kind: 'literal', values: [String(value)] }
    : classifyPinSource(value)

/**
 * What the default itself vouches for. A `$query` or record token in a default
 * is resolved by the defaults overlay, never trusted as "any value".
 */
const defaultSourceOf = (value: unknown): PinSource => {
  const source = classifyScalarSource(value)
  return source.kind === 'query' || source.kind === 'record' ? { kind: 'none' } : source
}

type FieldShape = {
  readonly kind?: unknown
  readonly column?: unknown
  readonly name?: unknown
  readonly hidden?: unknown
  readonly defaultValue?: unknown
}

const isScalar = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

/** The columns of the form's table that hold a link or an account. */
const linkColumnsOf = (app: App, form: Form): ReadonlySet<string> =>
  new Set(
    (app.tables?.find((table) => table.name === form.submitTo.table)?.fields ?? [])
      .filter((field) => field.type === 'relationship' || field.type === 'user')
      .map((field) => field.name)
  )

/**
 * The fields of `form` declared `hidden: true` with a scalar `defaultValue`,
 * other than a link or an account, each with the form's own sources for it.
 */
export const defaultPinnedFieldsOf = (app: App, form: Form): readonly DefaultPinnedField[] => {
  const links = linkColumnsOf(app, form)
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, unknown>> }
  return (form.fields as readonly FieldShape[]).flatMap((field) => {
    if (field.hidden !== true || !isScalar(field.defaultValue)) return []
    const key = fieldSubmitIdentifier(field as Parameters<typeof fieldSubmitIdentifier>[0])
    if (key === undefined || (field.kind === 'table-field' && links.has(key))) return []
    const own = prefill !== undefined && key in prefill ? [classifyScalarSource(prefill[key])] : []
    return [{ key, formSources: [...own, defaultSourceOf(field.defaultValue)] }]
  })
}

/**
 * The text a submitted value is compared as, or `undefined` for an empty
 * value, a list or anything else a scalar hidden field never renders.
 */
export const submittedScalarOf = (value: unknown): string | undefined =>
  isScalar(value) && value !== '' ? String(value) : undefined

/** Whether any of `sources` reads the query string, which the visitor writes. */
export const acceptsAnyValue = (sources: readonly PinSource[]): boolean =>
  sources.some((source) => source.kind === 'query')

/**
 * Every source the form itself names for hidden field `key` — its `prefill`
 * entry and its default, a `$query` default included as the query string it
 * reads — or `undefined` when `key` is not a hidden field with a default.
 * The pages embedding the form are the caller's to add.
 */
export const formOwnSourcesOf = (
  app: App,
  form: Form,
  key: string
): readonly PinSource[] | undefined => {
  const pinned = defaultPinnedFieldsOf(app, form).find((field) => field.key === key)
  if (pinned === undefined) return undefined
  const field = (form.fields as readonly FieldShape[]).find(
    (candidate) =>
      fieldSubmitIdentifier(candidate as Parameters<typeof fieldSubmitIdentifier>[0]) === key
  )
  return [...pinned.formSources, classifyScalarSource(field?.defaultValue)]
}
