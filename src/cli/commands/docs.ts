/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium docs [address] [--full] [--format md|json|llms] [--output <path>]`
 *
 * The platform manual, printed out of the binary that ships it. That is the
 * same promise `sovrium types` already makes for the TypeScript surface,
 * extended from types to prose: the declaration `sovrium types` emits describes
 * the schema THAT binary accepts, and the manual printed here describes THAT
 * binary's behaviour. A skew between the running engine and the documentation
 * it hands you is not representable.
 *
 * ─── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * No config file, no database, no network, no working directory. The manual is
 * a property of the binary rather than of a project, so requiring a config to
 * read it would make it unavailable exactly when a reader most needs it —
 * before they have written one.
 *
 * ─── EVERYTHING IS LOADED INSIDE THE HANDLER ────────────────────────────────
 *
 * The payload, the section manifests and the rendering engine are reached
 * through `await import()` here and are named nowhere at module scope. A static
 * import typechecks, lints clean, and puts every schema the manual documents on
 * the boot path of `sovrium start`; `embedded-docs-boot.test.ts` asserts a real
 * boot loads none of it, and that assertion is the only thing standing between
 * this command and a server paying for a manual nobody asked for.
 *
 * ─── MARKDOWN IS THE DEFAULT, NOT JSON ──────────────────────────────────────
 *
 * The same reason `sovrium design-system` gives: the intended reader is a model
 * reading a context window, and piping the manual into a prompt should need no
 * flag. `--format json` is for tooling.
 *
 * ─── THREE REFUSALS, EACH A REFUSAL RATHER THAN A FALLBACK ──────────────────
 *
 *  - **An unknown `--format`.** Falling back to markdown silently is the worse
 *    failure: a build step asking for `yaml` receives markdown, exits 0, writes
 *    the wrong file, and nobody looks again.
 *  - **A `--lang` other than `en`.** The in-binary manual is English. The flag
 *    exists so that adding a locale later is not a breaking change, and it
 *    refuses anything else BY NAME rather than quietly serving English to
 *    someone who asked for French and will not check.
 *  - **An unknown section, article, option path, variable or verb.** A reader
 *    who typed something that does not exist needs to learn what does, not to
 *    receive the table of contents and be left assuming their address was empty.
 */

import { Effect, Console } from 'effect'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { exportDocs } from './docs-export'
import { renderDocsRequest } from './docs-render'
import { resolveDocumentFormat, writeDocument } from './document-output'
import { getCurrentVersion } from './update'

/** The one locale the in-binary manual carries. */
const SUPPORTED_LANG = 'en'

/** Options as parsed from argv. */
export interface DocsCommandOptions {
  /** Positionals after `docs` — an address, or a subcommand and its argument. */
  readonly args: readonly string[]
  /** The RAW `--format` value, deliberately unvalidated by the parser. */
  readonly format?: string
  /** The RAW `--lang` value, deliberately unvalidated by the parser. */
  readonly lang?: string
  readonly outputPath?: string
  readonly full: boolean
  readonly listSections: boolean
  /** Every `--section <slug>`, narrowing `--full` and the table of contents. */
  readonly sections: readonly string[]
  /** Whether `--export` was passed at all, with or without a directory. */
  readonly exportRequested?: boolean
  /** The `--export <dir>` target; absent when the flag had no directory. */
  readonly exportDir?: string
  /** `--force` — let `--export` replace a previous export. */
  readonly force?: boolean
}

/**
 * Refuse a locale the binary does not carry, BY NAME.
 *
 * Serving English to a reader who asked for French is the failure the flag
 * exists to prevent — they will not check. The published French documentation
 * is authored against the generated English and lives on the website.
 */
const resolveLang = (raw: string | undefined): void => {
  if (raw === undefined || raw.trim().toLowerCase() === SUPPORTED_LANG) return

  printStderr(
    `Error: Unsupported --lang "${raw}".\n\n` +
      `  The manual inside this binary is "${SUPPORTED_LANG}" only.\n` +
      `  Translations are published at https://sovrium.com/docs, not shipped here.`
  )
  process.exit(1)
}

/** Stop with a refusal on stderr and exit 1. */
const refuse = (message: string): never => {
  printStderr(message)
  process.exit(1)
}

/**
 * The other output mode an `--export` was combined with, if any.
 *
 * `--export` is its own destination and its own shape, so pairing it with a
 * flag that chooses either is refused BY NAME rather than resolved by picking
 * one: a caller who got the other output would not know it.
 */
const conflictingMode = (options: DocsCommandOptions): string | undefined => {
  if (options.args.length > 0) return `an address or subcommand ("${options.args.join(' ')}")`
  if (options.full) return '--full'
  if (options.listSections) return '--list-sections'
  if (options.sections.length > 0) return '--section'
  if (options.outputPath !== undefined) return '--output'
  if (options.format !== undefined) return '--format'
  return undefined
}

/** Why an `--export` invocation is malformed, or `undefined` when it is not. */
const exportArgumentRefusal = (options: DocsCommandOptions): string | undefined => {
  const conflict = conflictingMode(options)
  if (conflict !== undefined) {
    return (
      `Error: --export cannot be combined with ${conflict}.\n\n` +
      `  --export writes every article plus _nav.json into a directory; it takes no\n` +
      `  address and chooses its own format and destination.`
    )
  }
  if (options.exportDir === undefined) {
    return (
      `Error: --export needs a directory.\n\n` +
      `  Usage: sovrium docs --export <dir> [--force]\n` +
      `  It never falls back to the working directory, which is usually a project root.`
    )
  }
  return undefined
}

/**
 * `--export <dir>`: validate the combination, then write the export.
 *
 * Refusals come first and write nothing — including the directory itself.
 */
const handleExport = async (options: DocsCommandOptions): Promise<void> => {
  const invalid = exportArgumentRefusal(options)
  const result =
    invalid !== undefined
      ? { kind: 'refused' as const, reason: invalid }
      : await exportDocs({
          target: options.exportDir ?? '',
          force: options.force === true,
          engine: await getCurrentVersion(),
        })
  return result.kind === 'refused'
    ? refuse(result.reason)
    : Effect.runSync(Console.log(result.notice))
}

/**
 * Handle the `docs` command.
 *
 * @param options - The parsed positionals and flag values.
 */
export const handleDocsCommand = async (options: DocsCommandOptions): Promise<void> => {
  // Both refusals are resolved FIRST, before the payload is loaded: a caller
  // who mistyped the format or the locale learns it immediately rather than
  // after the manual has been assembled.
  resolveLang(options.lang)
  if (options.exportRequested === true) return handleExport(options)
  const format = resolveDocumentFormat(
    options.format,
    ['json', 'llms'],
    'the markdown manual, which is what an agent reads.'
  )

  const rendered = await renderDocsRequest({
    args: options.args,
    format,
    full: options.full,
    listSections: options.listSections,
    sections: options.sections,
  })

  if (rendered.refusal !== undefined) {
    printStderr(rendered.refusal)
    process.exit(1)
  }

  await writeDocument(rendered.content, options.outputPath, 'Manual')
}
