/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system [config] [--format md|json] [--output <file>]`
 *
 * The third projection of `buildDesignSystem(app)`, beside `sovrium schema` and
 * `sovrium validate` — and the one that makes the design system genuinely
 * useful to an agent. `sovrium design-system --output DESIGN.md` writes a file
 * beside `app.ts` that `CLAUDE.md` can reference, so "build me a pricing page
 * for this app" produces something on-brand on the first attempt, because the
 * rules were handed over rather than guessed.
 *
 * ─── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * Unlike the two HTTP projections this needs no server, no database and no
 * session: it reads a config file and prints. That is what lets it run in a
 * pre-commit hook or a CI step, and it is why the export is a pure function of
 * the config rather than of a running instance.
 *
 * ─── MARKDOWN IS THE DEFAULT, NOT JSON ──────────────────────────────────────
 *
 * The default consumer is a model reading a context window — the format the
 * command exists for. Piping the brief into a file or a prompt should need no
 * flag; `--format json` is for tooling.
 *
 * ─── TWO REFUSALS, EACH A REFUSAL RATHER THAN A FALLBACK ────────────────────
 *
 *  - **An unknown `--format`.** Silently falling back to markdown is the worse
 *    failure: a CI step asking for `yaml` receives markdown, exits 0, writes
 *    the wrong file, and nobody looks again.
 *  - **A config that fails validation.** Exporting from an unvalidated config
 *    produces a design system describing an app that cannot boot — handed to an
 *    agent, that is a brief for building against a config nobody runs. The
 *    decode goes through `decodeAppConfigObject`, so this command refuses
 *    exactly what `sovrium validate` and `sovrium start` refuse.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Effect, Console } from 'effect'
import { formatConfigCandidatesLine, formatDiscoveredConfigNotice } from '@/domain/utils'
import { lazyImportSchema } from './utils'
import { loadConfigForValidationWithSources } from './validate'

/** The formats this command emits, and the spellings it accepts for them. */
const MARKDOWN_FORMATS: ReadonlySet<string> = new Set(['md', 'markdown'])
const JSON_FORMAT = 'json'

/** Options as parsed from argv. */
export interface DesignSystemCommandOptions {
  readonly configFile?: string
  readonly outputPath?: string
  /** The RAW `--format` value, deliberately unvalidated by the parser. */
  readonly format?: string
}

/**
 * Resolve the config to export when the operator named none.
 *
 * Positional → discovery → refusal, the same order `sovrium validate` uses. A
 * discovered file travels the identical decode path a named one does, so it
 * fails identically when it is broken.
 */
const discoverDesignSystemConfig = async (): Promise<string> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const discovered = await discoverDefaultConfigFile(process.cwd())

  if (!discovered) {
    Effect.runSync(
      Console.error(
        `Error: No config file provided.\n\n` +
          `${formatConfigCandidatesLine(process.cwd())}\n\n` +
          `Usage:\n  sovrium design-system <config.json|config.yaml|config.ts>\n\n` +
          `Run 'sovrium init' to scaffold a new project.`
      )
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  Effect.runSync(Console.error(formatDiscoveredConfigNotice(discovered)))
  return discovered
}

/**
 * Normalise `--format`, refusing anything else by name.
 *
 * The accepted set is printed in the refusal because an operator who typed
 * `yaml` needs to learn what to type instead, not merely that they were wrong.
 */
const resolveFormat = (raw: string | undefined): 'md' | 'json' => {
  if (raw === undefined) return 'md'
  const normalized = raw.trim().toLowerCase()
  if (MARKDOWN_FORMATS.has(normalized)) return 'md'
  if (normalized === JSON_FORMAT) return JSON_FORMAT

  Effect.runSync(
    Console.error(
      `Error: Unsupported --format "${raw}".\n\n` +
        `  Accepted values: md (or markdown), json.\n\n` +
        `  Omitting --format prints the markdown brief, which is what an agent reads.`
    )
  )
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * Decode the config, refusing with the decoder's own message.
 *
 * The message is the decoder's verbatim so an operator sees the SAME text
 * `sovrium validate` printed — one config verdict, whichever command surfaced it.
 */
const decodeForExport = async (configPath: string) => {
  const { parsed, refSources } = await loadConfigForValidationWithSources(configPath)
  const { decodeAppConfigObject } = await import('@/application/use-cases/schema/decode-app-config')
  const decoded = decodeAppConfigObject(parsed, { refSources })

  if (!decoded.valid) {
    const errorLines = decoded.errors.map((error) => `  ${error}`).join('\n')
    Effect.runSync(Console.error(`Error: Validation failed.\n\n${errorLines}`))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Notices go to stderr so `--format json` keeps stdout parseable by `jq` and
  // a human still learns their config uses a deprecated key.
  if (decoded.notices.length > 0) {
    const noticeLines = decoded.notices.map((notice) => `  ${notice}`).join('\n')
    Effect.runSync(Console.error(`Notice:\n\n${noticeLines}\n`))
  }

  return decoded.app
}

/**
 * Send the rendered export to its single destination.
 *
 * ONE destination per run: with `--output` the document does NOT also go to
 * stdout, so a shell redirect cannot silently duplicate it into two places.
 * Parent directories are created, matching `sovrium schema --output` — a
 * sibling command that did not would be a gratuitous difference.
 */
const emit = async (content: string, outputPath: string | undefined): Promise<void> => {
  if (outputPath === undefined) {
    // eslint-disable-next-line functional/no-expression-statements
    process.stdout.write(content)
    return
  }
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(dirname(outputPath), { recursive: true })
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(outputPath, content)
  Effect.runSync(Console.log(`Design system written to ${outputPath}.`))
}

/**
 * Handle the `design-system` command.
 *
 * @param options - The parsed positional config path and flag values.
 */
export const handleDesignSystemCommand = async (
  options: DesignSystemCommandOptions
): Promise<void> => {
  // Format is resolved FIRST, before any file is read: an operator who mistyped
  // the format learns it immediately rather than after a config decode.
  const format = resolveFormat(options.format)
  const configPath = options.configFile ?? (await discoverDesignSystemConfig())
  const app = await decodeForExport(configPath)

  const { buildDesignSystem } = await import('@/application/use-cases/admin/design-system')
  const document = buildDesignSystem(app)

  if (format === JSON_FORMAT) {
    // eslint-disable-next-line functional/no-expression-statements, unicorn/no-null -- CLI output is the side-effect; JSON.stringify requires null as replacer
    await emit(JSON.stringify(document, null, 2) + '\n', options.outputPath)
    return
  }

  const { renderDesignSystemMarkdown } =
    await import('@/application/use-cases/admin/design-system-markdown')
  // eslint-disable-next-line functional/no-expression-statements -- CLI output is the side-effect
  await emit(renderDesignSystemMarkdown(document, app.name), options.outputPath)
}
