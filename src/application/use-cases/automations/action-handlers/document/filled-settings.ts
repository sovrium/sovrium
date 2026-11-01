/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter, Struct } from 'effect'
import { DocumentOutputSchema } from '@/domain/models/app/automations/actions/document/shared'

/**
 * The FILLED shape of the settings the file-handling actions (`document/*`,
 * `pdf/*`, `file/*`, `browser/*`) take, beside the shape they are authored in.
 *
 * An action's schema describes its props as WRITTEN: a template is text. Its
 * handler receives them FILLED IN, and a whole `{{path}}` in a step of a `loop`
 * or a `path` keeps the type of what it names — a record id is a number, a
 * missing value is `undefined`, an empty field is `null`. So the dispatch shape
 * of these actions (see `../decoded-handler.ts`) takes the declared props, with
 * each template-filled one in the shape a template can fill it with:
 *
 * - {@link FilledText}: a template's text — any scalar a whole template names,
 *   as the text it is written out as (`null` as nothing);
 * - {@link FilledFileRef}: a file reference — anything; whether it names a file
 *   this run may read is judged where it is read (`file-ref.ts`), with who
 *   chose it (`../file/ref-origin.ts`);
 * - {@link FilledDocumentOutput}: an `output`, its name, key and record filled.
 */

/** A scalar a whole template named, as the text it is written out as; `null` as nothing. */
const scalarText = <S extends Schema.Top>(scalars: S) =>
  scalars.pipe(
    Schema.decodeTo(Schema.String, {
      decode: SchemaGetter.transform((value) =>
        value === null || value === undefined ? '' : String(value)
      ),
      encode: SchemaGetter.transform((value) => value),
    })
  )

/**
 * A required template field, filled in: any scalar as its text, and a value
 * the run does not hold (`null`, `undefined`) as nothing, read as an empty
 * value as it always was.
 */
export const FilledText = scalarText(
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null, Schema.Undefined])
)

/** An optional template field, filled in: absent stays absent; `null` reads as nothing. */
export const OptionalFilledText = Schema.optional(
  scalarText(Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]))
)

/** A file reference as a template may fill it: judged where it is read. */
export const FilledFileRef = Schema.Unknown

/** `output`, its template fields filled. */
export const FilledDocumentOutput = DocumentOutputSchema.mapFields(
  Struct.assign({
    filename: FilledText,
    key: OptionalFilledText,
    attachTo: Schema.optional(
      DocumentOutputSchema.fields.attachTo.schema.members[0].mapFields(
        Struct.assign({ record: FilledText })
      )
    ),
  })
)

/** The dispatch shape of an action whose props are one struct, its `filled` fields replaced. */
export const filledSettings = <
  Type extends Schema.Top,
  Operator extends Schema.Top,
  Fields extends Schema.Struct.Fields,
  Filled extends Schema.Struct.Fields,
>(
  action: {
    readonly fields: {
      readonly type: Type
      readonly operator: Operator
      readonly props: Schema.Struct<Fields>
    }
  },
  filled: Filled
) =>
  Schema.Struct({
    type: action.fields.type,
    operator: action.fields.operator,
    props: action.fields.props.mapFields(Struct.assign(filled), { unsafePreserveChecks: true }),
  })

/** An `output` as its handler reads it. */
export type FilledOutput = typeof FilledDocumentOutput.Type
