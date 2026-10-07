/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Refuse an update that would change a `signature` already stored.
 *
 * The rule is the domain's (`signature-write-once-validation.ts`); this reads
 * the row as it stands — only when the update names a signature field — and
 * fails with a `ValidationError` naming the field, before anything is written.
 */

import { Effect } from 'effect'
import { ValidationError } from '@/domain/errors'
import { signatureOverwriteOf } from '@/domain/models/app/tables/fields/field-types/media/signature-write-once-validation'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

export const refuseSignatureOverwrite = (input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly held: Effect.Effect<Readonly<Record<string, unknown>> | null | undefined, DatabaseError>
}): Effect.Effect<void, ValidationError | DatabaseError> =>
  Effect.gen(function* () {
    const tableFields = (input.app?.tables?.find((t) => t.name === input.tableName)?.fields ??
      []) as readonly { readonly name: string; readonly type: string }[]
    const named = tableFields.some(
      (field) => field.type === 'signature' && Object.hasOwn(input.fields, field.name)
    )
    if (!named) return
    const held = yield* input.held
    const field = signatureOverwriteOf({ fields: tableFields, held, update: input.fields })
    if (field === undefined) return
    return yield* Effect.fail(
      new ValidationError(`${field} is already signed and cannot be changed`, [
        { record: 0, field, error: 'A signature cannot be changed once stored' },
      ])
    )
  }).pipe(Effect.withSpan('tables.refuse-signature-overwrite'))
