/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The configuration tools, and the dispatcher both transports share.
 *
 * ─── WHY THIS LIVES IN THE APPLICATION LAYER ────────────────────────────────
 *
 * The companion user stories name `src/presentation/api/mcp/config-tools.ts`
 * as the shared compiler, and that placement cannot hold: `src/cli/**` may not
 * import `src/presentation/**` at all (`CLI_ALLOWLIST` in
 * `[internal ref]` omits the whole tree, deliberately). A module
 * BOTH a Hono route and a CLI verb may reach has exactly one home, and this is
 * it — every use-case is on the `to:` list of both elements.
 *
 * What lives here is therefore the transport-agnostic half: the tool
 * DEFINITIONS, the dotted-path narrowing of the JSON Schema document, and the
 * `tools/call` dispatch. What does NOT live here is any I/O — a use-case may
 * reach neither `infrastructure-config` (the `$ref` loader) nor
 * `infrastructure-server` (the status file), so the three reads arrive through
 * the injected {@link ConfigToolsProvider}. Each transport supplies its own:
 * the stdio verb reads the DISK, the HTTP mount reflects the BOOTED instance.
 * That split is the two stories' own, not an implementation shortcut — see
 * `[internal ref]`.
 *
 * ─── THE WRITE HALF, AND WHERE IT STOPS ─────────────────────────────────────
 *
 * [internal ref] amendment A8 authorises the four reads as surface 9 and
 * `config_list_files` / `config_read_file` / `config_write_file` /
 * `config_undo` as surface 10 — the first surface in that ADR's history that
 * can change what the instance runs. Four things keep that tolerable, and three
 * of them are enforced HERE by omission:
 *
 * - {@link compileConfigTools} emits the write four only when its caller asks,
 *   and the HTTP mount never does. An HTTP-served instance therefore registers
 *   no write tool, so there is no endpoint to reach (A8 bound 2).
 * - {@link isConfigToolName} widens the same way, so a write name arriving on a
 *   transport that did not compile it is an unknown tool rather than a call.
 * - {@link handleConfigToolCall} refuses every write suffix when the provider
 *   supplies no {@link ConfigWriteOperations}, which is the state every existing
 *   caller is in.
 *
 * The fourth is the whole of the eight-bound pipeline, and it is deliberately
 * NOT here: every step of it opens a file, a graph or a database, and this layer
 * may do none of those. It arrives injected, from `src/cli/commands/mcp.ts`.
 *
 * @see [internal ref] (A8)
 */

import { generateAppJsonSchema } from '@/domain/models/app/app-json-schema'
import type { ConfigFinding } from '@/domain/models/app/app-excess-property-report'

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

/**
 * The four suffixes, fixed by A8.
 *
 * Static — derived from `app.name` alone and never from `app.tables[]` — so
 * every instance publishes exactly these four and no configuration can add,
 * remove or rename one.
 */
export const CONFIG_TOOL_SUFFIXES = ['read', 'validate', 'schema', 'status'] as const

type ConfigToolSuffix = (typeof CONFIG_TOOL_SUFFIXES)[number]

/**
 * The four write suffixes, fixed by A8 surface 10.
 *
 * Static for the same reason the reads are: derived from `app.name` alone, so
 * no configuration can add, remove or rename one. A8 writes them bare
 * (`config_list_files`) exactly as it writes `config_read` bare for surface 9;
 * the `{appName}_` prefix is the convention every compiled tool carries, not a
 * widening.
 */
export const CONFIG_WRITE_TOOL_SUFFIXES = ['list_files', 'read_file', 'write_file', 'undo'] as const

type ConfigWriteToolSuffix = (typeof CONFIG_WRITE_TOOL_SUFFIXES)[number]

/**
 * The wire shape of one compiled tool.
 *
 * Structurally identical to `CompiledTool` in
 * `src/presentation/api/mcp/tool-compiler.ts` rather than imported from it —
 * an application module may not name a presentation type, and the HTTP mount
 * spreads these into its own catalog where structural assignability does the
 * rest.
 */
export interface ConfigToolDefinition {
  readonly name: string
  readonly description: string
  readonly inputSchema: {
    readonly type: 'object'
    readonly properties: Record<string, unknown>
    readonly required?: ReadonlyArray<string>
  }
  readonly annotations: {
    readonly readOnlyHint: boolean
    readonly destructiveHint: boolean
    readonly idempotentHint: boolean
    readonly openWorldHint: boolean
  }
}

/** Every surface-9 config tool is a read: the same four bits on all four. */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

/**
 * What the two WRITERS declare, and it is the honest reading rather than the
 * flattering one.
 *
 * `destructiveHint: true` on both, because overwriting a file is a destructive
 * update of that file whatever the tool then refuses to do to a table — and
 * `_config_undo` overwrites several at once. A client that asks the human before
 * running a destructive tool is behaving correctly here; understating this to
 * win an auto-approve is the one thing these annotations must not do.
 */
const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const

const NO_ARGUMENTS = { type: 'object', properties: {} } as const

const TOOL_DESCRIPTIONS: Readonly<Record<ConfigToolSuffix, string>> = {
  read: "Read this instance's configuration as booted, with declared secrets redacted. Returns { config, files, configHash }.",
  validate:
    "Validate this instance's configuration and report every finding in `sovrium validate --json` vocabulary. Returns { valid, findings, notices }; an invalid config is a normal result, not an error.",
  schema:
    'Return the Draft 2020-12 JSON Schema for the config file, or the sub-schema at a dotted CONFIG path such as `tables` or `tables.fields`.',
  status:
    'Report what this instance is doing now, from the status file a running server publishes. Returns the status document, or { "state": "not-running" } when nothing is running.',
}

/** The fully-qualified name of one config tool. */
export const configToolName = (
  appName: string,
  suffix: ConfigToolSuffix | ConfigWriteToolSuffix
): string => `${appName}_config_${suffix}`

/**
 * The write tools' descriptions.
 *
 * Each one states the bound its caller has to satisfy, because an AI reads this
 * and nothing else before its first call: a caller that was never told about
 * `expectedSha` cannot supply one, and a caller that does not know the tools
 * move WHOLE FILE BYTES will send a fragment and destroy the rest of the file.
 */
const WRITE_TOOL_DESCRIPTIONS: Readonly<Record<ConfigWriteToolSuffix, string>> = {
  list_files:
    'List every file the config graph is made of — the root plus each `$ref` partial — with each path relative to the project directory. Returns { files: [{ path, sha256, bytes }] }. Read this first: the digests are the `expectedSha` values a write must carry.',
  read_file:
    'Read one config file of the graph, verbatim. Returns { path, content, sha256 }. The bytes are the whole file, comments and key order included; edit them and send the whole file back.',
  write_file:
    'Replace one config file with `content`, WHOLE FILE BYTES. Requires `expectedSha` — the digest of the bytes the edit was based on — which is refused if the file changed on disk meanwhile. The candidate is decoded as part of the whole app before anything is written, and an invalid one is refused with findings instead. Set `acknowledgeDataLoss: true` ONLY when the operator has agreed to lose data. Returns { path, sha256, snapshot, reloadHint }.',
  undo: 'Restore the most recent config snapshot that differs from what is on disk now — the way back from an edit the operator did not want. Returns { snapshot, files }, naming what it changed.',
}

/** `_config_write_file`'s arguments, which are the whole of bounds 2 and 6. */
const WRITE_FILE_ARGUMENTS = {
  type: 'object' as const,
  properties: {
    path: {
      type: 'string',
      description:
        'Path of the file to replace, relative to the project directory — exactly as `_config_list_files` reported it.',
    },
    content: {
      type: 'string',
      description: 'The complete new contents of the file. Not a patch and not a fragment.',
    },
    expectedSha: {
      type: 'string',
      description:
        'sha256 of the bytes this edit was based on, as `_config_read_file` returned it. A mismatch is refused so a concurrent human edit is never silently overwritten.',
    },
    acknowledgeDataLoss: {
      type: 'boolean',
      description:
        'Required when the candidate introduces `allowDestructive: true` on a table. Set it ONLY on the operator’s explicit instruction: it is their consent to lose the data in the dropped columns, never the assistant’s.',
    },
  },
  required: ['path', 'content', 'expectedSha'],
} as const

const READ_FILE_ARGUMENTS = {
  type: 'object' as const,
  properties: {
    path: {
      type: 'string',
      description:
        'Path of the file to read, relative to the project directory — exactly as `_config_list_files` reported it.',
    },
  },
  required: ['path'],
} as const

const writeToolInputSchema = (
  suffix: ConfigWriteToolSuffix
): ConfigToolDefinition['inputSchema'] => {
  if (suffix === 'write_file') return WRITE_FILE_ARGUMENTS
  if (suffix === 'read_file') return READ_FILE_ARGUMENTS
  return NO_ARGUMENTS
}

/** The two readers of surface 10 are reads; the two writers are not. */
const isWriteToolReadOnly = (suffix: ConfigWriteToolSuffix): boolean =>
  suffix === 'list_files' || suffix === 'read_file'

/**
 * Compile the four write tools for one app name.
 *
 * Called only where A8 authorises them: `sovrium mcp`, with `MCP_CONFIG_WRITE`
 * set AND a project directory somebody named on purpose. Every other caller of
 * {@link compileConfigTools} leaves `writeEnabled` unset and gets surface 9
 * alone.
 */
const compileConfigWriteTools = (appName: string): ReadonlyArray<ConfigToolDefinition> =>
  CONFIG_WRITE_TOOL_SUFFIXES.map((suffix) => ({
    name: configToolName(appName, suffix),
    description: WRITE_TOOL_DESCRIPTIONS[suffix],
    inputSchema: writeToolInputSchema(suffix),
    annotations: isWriteToolReadOnly(suffix) ? READ_ONLY_ANNOTATIONS : WRITE_ANNOTATIONS,
  }))

/**
 * Compile the four tools for one app name.
 *
 * `_config_schema` is the only one taking an argument, and it takes a dotted
 * CONFIG path rather than a JSON pointer: `tables.fields`, not
 * `/properties/tables/items/properties/fields`. The dotted form is the
 * vocabulary the config author already writes and the one `ConfigFinding.path`
 * speaks; a pointer would make the caller learn the schema document's own
 * internal shape in order to ask a question about their config.
 */
export const compileConfigTools = (
  appName: string,
  options: ConfigToolCompileOptions = {}
): ReadonlyArray<ConfigToolDefinition> => [
  ...CONFIG_TOOL_SUFFIXES.map((suffix) => ({
    name: configToolName(appName, suffix),
    description: TOOL_DESCRIPTIONS[suffix],
    inputSchema:
      suffix === 'schema'
        ? {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string',
                description:
                  'Dotted config path to narrow the document to, e.g. `tables` or `tables.fields`. Omit for the whole schema.',
              },
            },
          }
        : NO_ARGUMENTS,
    annotations: READ_ONLY_ANNOTATIONS,
  })),
  ...(options.writeEnabled === true ? compileConfigWriteTools(appName) : []),
]

/** What a transport may ask {@link compileConfigTools} for beyond surface 9. */
export interface ConfigToolCompileOptions {
  /**
   * Emit A8 surface 10 as well.
   *
   * Absent or `false` everywhere but the stdio verb, and that default is the
   * enforcement: a transport that has not opted in has no write path, because
   * the tools it never compiled are tools it cannot be asked to run.
   */
  readonly writeEnabled?: boolean | undefined
}

/**
 * Whether `toolName` is one of this app's config tools.
 *
 * Takes the same `writeEnabled` as {@link compileConfigTools} and for the same
 * reason: the two must agree, or a name the mount never published would still
 * route into the dispatcher below. Leave it unset and only surface 9 matches.
 */
export const isConfigToolName = (
  appName: string,
  toolName: string,
  options: ConfigToolCompileOptions = {}
): boolean =>
  CONFIG_TOOL_SUFFIXES.some((suffix) => configToolName(appName, suffix) === toolName) ||
  (options.writeEnabled === true &&
    CONFIG_WRITE_TOOL_SUFFIXES.some((suffix) => configToolName(appName, suffix) === toolName))

/**
 * The user-defined table whose tools would collide with a config tool, if any.
 *
 * `{app}_config_read` is also what a table called `config` compiles to
 * (`{app}_{table}_{op}`). Two tools cannot answer to one name: whichever
 * resolver runs first wins and the other is unreachable — silently, with the
 * loser being either the operator's own data tool or the surface A8 authorised.
 * The reserved-prefix cross-validator already refuses `auth_*` / `system_*`
 * table names for exactly this reason; here the collision is on an exact name
 * rather than a prefix, so it is caught where the app name and the table names
 * are both in hand.
 */
export const findConfigToolTableCollision = (
  tableNames: ReadonlyArray<string>
): string | undefined => tableNames.find((name) => name.toLowerCase() === 'config')

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

type SchemaNode = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is SchemaNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The generated document is ~840 KB; generating it per call is pure waste. */
const documentCache = new Map<'schema', SchemaNode>()

const appJsonSchemaDocument = (): SchemaNode => {
  const cached = documentCache.get('schema')
  if (cached !== undefined) return cached
  const document = generateAppJsonSchema() as SchemaNode
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- memoize the one document every call narrows
  documentCache.set('schema', document)
  return document
}

/** Follow `$ref: '#/$defs/X'` to the definition it names. Cycle-safe by depth. */
const deref = (node: SchemaNode, root: SchemaNode, depth = 0): SchemaNode => {
  const ref = node['$ref']
  if (typeof ref !== 'string' || !ref.startsWith('#/$defs/') || depth > 16) return node
  const defs = root['$defs']
  if (!isRecord(defs)) return node
  const target = defs[ref.slice('#/$defs/'.length)]
  return isRecord(target) ? deref(target, root, depth + 1) : node
}

/**
 * Drop the `null` arm of a nullable union and follow into the real branch.
 *
 * Every optional root key renders as `anyOf: [{ $ref }, { type: 'null' }]`, so
 * a walk that did not unwrap would stop at the union and report that `tables`
 * declares nothing.
 */
const unwrapUnion = (node: SchemaNode, root: SchemaNode, depth = 0): SchemaNode => {
  const branches = node['anyOf'] ?? node['oneOf']
  if (!Array.isArray(branches) || depth > 16) return node
  const real = branches
    .filter((branch): branch is SchemaNode => isRecord(branch))
    .map((branch) => deref(branch, root))
    .find((branch) => branch['type'] !== 'null')
  return real === undefined ? node : unwrapUnion(real, root, depth + 1)
}

/** An array node stands for its element: `tables.fields` means a TABLE's fields. */
const throughArray = (node: SchemaNode, root: SchemaNode): SchemaNode => {
  const { items } = node
  return isRecord(items) ? unwrapUnion(deref(items, root), root) : node
}

/** The node a dotted path names, normalised so the caller gets a usable schema. */
const normalise = (node: SchemaNode, root: SchemaNode): SchemaNode =>
  unwrapUnion(deref(node, root), root)

const keysAt = (node: SchemaNode): ReadonlyArray<string> => {
  const { properties } = node
  return isRecord(properties) ? Object.keys(properties) : []
}

const refuseSegment = (segment: string, resolved: string, node: SchemaNode): ConfigToolOutcome => {
  const keys = keysAt(node)
  const available =
    keys.length > 0
      ? `Keys that resolve here: ${keys.join(', ')}.`
      : 'Nothing resolves below this point — it is not an object in the schema.'
  const where = resolved === '' ? 'the config root' : `\`${resolved}\``
  return {
    kind: 'refused',
    code: CONFIG_TOOL_INVALID_PARAMS,
    message: `Unknown config path segment '${segment}' under ${where}. ${available}`,
  }
}

interface WalkState {
  readonly node: SchemaNode
  readonly resolved: string
  readonly refusal?: ConfigToolOutcome
}

const walkSegment = (state: WalkState, segment: string, root: SchemaNode): WalkState => {
  if (state.refusal !== undefined) return state
  const here = throughArray(normalise(state.node, root), root)
  const { properties } = here
  const next = isRecord(properties) ? properties[segment] : undefined
  if (!isRecord(next)) return { ...state, refusal: refuseSegment(segment, state.resolved, here) }
  return {
    node: next,
    resolved: state.resolved === '' ? segment : `${state.resolved}.${segment}`,
  }
}

/**
 * The whole JSON Schema document, or the sub-schema at a dotted config path.
 *
 * The returned sub-schema is DEREFERENCED at its root but keeps any nested
 * `#/$defs/...` pointers, so it stays a fraction of the whole document while
 * remaining resolvable against it. An unresolvable segment is refused with the
 * keys that DO resolve, rather than with an empty object a reader would take
 * for "this declares nothing" — the same "say what may be written here
 * instead" contract `ConfigFinding.accepted` carries.
 */
export const resolveConfigSchemaPath = (path: string | undefined): ConfigToolOutcome => {
  const root = appJsonSchemaDocument()
  if (path === undefined || path.trim() === '') return { kind: 'result', payload: root }
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  if (segments.length === 0) return { kind: 'result', payload: root }
  const walked = segments.reduce<WalkState>((state, segment) => walkSegment(state, segment, root), {
    node: root,
    resolved: '',
  })
  return walked.refusal ?? { kind: 'result', payload: normalise(walked.node, root) }
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
