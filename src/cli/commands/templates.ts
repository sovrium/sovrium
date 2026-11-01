/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium templates [--json]`
 *
 * The templates this binary embeds — the names `sovrium init --template`
 * accepts — printed from the catalogue `init` itself reads, so the list is
 * exactly what this binary can scaffold.
 *
 * ─── OFFLINE BY CONSTRUCTION ────────────────────────────────────────────────
 *
 * No config, no database, no network, no working directory: the catalogue is
 * a property of the binary, not of a project. Nothing is written but stdout.
 *
 * ─── TWO OUTPUTS ────────────────────────────────────────────────────────────
 *
 * The human list by default; `--json` prints ONE document and nothing else on
 * stdout, so a pipe to `jq` never meets a notice. The documents themselves are
 * built in `templates-render.ts`.
 */

import { Effect } from 'effect'
import { CliExit, fromAsync, fromAsyncValue, type CommandHandler } from '@/cli/runtime/run-command'
import { writeStdout } from './document-output'
import { readEmbeddedTemplateCatalog } from './templates-catalog'
import { renderTemplatesJson, renderTemplatesText } from './templates-render'
import { getCurrentVersion } from './update'
import type { TemplateCatalogError } from './templates-catalog'

/** Options as parsed from argv. */
export interface TemplatesCommandOptions {
  /** `--json`: one document for tooling instead of the human list. */
  readonly json?: boolean
  /** The running engine version, as `sovrium --version` prints it. */
  readonly engine: string
}

/** The text `sovrium templates` prints for these options. */
export const templatesOutput = (
  options: TemplatesCommandOptions
): Effect.Effect<string, TemplateCatalogError> =>
  readEmbeddedTemplateCatalog.pipe(
    Effect.map((catalog) =>
      options.json === true
        ? renderTemplatesJson(catalog, options.engine)
        : renderTemplatesText(catalog)
    ),
    Effect.withSpan('cli.templates.output')
  )

/**
 * Handle the `templates` command.
 *
 * A catalogue that does not decode is a build defect: reported on stderr,
 * exit 1, nothing on stdout.
 */
export const handleTemplatesCommand: CommandHandler = (args) =>
  Effect.gen(function* () {
    const engine = yield* fromAsyncValue(getCurrentVersion)
    const output = yield* templatesOutput({ json: args.json, engine }).pipe(
      Effect.mapError((error) => new CliExit({ code: 1, stderr: `Error: ${error.message}` }))
    )
    yield* fromAsync(() => writeStdout(output))
  })
