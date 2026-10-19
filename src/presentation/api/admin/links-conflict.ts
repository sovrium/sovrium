/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The 409 a link mutation answers when it refuses a slug: the stable `code`
 * the console branches on, prose naming the slug, and — for a taken or
 * reserved slug, or a mint over a config-declared one — the `slug` field named
 * in the caller's console language, so the mint form draws the reason under its
 * Slug control.
 */

import { getCookie } from 'hono/cookie'
import {
  phraseFieldRefusal,
  type FieldRefusalCode,
} from '@/application/use-cases/admin/field-refusal-words'
import { linkMutationConflictSchema } from '@/domain/models/api/admin/links'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { LANGUAGE_PREFERENCE_COOKIE } from '@/domain/models/app/languages/language-detection'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { LinkMutationConflictCode } from '@/application/use-cases/links'
import type { Context } from 'hono'

/**
 * The prose for each refusal, keyed by its discriminant.
 *
 * A table rather than a ternary chain because the enum has three members and
 * the console branches on `code`, never on the message — so the message exists
 * only for the human reading the response, and each one must NAME the slug it
 * refused. A refusal that does not say which slug it means is unactionable when
 * a console posts several.
 */
type ConflictCode = LinkMutationConflictCode

const CONFLICT_MESSAGES: Readonly<Record<ConflictCode, (slug: string) => string>> = {
  LINK_IS_CONFIG_DECLARED: (slug) =>
    `Link '${slug}' is declared in app.links[] and can only be edited in the configuration file.`,
  LINK_SLUG_TAKEN: (slug) => `Link '${slug}' already exists.`,
  LINK_RESERVED_SLUG: (slug) =>
    `Slug '${slug}' is reserved by the admin API and cannot be minted — a link there would ` +
    `resolve publicly while being permanently invisible in the console.`,
}

/**
 * The field words a refusal carries, if any. A mint over a config-declared slug
 * reads as a taken slug: to the person typing it the slug is simply in use,
 * whoever holds it. An edit of the declared link itself names no field — there
 * is no slug to choose again, the configuration file is where it changes.
 */
const fieldWordsFor = (code: ConflictCode, mint: boolean): FieldRefusalCode | undefined => {
  if (code !== 'LINK_IS_CONFIG_DECLARED') return code
  return mint ? 'LINK_SLUG_TAKEN' : undefined
}

/**
 * 409 with the stable discriminant the console branches on; a slug refusal
 * names `slug`. `mint` is set by the create route, the one write whose slug the
 * caller chose.
 */
export const conflict = async (c: Context, code: ConflictCode, slug: string, mint = false) => {
  const userId = getSessionContext(c)?.userId
  const words = fieldWordsFor(code, mint)
  const preferredLanguage = getCookie(c, LANGUAGE_PREFERENCE_COOKIE)
  const phrased =
    words !== undefined && userId !== undefined
      ? await runDomainPromise(
          c,
          phraseFieldRefusal(words, {
            actorUserId: userId,
            ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
          })
        )
      : undefined
  const errors = phrased === undefined ? {} : { errors: phrased }
  const message = CONFLICT_MESSAGES[code](slug)
  const body = decodeOrThrow(linkMutationConflictSchema)({
    success: false,
    code,
    message,
    ...errors,
  })
  return c.json(body, 409)
}
