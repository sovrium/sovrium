/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * CLI Schema Loader - Presentation Layer
 *
 * CLI-specific schema loading with user-facing error messages and process.exit.
 * Orchestrates domain and infrastructure layers.
 */

import { Effect } from 'effect'
import {
  formatConfigCandidatesLine,
  formatDiscoveredConfigNotice,
} from '@/domain/kernel/config-parsing/default-config-files'
import {
  detectFormat,
  getFileExtension,
  isInlineJson,
  isUrl,
} from '@/domain/kernel/config-parsing/format-detection'
import { parseJsonContent, parseYamlContent } from '@/domain/models/app/app-content-parsing'
import {
  loadSchemaFromFile as loadFromFile,
  loadSchemaGraphFromFile,
  fileExists,
  fetchRemoteSchema,
  discoverDefaultConfigFile,
} from '@/infrastructure/config'
import { printStderr, renderStderr } from '@/infrastructure/logging/cli-output'
import type { AppEncoded } from '@/domain/models/app'
import type { LoadedConfigGraph } from '@/infrastructure/config'

/**
 * Load schema from file with CLI error handling (calls process.exit on error)
 */
export const loadSchemaFromFile = async (
  filePath: string,
  command: string
): Promise<AppEncoded> => {
  const exists = await fileExists(filePath)

  if (!exists) {
    Effect.runSync(
      Effect.gen(function* () {
        yield* renderStderr(`Error: File not found: ${filePath}`)
        yield* renderStderr('')
        yield* renderStderr('Usage:')
        yield* renderStderr(`  sovrium ${command} <config.json>`)
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  const format = detectFormat(filePath)

  if (format === 'unsupported') {
    Effect.runSync(
      Effect.gen(function* () {
        yield* renderStderr(`Error: Unsupported file format: .${getFileExtension(filePath)}`)
        yield* renderStderr('')
        yield* renderStderr('Supported formats: .json, .yaml, .yml, .ts')
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  try {
    return await loadFromFile(filePath)
  } catch (error) {
    // TypeScript configs are imported, not parsed — use the right verb and label per format.
    // NOTE: the 'parse JSON/YAML file' wording is asserted by CLI specs; only the .ts branch differs.
    const formatLabel = format === 'json' ? 'JSON' : format === 'yaml' ? 'YAML' : 'TypeScript'
    const verb = format === 'typescript' ? 'load' : 'parse'
    Effect.runSync(
      Effect.gen(function* () {
        yield* renderStderr(`Error: Failed to ${verb} ${formatLabel} file: ${filePath}`)
        yield* renderStderr('')
        // Composed rather than passed as two arguments: `console.error` joined
        // them with a single space, so this emits the identical bytes — and the
        // multi-argument form is not a drop-in for the sink (see `printStderr`).
        yield* renderStderr(`Details: ${error instanceof Error ? error.message : String(error)}`)
      })
    )
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }
}

/**
 * Load schema from file for watch mode reloads (throws instead of process.exit).
 *
 * Returns the whole config GRAPH — the config plus every file it was read
 * from — because a reload must both evaluate a `.ts` root fresh (a plain
 * `import()` hands back the module cached at boot) and re-derive the set of
 * files the watcher follows (a reload can add or drop an import or a `$ref`).
 */
export const loadSchemaGraphForReload = async (filePath: string): Promise<LoadedConfigGraph> =>
  loadSchemaGraphFromFile(filePath)

/**
 * Parse schema from environment variable value
 * Supports: inline JSON, inline YAML, remote URL
 *
 * @throws Error if parsing fails
 */
export const parseSchemaFromEnv = async (envValue: string): Promise<AppEncoded> => {
  const trimmedValue = envValue.trim()

  // Detect if value is inline JSON
  if (isInlineJson(trimmedValue)) {
    try {
      return parseJsonContent(trimmedValue)
    } catch (error) {
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(
        `Invalid JSON in APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // Detect if value is a URL
  if (isUrl(trimmedValue)) {
    return fetchRemoteSchema(trimmedValue)
  }

  // Otherwise, treat as YAML
  try {
    return parseYamlContent(trimmedValue)
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(
      `Invalid YAML in APP_SCHEMA: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Show error message when no configuration is provided
 */
const showNoConfigError = (command: string): never => {
  Effect.runSync(
    Effect.gen(function* () {
      yield* renderStderr('Error: No configuration provided')
      yield* renderStderr('')
      // Name what was probed AND where. "No configuration provided" alone tells
      // the user a config is missing but not what to call one — the exact gap
      // that made the `sovrium init` → `sovrium start` flow unrecoverable.
      yield* renderStderr(formatConfigCandidatesLine(process.cwd()))
      yield* renderStderr('')
      yield* renderStderr('Usage:')
      yield* renderStderr(`  sovrium ${command} <config.yaml>`)
      yield* renderStderr('')
      yield* renderStderr('Or with environment variable:')
      yield* renderStderr(`  APP_SCHEMA='{"name":"My App"}' sovrium ${command}`)
      yield* renderStderr('')
      yield* renderStderr("Run 'sovrium init' to scaffold a new project.")
    })
  )
  // eslint-disable-next-line functional/no-expression-statements
  process.exit(1)
}

/**
 * A resolved app schema, plus the config FILE it came from when there was one.
 *
 * The pair exists because `start` and `build` need more than the decoded schema:
 * they anchor the default `public/` directory, the lock-file config hash,
 * `SOVRIUM_CONTENT_DIR`, the default output dir and the `--watch` handle to
 * `dirname(configFile)`. Returning only the schema makes every one of those
 * anchors silently unset, which is what happened to auto-discovery before this
 * type existed — `sovrium start --watch` in a directory holding an `app.yaml`
 * watched nothing at all.
 */
export interface ResolvedAppSchema {
  readonly app: AppEncoded
  /**
   * The config file the schema was read from, when a caller may anchor to it.
   *
   * Set for the positional argument and for an auto-DISCOVERED file — the two
   * cases where the operator's own directory holds the config.
   *
   * Deliberately NOT set for `APP_SCHEMA_FILE`, and this is a preservation, not
   * an oversight: that variable never anchored anything, it exists so the E2E
   * harness can hand over a schema too large for `ARG_MAX`, and the harness
   * supplies `SOVRIUM_CONTENT_DIR` itself. Inferring an anchor from it would
   * change what every existing fixture serves. Never set for an inline or
   * remote `APP_SCHEMA` — there is no file to anchor to.
   */
  readonly configFile?: string
}

/**
 * Resolve the app schema AND the file it came from.
 *
 * Resolution order is the contract (`[internal ref]`
 * § Configuration sources): positional → `APP_SCHEMA_FILE` → `APP_SCHEMA` →
 * auto-discovery → refusal. Auto-discovery is LAST so every invocation that
 * resolves today keeps resolving to exactly what it resolves to now; moving it
 * earlier would silently change what an existing `APP_SCHEMA` invocation boots,
 * which is why `[internal ref]` exists purely as a control on this order.
 */
export const resolveAppSchema = async (
  command: string,
  filePath?: string
): Promise<ResolvedAppSchema> => {
  // If a file path is provided, load from file (takes precedence over env)
  if (filePath) {
    return { app: await loadSchemaFromFile(filePath, command), configFile: filePath }
  }

  // APP_SCHEMA_FILE env var: used by E2E fixtures when the inline APP_SCHEMA
  // JSON would exceed Linux ARG_MAX (~2 MiB) at child-process spawn — e.g.
  // mounting the ~5600-line `designSystemReferenceApp`. Same file-loading
  // semantics as the CLI `filePath` arg above; checked BEFORE APP_SCHEMA so
  // fixtures can prefer the file path even when both are set.
  const appSchemaFileEnv = Bun.env.APP_SCHEMA_FILE
  if (appSchemaFileEnv) {
    // No `configFile` — see {@link ResolvedAppSchema.configFile}.
    return { app: await loadSchemaFromFile(appSchemaFileEnv, command) }
  }

  // Try APP_SCHEMA environment variable
  const appSchemaEnv = Bun.env.APP_SCHEMA

  if (appSchemaEnv) {
    try {
      return { app: await parseSchemaFromEnv(appSchemaEnv) }
    } catch (error) {
      printStderr(`Error: ${error instanceof Error ? error.message : String(error)}`)
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
  }

  // Auto-discovery, LAST. Placed after both env vars on purpose: every
  // invocation that resolves today keeps resolving to exactly what it resolves
  // to now, so this step only fires on the path that used to error and exit.
  //
  // Reusing `loadSchemaFromFile` means a discovered-but-broken config produces
  // the identical `Failed to parse YAML file` / ParseError output as an
  // explicitly named one — no second error vocabulary.
  //
  // The filename is returned alongside the schema, not swallowed: a discovered
  // config has to anchor `public/`, the config hash, `SOVRIUM_CONTENT_DIR` and
  // `--watch` exactly as a named one does. That equivalence IS the acceptance
  // criterion, not an implementation nicety.
  const discovered = await discoverDefaultConfigFile(process.cwd())
  if (discovered) {
    printStderr(formatDiscoveredConfigNotice(discovered))
    return { app: await loadSchemaFromFile(discovered, command), configFile: discovered }
  }

  // No configuration provided
  return showNoConfigError(command)
}

/**
 * Parse and validate app schema from file path or environment variable.
 *
 * The schema-only view of {@link resolveAppSchema}, for callers that never
 * anchor anything to the config's directory (`admin create`).
 */
export const parseAppSchema = async (command: string, filePath?: string): Promise<AppEncoded> =>
  (await resolveAppSchema(command, filePath)).app
