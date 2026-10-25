/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The template catalogue the binary embeds — `src/templates/catalog.json` — read
 * and decoded in ONE place.
 *
 * `sovrium init` reads it for the names `--template` accepts and for which of
 * them grow a `public/`; `sovrium templates` reads it to print the list. Both
 * go through {@link readEmbeddedTemplateCatalog}, so the list a developer is
 * shown and the names `init` accepts can never disagree.
 *
 * The file's key order is the gallery order, and the decode keeps it: callers
 * iterate `Object.entries` of the result and get the catalogue order back.
 *
 * A catalogue that is missing or does not decode is a BUILD defect — the file
 * is committed and embedded at build time — so the failure carries a message
 * naming what is wrong, and the CLI reports it and exits 1.
 */

import { readFileSync } from 'node:fs'
import { Data, Effect, Schema } from 'effect'
import { embeddedTemplateRootFile } from '@/infrastructure/assets/embedded-static-assets'

/** One catalogue entry: every field required except `headless`. */
const TemplateCatalogEntrySchema = Schema.Struct({
  name: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  category: Schema.NonEmptyString,
  topics: Schema.NonEmptyArray(Schema.String),
  headless: Schema.optionalKey(Schema.Boolean),
})

/** The catalogue: template slug → entry, in gallery order. */
export const TemplateCatalogSchema = Schema.Record(Schema.String, TemplateCatalogEntrySchema)

export type TemplateCatalogEntry = typeof TemplateCatalogEntrySchema.Type
export type TemplateCatalog = typeof TemplateCatalogSchema.Type

/** The embedded catalogue is missing, unreadable or malformed. */
export class TemplateCatalogError extends Data.TaggedError('TemplateCatalogError')<{
  readonly message: string
}> {}

/** The manifest key the catalogue is embedded under. */
const CATALOG_KEY = 'catalog.json'

/**
 * Whether a template is headless — an API or an MCP server rather than a
 * website, so its scaffold grows no `public/`.
 *
 * The catalogue's own `headless` flag decides. An entry that does not carry
 * the flag falls back to its `headless` topic, which every headless template
 * already lists; the fallback is harmless once every headless entry carries
 * the flag, and keeps an entry written without it from silently turning into
 * a website.
 */
export const isHeadlessEntry = (
  entry: Pick<TemplateCatalogEntry, 'headless'> & { readonly topics: readonly string[] }
): boolean => entry.headless ?? entry.topics.includes('headless')

/**
 * Decode catalogue text. Pure: the reader below and the unit tests share it.
 */
export const decodeTemplateCatalog = (
  text: string
): Effect.Effect<TemplateCatalog, TemplateCatalogError> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (cause) =>
      new TemplateCatalogError({ message: `The template catalogue is not JSON: ${String(cause)}` }),
  }).pipe(
    Effect.flatMap((raw) => Schema.decodeUnknownEffect(TemplateCatalogSchema)(raw)),
    Effect.mapError((error) =>
      error instanceof TemplateCatalogError
        ? error
        : new TemplateCatalogError({
            message: `The template catalogue does not decode: ${error.message}`,
          })
    )
  )

/**
 * Read and decode the catalogue the binary embeds.
 *
 * The read is synchronous on purpose: `Bun`'s `node:fs` resolves the
 * `$bunfs/...` path of the compiled binary as it resolves a real path in dev,
 * and `init` consults the catalogue from synchronous validation code.
 */
export const readEmbeddedTemplateCatalog: Effect.Effect<TemplateCatalog, TemplateCatalogError> =
  Effect.suspend(() => {
    const path = embeddedTemplateRootFile(CATALOG_KEY)
    if (path === undefined)
      return Effect.fail(
        new TemplateCatalogError({
          message: `The binary embeds no ${CATALOG_KEY}: this build is incomplete.`,
        })
      )
    return Effect.try({
      try: () => readFileSync(path, 'utf8'),
      catch: (cause) =>
        new TemplateCatalogError({
          message: `The embedded ${CATALOG_KEY} cannot be read: ${String(cause)}`,
        }),
    }).pipe(Effect.flatMap(decodeTemplateCatalog))
  }).pipe(Effect.withSpan('cli.templates.readCatalog'))
