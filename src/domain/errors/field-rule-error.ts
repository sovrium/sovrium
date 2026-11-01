/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'

/**
 * The refusals a record write's field rules answer with — the table, form and
 * MCP write paths alike. Each route translates them by `_tag`
 * (`formatValidationError`, the MCP write-tool rules) or by class.
 *
 * `message`/`field` always describe the FIRST offender; `errors` (when present)
 * carries EVERY field the rule refused, in table field-declaration order.
 */

/**
 * One entry of the accumulated `errors` array a refusal carries: the shape of
 * the wire contract's `fieldErrorSchema`, so a client that decodes one decodes
 * the other. Not `ValidationError.details`, whose `record` key indexes across
 * the records of a batch rather than the fields of one record.
 */
export type FieldErrorDetail = {
  readonly field: string
  readonly message: string
}

/** A value a field's rule refuses (400). */
export class FieldValidationError extends Data.TaggedError('FieldValidationError')<{
  readonly message: string
  readonly field?: string
  readonly errors?: readonly FieldErrorDetail[]
}> {}

/**
 * A field-permission denial. It carries NO accumulated `errors` list: its
 * envelope is a bare 404 that drops even the single field name (S1
 * anti-enumeration), so there is nothing for a list to be rendered into.
 */
export class FieldPermissionError extends Data.TaggedError('FieldPermissionError')<{
  readonly message: string
  readonly field?: string
}> {}

/** A value whose format a field refuses (422). */
export class FieldFormatError extends Data.TaggedError('FieldFormatError')<{
  readonly message: string
  readonly field?: string
  readonly errors?: readonly FieldErrorDetail[]
}> {}

/**
 * A storage operation the write path needed in order to honour a field's
 * contract, and could not complete — not a verdict about the payload, which is
 * why it renders as 503 and carries no `errors` list.
 *
 * `cause` is the originating storage error and stays SERVER-SIDE: the envelope
 * emits only `message` and `code` (S4). `Data.TaggedError`'s `toJSON` spreads
 * every argument, so this one leaves `cause` out of its serialized form: a
 * lost object, rotated credentials and an object store that is down are none
 * of a log reader's or a client's business at this seam.
 */
export class FieldStorageError extends Data.TaggedError('FieldStorageError')<{
  readonly message: string
  readonly field: string | undefined
  readonly cause: unknown
}> {
  override toJSON(): unknown {
    const { cause: _cause, ...serialized } = super.toJSON() as Readonly<Record<string, unknown>>
    return serialized
  }
}
