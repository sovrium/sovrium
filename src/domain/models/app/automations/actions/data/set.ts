/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/** A `fields` name: what a later step writes after `.result.` to read it back. */
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

/**
 * The names a step's output may not hold: `result` is the alias every step
 * output is ALSO read under (`{{step.result.x}}`), and an output that already
 * carries a `result` key is passed through without that alias — so a field
 * named `result` would silently break every other field's `.result.<name>` read.
 */
const RESERVED_FIELD_NAMES: ReadonlySet<string> = new Set(['result'])

/** The `fields` names that break the naming rule, in authored order. */
const invalidFieldNames = (fields: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(fields).filter((name) => !FIELD_NAME.test(name) || RESERVED_FIELD_NAMES.has(name))

/**
 * Why the props of a `data/set` step are refused, or `undefined` when they hold.
 *
 * The rule lives on the props rather than on the record's KEY schema because an
 * Effect `Schema.Record` silently DROPS an entry whose key fails its key schema:
 * the author would get a green `validate` and a missing field. Here a bad name
 * survives the decode and is named in the message.
 */
const dataSetPropsProblem = (props: {
  readonly value?: string | undefined
  readonly fields?: Readonly<Record<string, unknown>> | undefined
}): string | undefined => {
  if ((props.value === undefined) === (props.fields === undefined)) {
    return 'data/set takes exactly one of `value` and `fields`'
  }
  if (props.fields === undefined) return undefined
  if (Object.keys(props.fields).length === 0) {
    return 'data/set `fields` needs at least one field'
  }
  const invalid = invalidFieldNames(props.fields)
  if (invalid.length === 0) return undefined
  return `data/set field names start with a letter or an underscore, hold only letters, digits and underscores, are at most 64 characters long, and \`result\` is reserved; refused: ${invalid.map((name) => `\`${name}\``).join(', ')}`
}

/**
 * Data Set Action (type: data, operator: set)
 *
 * Two forms, exactly one per step:
 *
 * - `value` — one template-resolved value, read back as `steps.<name>.value`
 *   (also `{{<name>.result.value}}`).
 * - `fields` — named values, read back as `{{<name>.result.<field>}}` (also
 *   `{{steps.<name>.<field>}}`). A string is a template: a lone `{{path}}`
 *   keeps the type of what it names, text around a reference makes a string.
 *   A number, boolean, null, list or object is kept as authored, and the
 *   strings inside a list or object are templates too. The n8n "Edit Fields
 *   (Set)" and Make "Set variable(s)" equivalent.
 */
export const DataSetActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('data').pipe(
    Schema.annotate({
      description: "Constant value 'data' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('set').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'data' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Value to compute and expose as `steps.<name>.value` (supports templates) */
    value: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'One value to compute and expose as steps.<name>.value (supports templates). Exactly one of value and fields.',
        })
      )
    ),
    /** Named values exposed as `{{<name>.result.<field>}}` */
    fields: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
          description:
            'Named values a later step reads as {{<step>.result.<field>}}. A string is a template: a lone {{path}} keeps the type of what it names. A number, boolean, null, list or object is kept as written, and strings inside a list or object are templates. A name starts with a letter or an underscore, holds only letters, digits and underscores, is at most 64 characters long, and is not `result`. Exactly one of value and fields.',
        })
      )
    ),
  })
    .annotate({
      description: 'What to store for later steps to read: one value, or named fields.',
    })
    .pipe(Schema.check(Schema.makeFilter(dataSetPropsProblem))),
}).pipe(
  Schema.annotate({
    identifier: 'DataSetAction',
    title: 'Data Set Action',
    description: 'Compute a value, or named fields, and expose them for downstream actions',
  })
)

/** @public */
export type DataSetAction = Schema.Schema.Type<typeof DataSetActionSchema>
