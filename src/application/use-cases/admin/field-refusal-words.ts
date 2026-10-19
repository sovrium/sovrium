/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words a console write refusal says on the FIELD it is about, in the
 * operator's console language.
 *
 * A form drawing a refusal under its field cannot word it itself: it does not
 * know which refusal a code means. The server does, so it names the field and
 * phrases the reason in the language the operator's console is composed in
 * (`resolveOperatorLanguage`), in the shape every field refusal takes
 * (`{ field, message }`).
 */

import { Effect } from 'effect'
import { resolveOperatorLanguage, type ConsoleLanguage } from './operator-language'
import type { AccountRepository } from '@/application/ports/repositories/auth/account-repository'
import type { AdminReadRequest } from '@/application/use-cases/admin/admin-read-operation'

/** A refusal that is about one field of the request. */
export type FieldRefusalCode = 'LINK_SLUG_TAKEN' | 'LINK_RESERVED_SLUG' | 'EMAIL_ALREADY_REGISTERED'

/** One field refusal, as the wire carries it. */
export interface FieldRefusal {
  readonly field: string
  readonly message: string
}

const REFUSALS: Readonly<
  Record<
    FieldRefusalCode,
    { readonly field: string; readonly words: Readonly<Record<ConsoleLanguage, string>> }
  >
> = {
  LINK_SLUG_TAKEN: {
    field: 'slug',
    words: {
      en: 'This slug is already taken. Choose another one.',
      fr: 'Ce slug est déjà pris. Choisis-en un autre.',
    },
  },
  LINK_RESERVED_SLUG: {
    field: 'slug',
    words: {
      en: 'This slug is reserved. Choose another one.',
      fr: 'Ce slug est réservé. Choisis-en un autre.',
    },
  },
  EMAIL_ALREADY_REGISTERED: {
    field: 'email',
    words: {
      en: 'This address already belongs to a member. They can reset their password from the sign-in page.',
      fr: 'Cette adresse appartient déjà à un membre. Il peut réinitialiser son mot de passe depuis la page de connexion.',
    },
  },
}

/** The field `code` is about, worded in `language`. */
export const fieldRefusalIn = (
  code: FieldRefusalCode,
  language: ConsoleLanguage
): readonly FieldRefusal[] => [
  { field: REFUSALS[code].field, message: REFUSALS[code].words[language] },
]

/**
 * The field `code` is about, worded in the operator's console language. A
 * failed language read is logged and falls back to English: the words are
 * presentation, the refusal they explain stands either way.
 */
export const phraseFieldRefusal = (
  code: FieldRefusalCode,
  request: Pick<AdminReadRequest, 'actorUserId' | 'preferredLanguage'>
): Effect.Effect<readonly FieldRefusal[], never, AccountRepository> =>
  resolveOperatorLanguage(request).pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('operator language read failed; refusal worded in English', cause)
    ),
    Effect.orElseSucceed((): ConsoleLanguage => 'en'),
    Effect.map((language) => fieldRefusalIn(code, language)),
    Effect.withSpan('admin.phrase-field-refusal')
  )
