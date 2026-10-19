/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system [config] [--format md|json|bundle] [--mode light|dark] [--output <file|dir>] [--force]`
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
 * ─── THREE REFUSALS, EACH A REFUSAL RATHER THAN A FALLBACK ──────────────────
 *
 *  - **An unknown `--format` or `--mode`.** Silently falling back to markdown,
 *    or to light, is the worse failure: a CI step asking for `yaml` receives
 *    markdown, exits 0, writes the wrong file, and nobody looks again.
 *  - **`--mode` outside `--format json`.** The markdown brief and the bundle
 *    already describe both schemes, so the flag would change nothing there; a
 *    caller asking for a dark brief and exiting 0 holding the two-scheme one
 *    believes it has something it does not. Refused before anything is written,
 *    so a refused bundle leaves no directory behind.
 *  - **A config that fails validation.** Exporting from an unvalidated config
 *    produces a design system describing an app that cannot boot — handed to an
 *    agent, that is a brief for building against a config nobody runs. The
 *    decode goes through `decodeAppConfigObject`, so this command refuses
 *    exactly what `sovrium validate` and `sovrium start` refuse.
 */

import { join } from 'node:path'
import {
  formatConfigCandidatesLine,
  formatDiscoveredConfigNotice,
} from '@/domain/kernel/config-parsing/default-config-files'
import { designSystemModeSchema } from '@/domain/models/api/admin/design-system'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { resolveDocumentFormat, writeDocument } from './document-output'
import { lazyImportSchema } from './utils'
import { loadConfigForValidationWithSources } from './validate'

/** The single-document format this command emits besides its markdown default. */
const JSON_FORMAT = 'json'

/** The directory format: the portable bundle (`design-system-bundle.ts`). */
const BUNDLE_FORMAT = 'bundle'

/** Options as parsed from argv. */
export interface DesignSystemCommandOptions {
  readonly configFile?: string
  readonly outputPath?: string
  /** The RAW `--format` value, deliberately unvalidated by the parser. */
  readonly format?: string
  /** The RAW `--mode` value (`light` or `dark`), deliberately unvalidated by the parser. */
  readonly mode?: string
  /** `--force`: overwrite the bundle's own files in a non-empty `--output` directory. */
  readonly force?: boolean
}

/** The colour modes a token document describes, named once by the wire schema; light first. */
const COLOR_MODE_VALUES = designSystemModeSchema.literals

/**
 * Normalise a RAW `--mode`, refusing anything else by name and exiting 1.
 *
 * Case-insensitive on purpose, as a flag typed at a shell is; the HTTP `?mode`
 * stays strict. Read as light, an unknown mode would exit 0 and write the light
 * palette into a file its author named for the dark one.
 */
const resolveColorMode = (raw: string | undefined): (typeof COLOR_MODE_VALUES)[number] => {
  if (raw === undefined) return COLOR_MODE_VALUES[0]
  const normalized = raw.trim().toLowerCase()
  const mode = COLOR_MODE_VALUES.find((candidate) => candidate === normalized)
  if (mode !== undefined) return mode
  printStderr(
    `Error: Unsupported --mode "${raw}".\n\n` +
      `  Accepted values: ${COLOR_MODE_VALUES.join(', ')}.\n\n` +
      `  Omitting --mode prints the light document.`
  )
  process.exit(1)
}

/**
 * Refuse `--mode` for any format but the JSON token document, exiting 1.
 *
 * Runs before the config is read and before any output exists, so a refused
 * bundle never creates its directory.
 */
const refuseModeOutsideJson = (mode: string | undefined, format: string): void => {
  if (mode === undefined || format === JSON_FORMAT) return
  printStderr(
    'Error: `--mode` selects the JSON token document; the markdown brief and the bundle ' +
      'describe both schemes.\n\n' +
      '  Use --format json --mode dark for the dark token document, or drop --mode.'
  )
  process.exit(1)
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
    printStderr(
      `Error: No config file provided.\n\n` +
        `${formatConfigCandidatesLine(process.cwd())}\n\n` +
        `Usage:\n  sovrium design-system <config.json|config.yaml|config.ts>\n\n` +
        `Run 'sovrium init' to scaffold a new project.`
    )
    process.exit(1)
  }

  printStderr(formatDiscoveredConfigNotice(discovered))
  return discovered
}

/**
 * Decode the config, refusing with the decoder's own message.
 *
 * The message is the decoder's verbatim so an operator sees the SAME text
 * `sovrium validate` printed — one config verdict, whichever command surfaced it.
 */
const decodeForExport = async (configPath: string) => {
  const { parsed, refSources } = await loadConfigForValidationWithSources(configPath)
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const decoded = decodeAppConfigObject(parsed, { refSources })

  if (!decoded.valid) {
    const errorLines = decoded.errors.map((error) => `  ${error}`).join('\n')
    printStderr(`Error: Validation failed.\n\n${errorLines}`)
    process.exit(1)
  }

  // Notices go to stderr so `--format json` keeps stdout parseable by `jq` and
  // a human still learns their config uses a deprecated key.
  if (decoded.notices.length > 0) {
    const noticeLines = decoded.notices.map((notice) => `  ${notice}`).join('\n')
    printStderr(`Notice:\n\n${noticeLines}\n`)
  }

  return decoded.app
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
  const format = resolveDocumentFormat(
    options.format,
    [JSON_FORMAT, BUNDLE_FORMAT],
    'the markdown brief, which is what an agent reads.'
  )
  refuseModeOutsideJson(options.mode, format)
  const mode = resolveColorMode(options.mode)
  const configPath = options.configFile ?? (await discoverDesignSystemConfig())
  const app = await decodeForExport(configPath)

  if (format === BUNDLE_FORMAT) {
    const { writeDesignSystemBundle } = await import('./design-system-bundle')
    // The logo files are read from the `public/` beside the config, as `sovrium start` serves it.
    const { assetProjectDir } = await import('@/infrastructure/assets/private-assets')
    await writeDesignSystemBundle(app, options.outputPath, options.force ?? false, {
      publicDir: join(assetProjectDir(configPath), 'public'),
    })
    return
  }

  const { buildDesignSystem } = await import('@/application/use-cases/admin/design-system')
  const document = buildDesignSystem(app, mode)

  if (format === JSON_FORMAT) {
    await writeDocument(
      `${JSON.stringify(document, undefined, 2)}\n`,
      options.outputPath,
      'Design system'
    )
    return
  }

  const { renderDesignSystemMarkdown } =
    await import('@/application/use-cases/admin/design-system-markdown')
  await writeDocument(
    renderDesignSystemMarkdown(document, buildDesignSystem(app, 'dark'), app.name),
    options.outputPath,
    'Design system'
  )
}
