/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form signature written into the column its field is bound to
 * (`bind: { column }`).
 *
 * The answer is authored when the submission is read
 * (`captureFormSignatures`): the drawing is stored create-only under the
 * evidence key, in the column's bucket, and the version 2 value replaces the
 * answer. That value is tagged there with what its evidence needs (the
 * drawing's digest). The tag is a symbol: no request body, JSON or form, can
 * carry it, and it never reaches the stored answer.
 *
 * When the submission writes the row of `submitTo.table`, every bound field
 * whose answer carries the tag has its value written into its column with the
 * engine's mark, and its evidence recorded in the row write's own transaction.
 * An answer without the tag (one a client composed) is handed to the column
 * as it is, where the write road refuses it naming the column.
 */

import { Effect, Option } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { SignatureEvidenceRecorder } from '@/application/ports/services/signature-evidence-recorder'
import { engineAuthoredSignature } from '@/application/use-cases/tables/signature-write-once-check'
import { flowSignerFieldsOf } from '@/domain/models/app/signatures/signature-flow-fields-service'
import type { DatabaseError } from '@/domain/errors'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/** What a captured form answer carries for its evidence. Never serialised: it is a symbol. */
const FORM_SIGNATURE_EVIDENCE: unique symbol = Symbol('sovrium/signatures/form-evidence')

interface FormSignatureEvidence {
  /** SHA-256 (hex) of the stored drawing, when the signature was drawn. */
  readonly markSha256: string | undefined
}

type TaggedValue = SignatureValueV2 & { readonly [FORM_SIGNATURE_EVIDENCE]: FormSignatureEvidence }

/** `value`, tagged as captured by the server with its evidence. */
export const taggedFormSignature = (
  value: SignatureValueV2,
  evidence: FormSignatureEvidence
): TaggedValue => ({ ...value, [FORM_SIGNATURE_EVIDENCE]: evidence })

/** The value and its evidence, when `value` was captured by the server; `undefined` otherwise. */
const capturedOf = (
  value: unknown
): { readonly value: SignatureValueV2; readonly evidence: FormSignatureEvidence } | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Object.hasOwn(value, FORM_SIGNATURE_EVIDENCE)
  ) {
    return undefined
  }
  const { [FORM_SIGNATURE_EVIDENCE]: evidence, ...stored } = value as TaggedValue
  return { value: stored, evidence }
}

/** The form's signature fields bound to a column: each field's name and its column. */
export const columnBoundSignaturesOf = (
  form: Readonly<Form>
): readonly { readonly name: string; readonly column: string }[] =>
  form.fields.flatMap((field) =>
    field.kind === 'signature' && field.bind !== undefined && 'column' in field.bind
      ? [{ name: field.name, column: field.bind.column }]
      : []
  )

/**
 * Whether a signing flow signs `column` of the form's table through its own
 * links: such a column is the flow's to write, never a form's.
 */
export const isFlowSignedColumn = (
  app: Readonly<App>,
  form: Readonly<Form>,
  column: string
): boolean =>
  form.submitTo.table !== undefined &&
  flowSignerFieldsOf(app.signatures, form.submitTo.table).includes(column)

/** One bound answer, as the row write takes it. */
interface BoundWrite {
  readonly column: string
  /** The value written into the column: marked as the engine's when captured. */
  readonly cell: unknown
  readonly captured:
    { readonly value: SignatureValueV2; readonly evidence: FormSignatureEvidence } | undefined
}

const boundWritesOf = (
  form: Readonly<Form>,
  answers: Readonly<Record<string, unknown>>
): readonly BoundWrite[] =>
  columnBoundSignaturesOf(form).flatMap(({ name, column }) => {
    const answer = answers[name]
    if (answer === undefined || answer === null) return []
    const captured = capturedOf(answer)
    return [
      {
        column,
        cell: captured === undefined ? answer : engineAuthoredSignature(captured.value),
        captured,
      },
    ]
  })

/** Who signed, as the evidence names her: her account's address, when she has one. */
const submitterEmailOf = (submitterUserId: string | undefined) =>
  Effect.gen(function* () {
    if (submitterUserId === undefined) return undefined
    const contact = yield* (yield* AuthRepository).findUserContactById(submitterUserId)
    return contact?.email
  })

/**
 * Run `create`, the write of the submission's row, with the form's bound
 * signatures in its fields and their evidence recorded in its transaction
 * (when the server provides a recorder). A form with no bound answer runs
 * `create` with no extra field.
 */
export const withBoundSignatureColumns = <A, E, R>(
  input: {
    readonly form: Readonly<Form>
    readonly tableName: string
    readonly answers: Readonly<Record<string, unknown>>
    readonly submitterUserId: string | undefined
    readonly userAgent: string | undefined
  },
  create: (columns: Readonly<Record<string, unknown>>) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const writes = boundWritesOf(input.form, input.answers)
    const write = create(Object.fromEntries(writes.map(({ column, cell }) => [column, cell])))
    const captured = writes.flatMap(({ column, captured: found }) =>
      found === undefined ? [] : [{ column, ...found }]
    )
    const recorder = yield* Effect.serviceOption(SignatureEvidenceRecorder)
    if (captured.length === 0 || Option.isNone(recorder)) return yield* write
    const email = yield* submitterEmailOf(input.submitterUserId)
    return yield* captured.reduce<Effect.Effect<A, E | DatabaseError, R>>(
      (inner, { column, value, evidence }) =>
        recorder.value.recordWith(
          {
            ...{ tableName: input.tableName, field: column, value },
            markSha256: evidence.markSha256,
            subject: { email, userAgent: input.userAgent },
          },
          inner
        ),
      write
    )
  }).pipe(
    Effect.withSpan('signatures.with-bound-signature-columns', {
      attributes: { form: input.form.name, tableName: input.tableName },
    })
  )
