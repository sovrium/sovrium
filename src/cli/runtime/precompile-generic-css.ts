/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The E2E harness's generic-stylesheet seam. NOT a user-facing capability, and
 * deliberately absent from the help text, the dispatch tables and the manual.
 *
 * The harness compiles the app-free default stylesheet once and hands it to
 * every test server as `SOVRIUM_CSS_FILE`, so no server pays for a Tailwind
 * compile at boot. A server accepts that file only when its first line carries
 * the stamp the server computes itself, and the stamp covers the compile ENGINE
 * — a from-source run (PostCSS, safelist scanned off disk) and the compiled
 * binary (native-free, safelist baked at build) compile different bytes and
 * stamp differently. A file built from source is therefore refused by every
 * binary server, correctly. The only process that can write a file the binary
 * accepts is the binary itself, and `sovrium build` cannot: it needs an app and
 * writes that app's narrowed stamp, never the generic one.
 *
 * Hence an environment variable rather than a verb: a dispatched verb is
 * published — in the help, in the shipped skill references' verb catalogue —
 * and this is not something an operator has a use for. The same reasoning as
 * `SOVRIUM_FORCE_NATIVE_FREE_CSS`, the other compile switch only tests set.
 *
 *   SOVRIUM_E2E_PRECOMPILE_CSS=<path> sovrium
 *
 * writes the generic stylesheet, stamped, to `<path>` and exits 0, whatever
 * else the command line says. It exits 1 without writing when the compile fell
 * back to the minimal stylesheet: a stamped fallback would be served to every
 * server as though it were the real one.
 */

import { Cause, Data, Effect, Exit } from 'effect'
import { stampPrecompiledCSS } from '@/infrastructure/css/cache/css-cache-service'
import { compileCSSRaw } from '@/infrastructure/css/compiler'
import { MINIMAL_FALLBACK_CSS } from '@/infrastructure/css/native-free-compiler'
import { precompiledStampOf } from '@/infrastructure/css/versioned-css-path'
import { printFailure } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'

/** The variable naming the file the harness wants the generic stylesheet in. */
export const PRECOMPILE_GENERIC_CSS_ENV = 'SOVRIUM_E2E_PRECOMPILE_CSS'

/** The compile produced the minimal fallback rather than a stylesheet. */
class GenericCssFallbackError extends Data.TaggedError('GenericCssFallbackError')<{
  readonly path: string
}> {}

/** The stamped stylesheet could not be written to the requested path. */
class GenericCssWriteError extends Data.TaggedError('GenericCssWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

/**
 * Compile the generic stylesheet with this process's engine, stamp it with the
 * generic stamp, and write it to `path`.
 *
 * @param path - where the stamped stylesheet goes.
 */
export const writeGenericPrecompiledCss = (path: string) =>
  Effect.gen(function* () {
    const { css } = yield* compileCSSRaw()
    if (css === MINIMAL_FALLBACK_CSS) return yield* new GenericCssFallbackError({ path })
    yield* Effect.tryPromise({
      try: () => Bun.write(path, stampPrecompiledCSS(css, precompiledStampOf())),
      catch: (cause) => new GenericCssWriteError({ path, cause }),
    })
  })

/** One readable line for whatever stopped the write. */
const describeFailure = (failure: unknown): string =>
  failure instanceof GenericCssFallbackError
    ? 'The compile fell back to the minimal stylesheet; the compiler log above says why.'
    : failure instanceof GenericCssWriteError
      ? formatRuntimeError(failure.cause)
      : formatRuntimeError(failure)

/**
 * Run {@link writeGenericPrecompiledCss} and exit: 0 once written, 1 on any
 * failure, reported on stderr.
 *
 * @param path - where the stamped stylesheet goes.
 */
export const handlePrecompileGenericCss = async (path: string): Promise<never> => {
  const exit = await Effect.runPromiseExit(writeGenericPrecompiledCss(path))
  if (Exit.isSuccess(exit)) return process.exit(0)
  printFailure({
    headline: `The generic stylesheet was not written to ${path}.`,
    detail: [describeFailure(Cause.squash(exit.cause))],
    guidance: `Unset ${PRECOMPILE_GENERIC_CSS_ENV} to run the command itself; it is a test-harness switch.`,
  })
  return process.exit(1)
}
