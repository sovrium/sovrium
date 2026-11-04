/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The signature answers of a form submission, authored by the server.
 *
 * A form `kind: signature` field is answered with the drawing as PNG bytes (a
 * multipart file part named after the field) and the signer's consent
 * (`<name>.consent` = `true`), or with a typed name (`<name>.typedName`) and
 * the consent. The server checks the image, stores it create-only under the
 * evidence namespace and replaces the answer with a version 2 value: the
 * statement is the field's `statement`, else its label, never text from the
 * request; the instant is the server's; the signer is her account when she is
 * signed in, else nobody beyond the form.
 *
 * Any other value for the field — a data URL, a JSON object a client composed —
 * is refused naming the field, before anything is stored. An answer that
 * `submitTo.mapping` would write onto a table column is refused naming that
 * column: only the engine writes a signature column.
 *
 * A field bound to a column (`bind: { column }`) stores its drawing in that
 * column's bucket, and its value is tagged for the row write to store in the
 * column (`form-signature-columns.ts`). A column a signing flow has come to
 * sign through its links is refused naming the column, before anything is
 * stored: it is the flow's to write.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { StorageService, type StorageError } from '@/application/ports/services/storage-service'
import { FormFieldFormatError } from '@/application/use-cases/forms/submit-form-format-validation'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import {
  capturedSignatureValue,
  isAcceptableSignatureImage,
  signatureEvidenceImageKey,
} from '@/domain/models/app/signatures/signature-capture-service'
import { sha256Hex } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import {
  columnBoundSignaturesOf,
  isFlowSignedColumn,
  taggedFormSignature,
} from './form-signature-columns'
import { nowInstant } from './signature-request-effects'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

type Body = Readonly<Record<string, unknown>>

type Requirements = AuthRepository | StorageService

interface SignatureQuestion {
  readonly name: string
  /** The table column `submitTo.mapping` writes the answer onto, when it does. */
  readonly mappedTo: string | undefined
  readonly statement?: string | undefined
  readonly label?: string | undefined
  /** The column of `submitTo.table` the field is bound to, when it is. */
  readonly column: string | undefined
}

/** Who submits: her account, when she is signed in. */
interface Submitter {
  readonly userId: string
}

const refuse = (fieldName: string, message: string) =>
  Effect.fail(new FormFieldFormatError({ fieldName, message }))

/** The form's signature questions. */
const signatureQuestionsOf = (form: Readonly<Form>): readonly SignatureQuestion[] => {
  const bound = columnBoundSignaturesOf(form)
  return form.fields.flatMap((field) =>
    field.kind === 'signature'
      ? [
          {
            ...{ name: field.name, statement: field.statement, label: field.label },
            mappedTo: (form.submitTo.mapping as Readonly<Record<string, string>> | undefined)?.[
              field.name
            ],
            column: bound.find((binding) => binding.name === field.name)?.column,
          },
        ]
      : []
  )
}

/** Where a question's drawing is stored: its column's bucket, else the system bucket. */
const bucketOf = (app: Readonly<App>, form: Readonly<Form>, question: SignatureQuestion) =>
  (question.column === undefined || form.submitTo.table === undefined
    ? undefined
    : resolveFieldBucket(app, form.submitTo.table, question.column)) ?? SYSTEM_BUCKET_NAME

/** The body without the consent and typed-name parts of `name`. */
const withoutSigningParts = (body: Body, name: string): Body =>
  Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== `${name}.consent` && key !== `${name}.typedName`)
  )

/** The name a form signature carries: the one typed, else the submitter's account's. */
const signerNameOf = (typedName: string | undefined, submitter: Submitter | undefined) =>
  Effect.gen(function* () {
    if (typedName !== undefined) return typedName
    if (submitter === undefined) return ''
    const contact = yield* (yield* AuthRepository).findUserContactById(submitter.userId)
    return contact?.name ?? ''
  })

/** Read, check and store the drawing in `bucket`; its key and digest. */
const storedDrawing = (
  name: string,
  file: File,
  stored: {
    readonly submitter: Submitter | undefined
    readonly id: string
    readonly bucket: string
  }
) =>
  Effect.gen(function* () {
    const { submitter, id, bucket } = stored
    const bytes = new Uint8Array(
      yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () => new FormFieldFormatError({ fieldName: name, message: 'Unreadable signature' }),
      })
    )
    if (!isAcceptableSignatureImage(bytes)) {
      return yield* refuse(name, 'The signature must be a PNG within the size and dimension limits')
    }
    const key = signatureEvidenceImageKey(id)
    yield* (yield* StorageService).upload(key, bytes, 'image/png', {
      ...{ bucket, uploadedById: submitter?.userId },
      mode: 'create-only',
    })
    return { key, markSha256: sha256Hex(bytes) }
  })

/** What the submitter sent for one signature question. */
interface Answer {
  readonly drawn: unknown
  readonly typedName: string | undefined
  readonly consent: boolean
}

const answerOf = (body: Body, name: string): Answer => {
  const typed = body[`${name}.typedName`]
  return {
    drawn: body[name],
    typedName: typeof typed === 'string' && typed.trim() !== '' ? typed.trim() : undefined,
    consent: body[`${name}.consent`] === 'true',
  }
}

/** The answer's drawing, once the answer may be signed; a refusal otherwise. */
const signableDrawing = (
  name: string,
  answer: Answer
): Effect.Effect<File | undefined, FormFieldFormatError> => {
  if (answer.drawn !== undefined && !(answer.drawn instanceof File)) {
    return refuse(name, 'A signature is drawn in the signing well; a value cannot be sent')
  }
  return answer.consent
    ? Effect.succeed(answer.drawn as File | undefined)
    : refuse(name, 'Agree to the statement before signing')
}

/** The statement on record: the field's `statement`, else its label. */
const statementOf = (question: SignatureQuestion): string =>
  question.statement ?? question.label ?? ''

/** Whether the question was left unanswered (no drawing, no typed name). */
const unanswered = (answer: Answer): boolean =>
  answer.drawn === undefined && answer.typedName === undefined

type Scope = { readonly app: Readonly<App>; readonly form: Readonly<Form> }

/**
 * The refusal of a question whose answer would write a column the form may not
 * write: one `submitTo.mapping` names, or one a signing flow signs.
 */
const columnRefusal = (scope: Scope, question: SignatureQuestion) => {
  // Only the engine writes a signature column: a mapped answer is refused naming the column.
  if (question.mappedTo !== undefined) {
    return refuse(question.mappedTo, 'A signature column is not written by a form mapping')
  }
  const { column } = question
  return column !== undefined && isFlowSignedColumn(scope.app, scope.form, column)
    ? refuse(column, 'This signature column is signed through its signing flow')
    : Effect.void
}

/** One signature question answered: the body with its answer authored, or a refusal. */
const answerOne = (
  scope: Scope,
  body: Body,
  question: SignatureQuestion,
  submitter: Submitter | undefined
): Effect.Effect<Body, FormFieldFormatError | AuthDatabaseError | StorageError, Requirements> =>
  Effect.gen(function* () {
    const { name, column } = question
    const answer = answerOf(body, name)
    const rest = withoutSigningParts(body, name)
    if (unanswered(answer)) return rest
    yield* columnRefusal(scope, question)
    const drawn = yield* signableDrawing(name, answer)
    const evidenceId = crypto.randomUUID()
    const bucket = bucketOf(scope.app, scope.form, question)
    const mark =
      drawn === undefined
        ? undefined
        : yield* storedDrawing(name, drawn, { submitter, id: evidenceId, bucket })
    const value = capturedSignatureValue({
      ...{ evidenceId, image: mark?.key ?? '' },
      signerName: yield* signerNameOf(answer.typedName, submitter),
      signedAt: (yield* nowInstant).iso,
      statement: statementOf(question),
      method: drawn === undefined ? 'typed' : 'drawn',
      userId: submitter?.userId,
    })
    return {
      ...rest,
      [name]:
        column === undefined ? value : taggedFormSignature(value, { markSha256: mark?.markSha256 }),
    }
  })

/** The submission body with every signature answer authored by the server. */
export const captureFormSignatures = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Body,
  submitter: Submitter | undefined
) =>
  Effect.reduce(
    signatureQuestionsOf(form),
    (): Body => body,
    (answered, question) => answerOne({ app, form }, answered, question, submitter)
  ).pipe(Effect.withSpan('signatures.capture-form-signatures', { attributes: { form: form.name } }))
