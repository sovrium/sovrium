/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `tools/call` for the configuration tools: the reads each transport injects,
 * the outcome a call answers, the `_config_schema` narrowing, and the write
 * dispatch.
 *
 * The tool DEFINITIONS, and the reasons this family lives in the application
 * layer and where its write half stops, are in the sibling `config-mcp-tools.ts`.
 * The dotted-path walk itself is pure and lives in the domain
 * (`@/domain/kernel/config-parsing/json-schema-path`); this module only renders
 * the document once and words the refusal.
 *
 * @see [internal ref] (A8)
 */

import {
  CONFIG_WRITE_TOOL_SUFFIXES,
  type ConfigWriteToolSuffix,
} from '@/application/use-cases/config/config-mcp-tools'
import {
  resolveJsonSchemaPath,
  type JsonSchemaNode,
} from '@/domain/kernel/config-parsing/json-schema-path'
import { generateAppJsonSchema } from '@/domain/models/app/app-json-schema'
import type { ConfigFinding } from '@/domain/kernel/config-parsing/decode-report-format'

// ---------------------------------------------------------------------------
// The reads each transport supplies
// ---------------------------------------------------------------------------

/** `{app}_config_read`'s payload. */
export interface ConfigReadPayload {
  /** The configuration, redacted through `redactAppConfigForReflection`. */
  readonly config: unknown
  /** Every file the config is made of — the root plus each `$ref` partial. */
  readonly files: ReadonlyArray<string>
  /** The hash published as `X-Sovrium-Config` and recorded in the lock file. */
  readonly configHash: string
}

/** `{app}_config_validate`'s payload — `sovrium validate --json`'s vocabulary. */
export interface ConfigValidatePayload {
  readonly valid: boolean
  readonly findings: ReadonlyArray<ConfigFinding>
  readonly notices: ReadonlyArray<string>
}

/**
 * The shape reported when no instance published a status file.
 *
 * Produced HERE and nowhere else, which is the point of it being here at all:
 * a caller polling after an edit must be able to tell "nothing is running" from
 * "the read failed", and only a declared value does that. Both transports used
 * to declare their own, each with a comment claiming to be the sole producer —
 * which is precisely how two channels come to answer one question differently.
 */
const NOT_RUNNING: Readonly<Record<string, unknown>> = { state: 'not-running' }

/**
 * Narrow whatever a transport read into the status document, or `not-running`.
 *
 * The input is `unknown` deliberately. The document is a FILE this process did
 * not necessarily write — a stale one from an older version, or one caught
 * half-written — so it is narrowed rather than trusted, and neither transport
 * needs a cast at the seam that supplies it.
 *
 * @public
 */
export const asStatusDocument = (document: unknown): Readonly<Record<string, unknown>> =>
  typeof document === 'object' && document !== null && !Array.isArray(document)
    ? (document as Readonly<Record<string, unknown>>)
    : NOT_RUNNING

/**
 * The three reads this module cannot perform for itself.
 *
 * Injected rather than imported because a use-case may reach neither the
 * `$ref` loader nor the status file. Each transport binds them to what it can
 * actually see.
 */
export interface ConfigToolsProvider {
  readonly appName: string
  readonly readConfig: () => Promise<ConfigReadPayload>
  readonly validateConfig: () => Promise<ConfigValidatePayload>
  /** The status document, or `{ state: 'not-running' }` when none was published. */
  readonly readStatus: () => Promise<Readonly<Record<string, unknown>>>
  /**
   * A8 surface 10, when the transport is authorised to offer it.
   *
   * Absent on every transport but `sovrium mcp`, and absent there too unless
   * `MCP_CONFIG_WRITE` is set and the project directory was named explicitly.
   * The dispatcher refuses every write suffix when it is missing, so the four
   * halves of the gate — the env flag, the explicit root, the compile option and
   * this field — all have to agree before a byte moves.
   */
  readonly write?: ConfigWriteOperations | undefined
}

/** One file of the config graph, as `_config_list_files` reports it. */
export interface ConfigFileEntry {
  /** Relative to the project directory — never absolute, never an operator home. */
  readonly path: string
  readonly sha256: string
  readonly bytes: number
}

/** What `_config_write_file` was asked to do, once its arguments have been read. */
export interface ConfigWriteRequest {
  readonly path: string
  readonly content: string
  readonly expectedSha: string
  /** The operator's consent to lose data. Defaulted to `false`, never inferred. */
  readonly acknowledgeDataLoss: boolean
}

/**
 * The four operations this layer cannot perform for itself.
 *
 * Every one of them opens a file, a `$ref` graph or a database, so every one of
 * them arrives injected — the same rule the three reads above already follow,
 * applied to a surface where breaking it would put I/O in the layer that must
 * stay pure.
 *
 * `readFile`, `writeFile` and `undo` answer a {@link ConfigToolOutcome} rather
 * than a value, because each of them REFUSES for reasons only the filesystem
 * knows and those refusals are the feature. `listFiles` cannot refuse: an empty
 * graph is an answer.
 */
export interface ConfigWriteOperations {
  readonly listFiles: () => Promise<ReadonlyArray<ConfigFileEntry>>
  readonly readFile: (path: string) => Promise<ConfigToolOutcome>
  readonly writeFile: (request: ConfigWriteRequest) => Promise<ConfigToolOutcome>
  readonly undo: () => Promise<ConfigToolOutcome>
}

/**
 * The outcome of one `tools/call`.
 *
 * A refusal is DATA here rather than a thrown `ProtocolError`, because the SDK
 * types that error and this layer may not name the SDK. Each transport adapter
 * turns a `refused` into the JSON-RPC error member its own wire needs.
 */
export type ConfigToolOutcome =
  | { readonly kind: 'result'; readonly payload: unknown }
  | {
      readonly kind: 'refused'
      readonly code: number
      readonly message: string
      /**
       * Structured detail riding beside the sentence, for the reader that is
       * not a person.
       *
       * Optional, and every existing refusal omits it. It exists for bound 3 of
       * A8 surface 10: a candidate that fails to decode comes back carrying its
       * `findings` in `sovrium validate --json`'s vocabulary, so the AI is told
       * no in the SAME words `_config_validate` would have used rather than in
       * a prose sentence it has to parse back apart. `ProtocolError(code,
       * message, data?)` already carries it onto the wire.
       */
      readonly data?: unknown
    }

/** JSON-RPC `Invalid params` — the code an unresolvable argument earns. */
export const CONFIG_TOOL_INVALID_PARAMS = -32_602

// ---------------------------------------------------------------------------
// `_config_schema` — the dotted-path walk
// ---------------------------------------------------------------------------

/** The generated document is ~840 KB; generating it per call is pure waste. */
const documentCache = new Map<'schema', JsonSchemaNode>()

const appJsonSchemaDocument = (): JsonSchemaNode => {
  const cached = documentCache.get('schema')
  if (cached !== undefined) return cached
  const document = generateAppJsonSchema() as JsonSchemaNode
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- memoize the one document every call narrows
  documentCache.set('schema', document)
  return document
}

/**
 * The whole JSON Schema document, or the sub-schema at a dotted config path.
 *
 * An unresolvable segment is refused with the keys that DO resolve, rather
 * than with an empty object a reader would take for "this declares nothing" —
 * the same "say what may be written here instead" contract
 * `ConfigFinding.accepted` carries.
 */
export const resolveConfigSchemaPath = (path: string | undefined): ConfigToolOutcome => {
  const walked = resolveJsonSchemaPath(appJsonSchemaDocument(), path)
  if (walked.found) return { kind: 'result', payload: walked.schema }
  const available =
    walked.availableKeys.length > 0
      ? `Keys that resolve here: ${walked.availableKeys.join(', ')}.`
      : 'Nothing resolves below this point — it is not an object in the schema.'
  const where = walked.resolved === '' ? 'the config root' : `\`${walked.resolved}\``
  return {
    kind: 'refused',
    code: CONFIG_TOOL_INVALID_PARAMS,
    message: `Unknown config path segment '${walked.segment}' under ${where}. ${available}`,
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const readPathArgument = (args: Readonly<Record<string, unknown>>): string | undefined => {
  const { path } = args
  return typeof path === 'string' ? path : undefined
}

/**
 * Answer one `tools/call` for a config tool.
 *
 * The caller has already decided the name belongs to this family
 * ({@link isConfigToolName}) and, on a transport that has a session, that the
 * caller may see it.
 */
export const handleConfigToolCall = async (
  provider: ConfigToolsProvider,
  toolName: string,
  args: Readonly<Record<string, unknown>>
): Promise<ConfigToolOutcome> => {
  const suffix = toolName.slice(`${provider.appName}_config_`.length)
  if (suffix === 'read') return { kind: 'result', payload: await provider.readConfig() }
  if (suffix === 'validate') return { kind: 'result', payload: await provider.validateConfig() }
  if (suffix === 'status') return { kind: 'result', payload: await provider.readStatus() }
  if (suffix === 'schema') return resolveConfigSchemaPath(readPathArgument(args))
  if (isWriteSuffix(suffix)) return dispatchWriteCall(provider.write, suffix, args)
  return {
    kind: 'refused',
    code: CONFIG_TOOL_INVALID_PARAMS,
    message: `Unknown config tool '${toolName}'.`,
  }
}

const isWriteSuffix = (suffix: string): suffix is ConfigWriteToolSuffix =>
  (CONFIG_WRITE_TOOL_SUFFIXES as ReadonlyArray<string>).includes(suffix)

const refuse = (message: string, data?: unknown): ConfigToolOutcome => ({
  kind: 'refused',
  code: CONFIG_TOOL_INVALID_PARAMS,
  message,
  ...(data === undefined ? {} : { data }),
})

/**
 * The refusal a write suffix earns when the transport never supplied the
 * operations.
 *
 * Reachable only if a transport compiles the write tools and then fails to
 * inject them, which is a wiring mistake rather than a caller's — so it says
 * what is true of the SERVER rather than blaming the request.
 */
const NO_WRITE_OPERATIONS =
  'Config writing is not enabled on this server. The write tools are stdio-only: run ' +
  '`sovrium mcp --project <dir>` with MCP_CONFIG_WRITE=1.'

/** Read one required string argument, or say which one was missing. */
const requireString = (
  args: Readonly<Record<string, unknown>>,
  key: string
): { readonly value: string } | { readonly missing: string } => {
  const value = args[key]
  return typeof value === 'string' ? { value } : { missing: key }
}

const readWriteRequest = (
  args: Readonly<Record<string, unknown>>
): ConfigWriteRequest | ConfigToolOutcome => {
  const path = requireString(args, 'path')
  const content = requireString(args, 'content')
  const expectedSha = requireString(args, 'expectedSha')
  const missing = [path, content, expectedSha].flatMap((read) =>
    'missing' in read ? [read.missing] : []
  )
  if (
    missing.length > 0 ||
    !('value' in path) ||
    !('value' in content) ||
    !('value' in expectedSha)
  )
    return refuse(
      `_config_write_file needs a string ${missing.join(', ')}. Read the file with ` +
        '`_config_read_file` first and send its `sha256` back as `expectedSha`.'
    )
  return {
    path: path.value,
    content: content.value,
    expectedSha: expectedSha.value,
    // Never inferred and never defaulted to true: this is the operator's
    // consent to lose data, so anything that is not a literal `true` is a no.
    acknowledgeDataLoss: args['acknowledgeDataLoss'] === true,
  }
}

const dispatchWriteCall = async (
  write: ConfigWriteOperations | undefined,
  suffix: ConfigWriteToolSuffix,
  args: Readonly<Record<string, unknown>>
): Promise<ConfigToolOutcome> => {
  if (write === undefined) return refuse(NO_WRITE_OPERATIONS)
  if (suffix === 'list_files')
    return { kind: 'result', payload: { files: await write.listFiles() } }
  if (suffix === 'undo') return write.undo()
  if (suffix === 'read_file') {
    const path = readPathArgument(args)
    return path === undefined
      ? refuse('_config_read_file needs a string `path`, relative to the project directory.')
      : write.readFile(path)
  }
  const request = readWriteRequest(args)
  return 'kind' in request ? request : write.writeFile(request)
}
