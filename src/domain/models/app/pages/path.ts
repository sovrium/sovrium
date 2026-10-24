/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PathSchema as CommonPathSchema } from '@/domain/kernel/identity/definitions'

/**
 * A page path per language, keyed by language code: one page, a translated
 * slug in each language.
 *
 * `{ en: /manifesto, fr: /manifeste }` serves the page at `/en/manifesto` and
 * `/fr/manifeste`: the engine adds the `/{lang}` prefix, so each value is the
 * path WITHOUT it. Dynamic segments work as in a plain path
 * (`{ en: /blog/:slug, fr: /articles/:slug }`).
 *
 * The keys are plain strings on purpose: an Effect `Schema.Record` whose key
 * schema refuses a key DROPS that entry silently instead of failing. Which
 * codes are allowed depends on `languages.supported`, so the check lives with
 * the app-level cross-validation (`localized-path-validation.ts`), where an
 * unknown code is refused by name.
 */
export const LocalizedPagePathSchema = Schema.Record(Schema.String, CommonPathSchema).pipe(
  Schema.annotate({
    title: 'Path per language',
    description:
      'A path for each language, keyed by language code. The engine adds the /{lang} prefix, so each value is written without it; a value containing a :lang segment is refused.',
    examples: [
      { en: '/manifesto', fr: '/manifeste' },
      { en: '/blog/:slug', fr: '/articles/:slug' },
    ],
  }),
  Schema.check(
    Schema.makeFilter((paths: Readonly<Record<string, string>>) =>
      Object.keys(paths).length > 0 ? true : 'A path per language must name at least one language'
    )
  )
)

/**
 * URL Path (where the page is accessible)
 *
 * Either one path string, shared by every language — the common Path schema
 * from definitions — or a {@link LocalizedPagePathSchema} map giving each
 * language its own translated slug. A plain string keeps its meaning
 * unchanged: a path that names no language is served under every language
 * prefix, and a path starting with a language code (`/fr/pricing`) is that
 * language's page only.
 *
 * @see [internal ref]#/definitions/path
 */
export const PagePathSchema = Schema.Union([CommonPathSchema, LocalizedPagePathSchema]).annotate({
  title: 'Page path',
  description:
    'URL path where the page is served: one path for every language, or a map of one path per language code (translated slugs).',
})

/** @public */
export type PagePath = typeof PagePathSchema.Type
