/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentPropsSchema } from '../../components/props'

/**
 * Component i18n (internationalization) schema
 *
 * Localized translations per language for a component. Each key is an
 * ISO 639-1 language code (e.g., "en", "fr-FR") mapping to translated
 * content and/or props overrides.
 *
 * @example
 * ```yaml
 * i18n:
 *   fr:
 *     content: Bienvenue
 *     props:
 *       className: text-lg font-bold
 *   es:
 *     content: Bienvenido
 * ```
 */
/**
 * The accepted shape of one `i18n` key: a language code, optionally with a
 * region (`fr`, `fr-FR`). The key names the language the entry translates
 * into, so it is expected to be one of the codes the app declares in
 * `languages.supported`.
 */
const I18N_LANGUAGE_KEY_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/

const ComponentI18nKeySchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Component I18n Language Key',
    description:
      'Language code the entry translates into: two lowercase letters, optionally followed by a hyphen and a two-letter uppercase region (pattern `^[a-z]{2}(-[A-Z]{2})?$`). Use one of the codes declared in `languages.supported`.',
    examples: ['fr', 'es', 'fr-FR', 'en-US'],
  }),
  Schema.check(
    Schema.isPattern(I18N_LANGUAGE_KEY_PATTERN, {
      message:
        'Language code must be two lowercase letters, optionally followed by a hyphen and a two-letter uppercase region (pattern ^[a-z]{2}(-[A-Z]{2})?$, e.g. fr, fr-FR)',
    })
  )
)

/**
 * ─── A MISTYPED KEY IS REFUSED, NEVER DROPPED ─────────────────────────────
 *
 * Under Effect 4 a `Schema.Record` whose KEY schema carries a pattern does not
 * fail on a key that misses the pattern: it skips it. With the default decode
 * options the entry vanishes from the output (`FR:` instead of `fr:` silently
 * loses the French translation); under the app pipeline's
 * `onExcessProperty: 'error'` it surfaces only as an unexplained unknown
 * property, with nothing saying which spelling is accepted.
 *
 * So the key position accepts any string, and the pattern is enforced by
 * `Schema.isPropertyNames` over the decoded record. That check reports every
 * offending key at its own path with the pattern message above, under every
 * set of decode options. Its JSON Schema rendering is overridden so the
 * published `propertyNames` keeps the pattern (the default rendering emits the
 * key's encoded side, which carries no refinement).
 */
export const ComponentI18nSchema = Schema.Record(
  Schema.String,
  Schema.Struct({
    content: Schema.optional(
      Schema.String.annotate({
        description: 'Translated content text',
      })
    ),
    props: Schema.optional(ComponentPropsSchema),
  })
).pipe(
  // The check comes BEFORE the identifier-bearing annotation on purpose: an
  // identifier annotated first and then wrapped by a check is inlined, and the
  // published `ComponentI18n` definition disappears. `isPropertyNames` renders
  // its own JSON Schema, so nothing it carries is lost by going first.
  Schema.check(
    Schema.isPropertyNames(ComponentI18nKeySchema, {
      toJsonSchema: () => ({
        propertyNames: { type: 'string', pattern: I18N_LANGUAGE_KEY_PATTERN.source },
      }),
    })
  ),
  Schema.annotate({
    identifier: 'ComponentI18n',
    title: 'Component I18n',
    description:
      'Localized translations per language for this component. Each key is a language code declared in `languages.supported` (`fr`, `fr-FR`); a key that is not a language code is refused.',
  })
)

/** @public */
export type ComponentI18n = Schema.Schema.Type<typeof ComponentI18nSchema>
