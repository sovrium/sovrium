/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `llms.txt` / `llms-full.txt` half of `sovrium build`.
 *
 * Its own module rather than another block in `generate-static-helpers.ts`
 * because locale scoping turned one pair of files into one pair PER DECLARED
 * LANGUAGE, and a build writer that has to agree route-for-route with
 * `setupSeoRoutes` is easier to keep honest when it reads as one page.
 */

import { Effect } from 'effect'
import { StaticGenerationError } from '@/application/errors/static-generation-error'
import { logDebug } from '@/infrastructure/logging'
import { generateLlmsFullTxtContent, generateLlmsTxtContent } from './static-content-generators'
import type { GenerateStaticOptions } from './generate-static'
import type { FileSystemLike } from './generate-static-helpers'
import type { App } from '@/domain/models/app'

/** One locale's llms documents: which locale, and where under the output root. */
interface LlmsLocaleTarget {
  /** The locale to scope both documents to; `undefined` means every page. */
  readonly language: string | undefined
  /** Path prefix under the output root — `''` for the root pair, `'fr/'` for a code. */
  readonly prefix: string
}

/** The ambient dependencies every llms write shares. */
interface LlmsWriteContext {
  readonly outputDir: string
  readonly baseUrl: string
  readonly fs: FileSystemLike
}

/** Write one locale's `llms-full.txt` (gated on `app.llms.full !== false`). */
function writeLlmsFullFile(app: App, target: LlmsLocaleTarget, context: LlmsWriteContext) {
  const name = `${target.prefix}llms-full.txt`
  return Effect.suspend(() =>
    app.llms?.full !== false
      ? Effect.gen(function* () {
          const full = yield* Effect.tryPromise({
            try: () => generateLlmsFullTxtContent(app, target.language),
            catch: (error) =>
              new StaticGenerationError({ message: `Failed to generate ${name}`, cause: error }),
          })
          yield* Effect.tryPromise({
            try: () => context.fs.writeFile(`${context.outputDir}/${name}`, full, 'utf-8'),
            catch: (error) =>
              new StaticGenerationError({ message: `Failed to write ${name}`, cause: error }),
          })
          return [name] as readonly string[]
        })
      : Effect.succeed([] as readonly string[])
  )
}

/**
 * Write one locale's `llms.txt` + `llms-full.txt`, and answer the names emitted
 * relative to the output root — the same addresses the live routes serve.
 */
function writeLlmsPair(app: App, target: LlmsLocaleTarget, context: LlmsWriteContext) {
  const name = `${target.prefix}llms.txt`
  return Effect.gen(function* () {
    yield* ensureLocaleDirectory(target, context)
    const llms = yield* Effect.tryPromise({
      try: () => generateLlmsTxtContent(app, context.baseUrl, target.language),
      catch: (error) =>
        new StaticGenerationError({ message: `Failed to generate ${name}`, cause: error }),
    })
    yield* Effect.tryPromise({
      try: () => context.fs.writeFile(`${context.outputDir}/${name}`, llms, 'utf-8'),
      catch: (error) =>
        new StaticGenerationError({ message: `Failed to write ${name}`, cause: error }),
    })
    const fullFiles = yield* writeLlmsFullFile(app, target, context)
    return [name, ...fullFiles] as readonly string[]
  })
}

/** Create `<out>/<code>/` before writing into it. The root pair needs nothing. */
function ensureLocaleDirectory(target: LlmsLocaleTarget, context: LlmsWriteContext) {
  const directory = target.prefix.replace(/\/$/, '')
  return Effect.suspend(() =>
    directory === ''
      ? Effect.void
      : Effect.tryPromise({
          try: () => context.fs.mkdir(`${context.outputDir}/${directory}`, { recursive: true }),
          catch: (error) =>
            new StaticGenerationError({
              message: `Failed to create ${directory}/`,
              cause: error,
            }),
        }).pipe(Effect.asVoid)
  )
}

/**
 * Every locale a build writes llms documents for: the ROOT pair carrying
 * `languages.default`, then one pair per declared `languages.supported[].code`
 * under its own directory. An app declaring no `languages` yields the root pair
 * alone, scoped to `undefined` — every page, byte for byte as before.
 */
const llmsTargets = (app: App): readonly LlmsLocaleTarget[] => [
  { language: app.languages?.default, prefix: '' },
  ...(app.languages?.supported ?? []).map((language) => ({
    language: language.code,
    prefix: `${language.code}/`,
  })),
]

/**
 * Generate `/llms.txt` and `/llms-full.txt` for the static build when the app
 * declares content-directory pages and `app.llms.enabled` is not `false`.
 *
 * Mirrors the live `setupSeoRoutes` behavior (default-on, derived from
 * content-directory pages) so the built output matches the served routes —
 * including the locale scoping, so a built site answers `/{lang}/llms.txt`
 * exactly as the server does instead of serving every translation at the root.
 *
 * Uses `options.baseUrl` as the absolute link prefix (static builds emit a
 * canonical origin), falling back to relative links when no baseUrl is set.
 */
export function generateLlmsFiles(
  app: App,
  outputDir: string,
  options: GenerateStaticOptions,
  fs: FileSystemLike
) {
  const llmsEnabled =
    app.llms?.enabled !== false && (app.pages ?? []).some((page) => page.contentDir !== undefined)

  return Effect.suspend(() =>
    llmsEnabled
      ? Effect.gen(function* () {
          logDebug('Generating llms.txt...')
          const context: LlmsWriteContext = {
            outputDir,
            baseUrl: options.baseUrl?.replace(/\/$/, '') ?? '',
            fs,
          }
          const written = yield* Effect.forEach(llmsTargets(app), (target) =>
            writeLlmsPair(app, target, context)
          )
          return written.flat() as readonly string[]
        })
      : Effect.succeed([] as readonly string[])
  ).pipe(Effect.withSpan('server.generate-llms-files'))
}
