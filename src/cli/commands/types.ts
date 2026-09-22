/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CONFIG_TSCONFIG,
  CONFIG_TYPES_DECLARATION,
} from '@/infrastructure/assets/embedded-config-types.generated'
import { printDocument, printFailure } from '@/infrastructure/logging/cli-output'

/**
 * `sovrium types` — emit the TypeScript authoring surface into a directory.
 *
 * ## Why this command exists
 *
 * A Sovrium app can be authored in TypeScript with ZERO npm: no `package.json`,
 * no `node_modules`, no install step. The types come out of the binary itself,
 * so they always describe the schema THAT binary accepts — a version skew
 * between an installed `@sovrium/types` and the running binary is not
 * representable.
 *
 * Two files, and both are needed. The declaration alone is inert: with no
 * `tsconfig.json`, `tsc` never pulls `sovrium.d.ts` into the program and every
 * config fails with TS2307 "Cannot find module 'sovrium'". The generated
 * tsconfig sets no `include`, so the default glob picks the declaration up.
 *
 * ## The type-only contract
 *
 * The declaration exports TYPES and never a value — see the generator
 * (`scripts/build/generate-embedded-config-types.ts`) and [internal ref].
 * The binary leaves bare-package specifiers unresolved, so a value import would
 * type-check and then fail at boot; `import type` is erased at transpile time
 * and never resolved at all. Keeping values out of the declaration makes that
 * trap unreachable by construction rather than by documentation.
 */

/** Ambient declaration for the bare `sovrium` specifier. Regenerated on every run. */
const DECLARATION_FILENAME = 'sovrium.d.ts'

/** Minimal compiler config whose default glob pulls the declaration into the program. */
const TSCONFIG_FILENAME = 'tsconfig.json'

export interface TypesCommandOptions {
  /** `--output <dir>` — target directory. Defaults to the current directory. */
  readonly outputDir?: string
}

export interface TypesFilesResult {
  /** Absolute path of the (always rewritten) ambient declaration. */
  readonly declarationPath: string
  /** Absolute path of the tsconfig — written or pre-existing. */
  readonly tsconfigPath: string
  /** `false` when a user-authored tsconfig was found and preserved. */
  readonly tsconfigWritten: boolean
}

/**
 * Write the two files, reporting which ones actually landed.
 *
 * `sovrium.d.ts` is OVERWRITTEN on every run: it is generated, carries a
 * DO-NOT-EDIT banner, and must track the binary's schema — a stale declaration
 * that silently survived an upgrade is the exact skew this command removes.
 *
 * `tsconfig.json` is written only when absent. It is a user-authored file the
 * moment a project has one (paths, JSX, stricter flags, a build setup), and
 * silently replacing someone's compiler configuration is not an acceptable side
 * effect of asking for types. When one exists we say what it must satisfy
 * instead — the declaration has to be in the program — and leave the edit to
 * the author, who is the only one who knows how their config is organised.
 *
 * Shared with `sovrium init --typescript`, which needs the same two files
 * written but reports them inside its own scaffold banner.
 */
export const writeConfigTypesFiles = async (targetDir: string): Promise<TypesFilesResult> => {
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(targetDir, { recursive: true })

  const declarationPath = join(targetDir, DECLARATION_FILENAME)
  await writeFile(declarationPath, CONFIG_TYPES_DECLARATION)

  const tsconfigPath = join(targetDir, TSCONFIG_FILENAME)
  const tsconfigExists = await Bun.file(tsconfigPath).exists()
  if (!tsconfigExists) {
    await writeFile(tsconfigPath, CONFIG_TSCONFIG)
  }

  return { declarationPath, tsconfigPath, tsconfigWritten: !tsconfigExists }
}

/**
 * The report block for the tsconfig half — written, or preserved with the one
 * thing the author now has to check themselves.
 */
export const tsconfigReport = (tsconfigPath: string, written: boolean): readonly string[] =>
  written
    ? [tsconfigPath]
    : [
        `${tsconfigPath} already exists — left untouched.`,
        `Ensure ${DECLARATION_FILENAME} is in the TypeScript program (it is, unless`,
        '"include" or "files" narrows the default glob past it).',
      ]

/**
 * Handle the `types` command — emit `sovrium.d.ts` + `tsconfig.json`.
 *
 * Exits 1 with an actionable message when the directory cannot be written (a
 * read-only mount, a missing parent the process may not create, a path that is
 * a file). Silence plus a zero exit code would leave an author type-checking
 * against a declaration that was never written.
 */
export const handleTypesCommand = async (options: TypesCommandOptions = {}): Promise<void> => {
  const targetDir = options.outputDir ?? process.cwd()

  const result = await writeConfigTypesFiles(targetDir).catch((error: unknown) => {
    printFailure({
      headline: `Could not write the TypeScript authoring files into ${targetDir}.`,
      detail: [error instanceof Error ? error.message : String(error)],
      guidance:
        'Check the directory exists and is writable, or pass a different one with\n' +
        '  sovrium types --output <dir>',
    })
    // `return` (not a bare call): `process.exit` is typed `never`, so returning
    // it keeps the catch's type `never` and `result` non-nullable. A bare call
    // would widen `result` to `… | void` and force a check that can never fire.
    return process.exit(1)
  })

  printDocument([
    [
      {
        glyph: 'ok',
        text: 'TypeScript authoring files ready — no package.json, no npm install.',
        detail: [
          result.declarationPath,
          ...tsconfigReport(result.tsconfigPath, result.tsconfigWritten),
        ],
      },
    ],
    [
      {
        text: 'Author your config with a type-only import:',
        detail: [
          "import type { AppConfig } from 'sovrium'",
          '',
          "export default { name: 'my-app' } satisfies AppConfig",
        ],
      },
    ],
    [{ text: `Re-run 'sovrium types' after upgrading the binary to refresh the declaration.` }],
  ])
}
