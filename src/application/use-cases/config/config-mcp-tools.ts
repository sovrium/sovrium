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
 * `tools/call` dispatch (the last two in the sibling `config-mcp-tool-call.ts`,
 * the walk itself in the domain). What does NOT live here is any I/O — a use-case may
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

export type ConfigWriteToolSuffix = (typeof CONFIG_WRITE_TOOL_SUFFIXES)[number]

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
