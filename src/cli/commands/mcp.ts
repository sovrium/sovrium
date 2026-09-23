/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium mcp` — the read-only configuration MCP server, over stdio.
 *
 * A short-lived, read-only process. It boots no server, opens no database
 * connection, writes no lock file and binds no port: it reads a config file,
 * answers newline-delimited JSON-RPC on stdin, and exits when stdin closes.
 * That is the whole of it.
 *
 * It is NOT `MCP_TRANSPORT=stdio`. That env value has never read stdin — it
 * only suppresses the HTTP `/mcp` mount. The stdio entry point is this verb,
 * reached by running the binary rather than by setting a variable.
 *
 * ─── STDOUT CARRIES JSON AND NOTHING ELSE ───────────────────────────────────
 *
 * The MCP stdio binding makes this a MUST NOT: *"The server MUST NOT write
 * anything to its stdout that is not a valid MCP message"*, and *"The server
 * MAY write UTF-8 strings to stderr for any logging purposes"*. So every
 * banner, notice, warning and error this verb produces goes through
 * `printStderr`. Do not reach for `Console.log`, `printJournal` or
 * `printStartupSummary` anywhere below: all three write to stdout, and one
 * stray line desynchronises any client that is not the lenient reference SDK.
 *
 * ─── DUAL-ERA, AND WHY ──────────────────────────────────────────────────────
 *
 * The HTTP mount runs the modern `2026-07-28` era with `legacy: 'reject'`
 * — a decision about a NETWORKED resource server, where a session
 * model and OAuth make demanding the newer era worth its cost. A pipe is not
 * that. This verb exists to be spawned by desktop AI clients, and Claude Code
 * connects stdio servers on the LEGACY runtime by default, so a modern-only
 * server would fail against a default-configured client.
 *
 * `serveStdio(..., { legacy: 'serve' })` owns that choice: the opening message
 * selects the era — `initialize` pins legacy for the connection, a valid
 * modern `_meta` envelope or `server/discover` pins modern — and ONE instance
 * from the factory serves it. The spec authorises exactly this and marks
 * *legacy client × modern server = Fails*, *dual-era × anything = Works*.
 *
 * ─── AUTHENTICATION ─────────────────────────────────────────────────────────
 *
 * There is none, and that is the decision ([internal ref] A8 Part 1): the process was
 * spawned by the user, runs as the user, and reads a directory the user named,
 * so the operating system's process boundary is the whole of the
 * authentication. Two consequences follow — a config with no `auth:` block
 * works, because no Better Auth instance is ever constructed; and `MCP_ENABLED`
 * is irrelevant here, so the combination that makes `sovrium start` refuse to
 * boot (`MCP_ENABLED=true` with no `app.auth`) does not affect this verb.
 *
 */

import { join, resolve } from 'node:path'
import {
  ProtocolError,
  Server,
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
} from '@modelcontextprotocol/server'
import { StdioServerTransport, serveStdio } from '@modelcontextprotocol/server/stdio'
import {
  asStatusDocument,
  compileConfigTools,
  handleConfigToolCall,
  isConfigToolName,
  type ConfigReadPayload,
  type ConfigToolsProvider,
  type ConfigValidatePayload,
} from '@/application/use-cases/config/config-mcp-tools'
import { formatDiscoveredConfigNotice } from '@/domain/kernel/config-parsing/default-config-files'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { parseConfigFileName } from '@/domain/models/process-env/desktop'
import { parseMcpConfigWrite } from '@/domain/models/process-env/mcp'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { readStatusDocument } from '@/infrastructure/server/status-file'
import { loadConfigGraph } from './mcp-config-graph'
import { buildConfigWriteOperations } from './mcp-config-write'
import { getCurrentVersion } from './update'
import { lazyImportSchema } from './utils'
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/server'

/** Options `sovrium mcp` accepts. */
export interface McpCommandOptions {
  /** `--project <dir>` — the directory to read the config from. */
  readonly projectDir?: string | undefined
}

/**
 * The namespace tools fall back to when no config could be read.
 *
 * A directory holding no config is not a crash: the handshake and `tools/list`
 * still answer, and the tools report the missing config in their results. They
 * need SOME namespace to be named in, and an AI pointed at the wrong folder is
 * better served by four tools that explain the problem than by a protocol
 * error it has to catch.
 */
const FALLBACK_APP_NAME = 'sovrium'

// ---------------------------------------------------------------------------
// Config discovery
// ---------------------------------------------------------------------------

/**
 * The directory whose config this session serves, most specific first.
 *
 * `--project` beats `SOVRIUM_PROJECT_DIR` beats the working directory. The
 * env var is how a desktop launcher names the project without rewriting the
 * client's argv.
 */
const resolveProjectDir = (projectDir: string | undefined): string => {
  const fromEnv = process.env['SOVRIUM_PROJECT_DIR']
  if (projectDir !== undefined && projectDir !== '') return resolve(projectDir)
  if (fromEnv !== undefined && fromEnv !== '') return resolve(fromEnv)
  return process.cwd()
}

/**
 * Whether the project directory was named EXPLICITLY, captured before anything
 * anchors it.
 *
 * The order is the whole of it, and getting it wrong makes the bound vacuous
 * rather than wrong-looking. {@link anchorProjectDir} writes the RESOLVED
 * directory back into `process.env.SOVRIUM_PROJECT_DIR` — including the cwd
 * FALLBACK — so by the time anything reads that variable it always answers. A
 * condition derived from the environment after the anchor is permanently true,
 * and the write surface would then be offered in every directory a client
 * happened to be sitting in.
 *
 * Why the condition exists at all: `sovrium mcp` falls back to `process.cwd()`
 * when neither source names a folder, and the cwd is the CLIENT's choice, not
 * the operator's. A read surface can live with that. A write surface confines
 * itself to a root, so the root has to be one somebody chose on purpose.
 */
const wasProjectDirDeclared = (projectDir: string | undefined): boolean => {
  const fromEnv = process.env['SOVRIUM_PROJECT_DIR']
  return (
    (projectDir !== undefined && projectDir !== '') || (fromEnv !== undefined && fromEnv !== '')
  )
}

/**
 * Republish the resolved directory as `SOVRIUM_PROJECT_DIR`, so that the two
 * readers of "the project" cannot disagree.
 *
 * There are two, and the split is deliberate (`process-env/desktop.ts`):
 * `parseProjectDir()` RESOLVES a path and falls back to the cwd, while
 * `parseProjectDirJail()` CONFINES the `$ref` graph and exists only when a
 * supervisor explicitly named a folder. `--project` is exactly such a naming —
 * but it arrives on argv, where neither reader can see it, so a
 * `--project` that disagreed with an inherited env var would resolve the config
 * from one directory and jail its partials to the other. The graph then fails
 * to load with a message about a folder the operator never mentioned.
 *
 * Writing it once here is what makes `--project` win outright: the flag names
 * the project, and the project is both where the config is read from and the
 * whole of what may be read.
 */
const anchorProjectDir = (projectDir: string): void => {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- the process env IS the channel both readers share
  process.env['SOVRIUM_PROJECT_DIR'] = projectDir
}

/**
 * Find the config inside the resolved directory, exactly as `sovrium start`
 * finds it, and announce it ON STDERR.
 *
 * `SOVRIUM_CONFIG_FILE` REPLACES the candidate probe rather than extending it:
 * naming a file means that file, and falling back to a different one would
 * serve something the supervisor did not ask for.
 *
 * The discovery notice is the same string every other command prints — one
 * wording, so a discovered config is never mysterious — but it lands on the
 * other stream here, which is the whole of `[internal ref]`.
 */
const discoverConfig = async (projectDir: string): Promise<string | undefined> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const named = parseConfigFileName()
  if (named !== undefined) {
    const namedPath = resolve(projectDir, named)
    printStderr(`[mcp] Using ${namedPath} (named by SOVRIUM_CONFIG_FILE)`)
    return namedPath
  }
  const discovered = await discoverDefaultConfigFile(projectDir)
  if (discovered === undefined) {
    printStderr(`[mcp] no config file found in ${projectDir}; serving the config tools anyway.`)
    return undefined
  }
  // `discoverDefaultConfigFile` answers with the BARE filename, relative to the
  // directory it probed — the shape `sovrium start app.yaml` already passes.
  // Every other command then runs from that directory; this one does not (the
  // client chose the cwd, not the operator), so the anchor is restored here.
  printStderr(`[mcp] ${formatDiscoveredConfigNotice(discovered)}`)
  return join(projectDir, discovered)
}

// ---------------------------------------------------------------------------
// The disk-backed reads
// ---------------------------------------------------------------------------

/**
 * The verdict on the config ON DISK, in `sovrium validate --json` vocabulary.
 *
 * The post-decode sweep is `sovrium validate`'s own, imported rather than
 * mirrored: a config that decodes and would then refuse to boot must not be
 * reported clean here either, and two copies of that rule would be free to
 * disagree about which configs are clean.
 */
const validateOnDisk = async (configPath: string | undefined): Promise<ConfigValidatePayload> => {
  if (configPath === undefined) return missingConfigVerdict()
  const { decodeAppConfigObject } = await import('@/application/use-cases/config/decode-app-config')
  const { runPostDecodeChecks } = await import('./validate')
  const graph = await loadConfigGraph(configPath)
  const decoded = decodeAppConfigObject(graph.parsed, { refSources: graph.refSources })
  if (!decoded.valid) return { valid: false, findings: decoded.findings, notices: [] }
  const postDecode = await runPostDecodeChecks(decoded, graph.refSources)
  return {
    valid: postDecode.length === 0,
    findings: postDecode.map((error) => messageAsConfigFinding(error)),
    notices: decoded.notices,
  }
}

const missingConfigVerdict = (): ConfigValidatePayload => ({
  valid: false,
  findings: [
    messageAsConfigFinding(
      'No config file found. `sovrium mcp` reads app.yaml, app.yml or app.ts from the project ' +
        'directory — pass --project <dir> to point it at the right one.'
    ),
  ],
  notices: [],
})

/**
 * The config as it is on disk, REDACTED, with its files and its hash.
 *
 * Redacted from the `$ref`-RESOLVED bytes rather than from a decoded `App`,
 * and that is deliberate: a config an AI has just half-rewritten is exactly
 * the one it needs to read back, so a read that only answered for configs that
 * decode would go dark at the moment it matters. `redactAppConfigForReflection`
 * walks structurally — `env[]`, `connections[]`, `tables[]`, `actions[]`,
 * `automations[]` carry the same shape encoded as decoded — so the redaction
 * A8 makes a CONDITION of this surface covers the same paths either way.
 */
const readOnDisk = async (configPath: string | undefined): Promise<ConfigReadPayload> => {
  if (configPath === undefined) return { config: undefined, files: [], configHash: '' }
  const { redactAppConfigForReflection } =
    await import('@/application/use-cases/admin/config/redact-app-config')
  const graph = await loadConfigGraph(configPath)
  return {
    config: redactAppConfigForReflection(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the redactor walks an `App`-SHAPED object; the encoded config is that shape
      graph.parsed as any,
      process.env
    ),
    files: graph.files,
    configHash: graph.configHash,
  }
}

/** The app name the four tools are namespaced under, read once at startup. */
const resolveAppName = async (configPath: string | undefined): Promise<string> => {
  if (configPath === undefined) return FALLBACK_APP_NAME
  try {
    const { decodeAppConfigObject } =
      await import('@/application/use-cases/config/decode-app-config')
    const graph = await loadConfigGraph(configPath)
    const decoded = decodeAppConfigObject(graph.parsed, { refSources: graph.refSources })
    if (decoded.valid) return decoded.app.name
    // An invalid config still has a name on the wire in almost every case —
    // the tools have to be namespaced under SOMETHING, and the name the author
    // typed is the one their client already has configured.
    const named = (graph.parsed as { readonly name?: unknown } | undefined)?.name
    return typeof named === 'string' && named.length > 0 ? named : FALLBACK_APP_NAME
  } catch (error) {
    printStderr(`[mcp] could not read the config: ${String(error)}`)
    return FALLBACK_APP_NAME
  }
}

/**
 * The status document this lock directory holds, narrowed by the shared reader.
 *
 * The `not-running` shape and the narrowing both come from `asStatusDocument`,
 * so the stdio verb and the HTTP mount cannot describe an absent instance
 * differently.
 */
const readStatusOrNotRunning = async (): Promise<Readonly<Record<string, unknown>>> =>
  asStatusDocument(await readStatusDocument())

/** What one session serves, once discovery and the two gates have answered. */
interface SessionShape {
  readonly appName: string
  readonly configPath: string | undefined
  readonly projectDir: string
  /** Whether A8 surface 10 is authorised here — see {@link resolveWriteGate}. */
  readonly writeEnabled: boolean
}

const buildProvider = (session: Readonly<SessionShape>): ConfigToolsProvider => ({
  appName: session.appName,
  readConfig: async () => readOnDisk(session.configPath),
  validateConfig: async () => validateOnDisk(session.configPath),
  readStatus: readStatusOrNotRunning,
  ...(session.writeEnabled && session.configPath !== undefined
    ? {
        write: buildConfigWriteOperations({
          appName: session.appName,
          projectDir: session.projectDir,
          configPath: session.configPath,
        }),
      }
    : {}),
})

/**
 * Whether this session offers the write tools at all.
 *
 * THREE conditions, and the surface exists only where all three hold:
 *
 * - `MCP_CONFIG_WRITE=1`. An environment variable rather than a config key,
 *   deliberately (A8 bound 1): a config key would let a config authorise its own
 *   editing.
 * - the project directory was named explicitly — see {@link wasProjectDirDeclared}
 *   for why the cwd fallback does not count, and why this must be captured
 *   before the anchor.
 * - a config was actually found. There is no graph to overlay a candidate onto
 *   otherwise, so every write would be judged against nothing; a directory
 *   holding no config gets the four read tools and their explanation, exactly as
 *   it does today.
 *
 * Reported on stderr when it is ON, because a surface that can change what the
 * instance runs should not be a surprise to whoever reads the session log.
 */
const resolveWriteGate = (declared: boolean, configPath: string | undefined): boolean => {
  if (!parseMcpConfigWrite()) return false
  if (!declared) {
    printStderr(
      '[mcp] MCP_CONFIG_WRITE is set, but no project directory was named. The write tools ' +
        'confine themselves to one folder, so that folder has to be chosen on purpose — pass ' +
        '--project <dir> or set SOVRIUM_PROJECT_DIR. Serving the read tools only.'
    )
    return false
  }
  if (configPath === undefined) {
    printStderr(
      '[mcp] MCP_CONFIG_WRITE is set, but no config file was found to write. Serving the read ' +
        'tools only.'
    )
    return false
  }
  printStderr('[mcp] config write tools ENABLED (MCP_CONFIG_WRITE=1).')
  return true
}

// ---------------------------------------------------------------------------
// The transport, and why it is wrapped
// ---------------------------------------------------------------------------

/**
 * `StdioServerTransport` plus the two things EOF needs.
 *
 * The SDK's transport listens for `data` and `error` on stdin and NOTHING
 * else, so end-of-input is invisible to it: a client that stops writing leaves
 * the server waiting forever. Worse, exiting the moment stdin ends would
 * truncate the session — a client that writes every request and closes the pipe
 * in one breath (which is exactly what a piped `printf` does, and what the E2E
 * harness does) would lose every answer still in flight.
 *
 * So this counts inbound REQUESTS against outbound RESPONSES and resolves
 * {@link whenDrained} only once stdin has ended AND nothing is outstanding.
 * A class, not a closure over `let`s: `functional/immutable-data` exempts
 * classes precisely so a small piece of protocol bookkeeping can be written
 * plainly.
 */
/* eslint-disable functional/no-expression-statements -- a transport is protocol
   bookkeeping: installing the inner handlers, counting a request against its
   response and resolving the drain latch are each a side effect by definition. */
class DrainingStdioTransport implements Transport {
  private readonly inner = new StdioServerTransport()
  private pending = 0
  private ended = false
  private settled = false
  private resolveDrained: () => void = () => undefined

  readonly whenDrained: Promise<void> = new Promise((resolve) => {
    this.resolveDrained = resolve
  })

  onclose?: (() => void) | undefined
  onerror?: ((error: Error) => void) | undefined
  onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined

  async start(): Promise<void> {
    this.inner.onclose = (): void => {
      this.markEnded()
      this.onclose?.()
    }
    this.inner.onerror = (error: Error): void => this.onerror?.(error)
    this.inner.onmessage = (message: JSONRPCMessage): void => {
      if (isJSONRPCRequest(message)) this.pending += 1
      this.onmessage?.(message)
    }
    // The SDK transport listens for `data` and `error` and nothing else, so
    // EOF is ours to observe. Both events are registered because a pipe that
    // is destroyed rather than ended emits only `close`.
    process.stdin.on('end', () => this.markEnded())
    process.stdin.on('close', () => this.markEnded())
    await this.inner.start()
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    // `_options` is dropped, not forgotten: `relatedRequestId` tells a
    // per-request-stream transport which stream to write on, and stdio has one
    // channel. `StdioServerTransport.send` takes the message alone for exactly
    // that reason.
    await this.inner.send(message)
    // BOTH halves: an error response settles a request exactly as a result
    // does, and counting only results would hang a session whose last request
    // was refused.
    if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
      this.pending = Math.max(0, this.pending - 1)
      this.maybeFinish()
    }
  }

  async close(): Promise<void> {
    this.markEnded()
    await this.inner.close()
  }

  private markEnded(): void {
    this.ended = true
    this.maybeFinish()
  }

  private maybeFinish(): void {
    if (!this.ended || this.pending > 0 || this.settled) return
    this.settled = true
    this.resolveDrained()
  }
}
/* eslint-enable functional/no-expression-statements */

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

/**
 * Build the MCP instance one connection is pinned to.
 *
 * The low-level {@link Server} rather than `McpServer`, for the same reason the
 * HTTP mount uses it: `McpServer.registerTool` converts a thrown protocol error
 * into a tool RESULT with `isError: true`, which would make the refusal
 * `_config_schema` owes an unresolvable path unreachable as a JSON-RPC error.
 * `Server` also answers `initialize`, `ping` and `server/discover` itself, and
 * answers anything else with `-32601` — a refusal rather than a dropped pipe.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- `Server` is the SDK's own class; we neither own nor can annotate it
const buildStdioServer = (provider: ConfigToolsProvider, version: string): Server => {
  const server = new Server(
    { name: 'sovrium', version },
    { capabilities: { tools: { listChanged: false } } }
  )
  // ONE gate, read once: the provider carries the write operations only where
  // A8 authorised them, so compiling from the same fact is what keeps
  // `tools/list` and the dispatcher below from disagreeing about which tools
  // exist. A name published but not dispatchable would be worse than either.
  const writeEnabled = provider.write !== undefined
  const tools = compileConfigTools(provider.appName, { writeEnabled })
  const queue = new ToolCallQueue()

  server.setRequestHandler('tools/list', async () => ({ tools }) as unknown as never)

  server.setRequestHandler('tools/call', async (request) => {
    const { params } = request as {
      readonly params?: { readonly name?: unknown; readonly arguments?: unknown }
    }
    const toolName = typeof params?.name === 'string' ? params.name : ''
    const args =
      typeof params?.arguments === 'object' &&
      params.arguments !== null &&
      !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {}
    return queue.run(async () => dispatchToolCall(provider, toolName, args)) as unknown as never
  })

  return server
}

/**
 * One tool call at a time, in the order the pipe delivered them.
 *
 * The SDK dispatches every inbound request the moment it arrives and awaits
 * none of its predecessors, so a client that writes `write_file` and then
 * `undo` in one breath — which is exactly what a piped session does, and what
 * an AI does when it decides an edit was wrong — has both handlers running at
 * once. Measured before this existed: `undo` answered FIRST and found an empty
 * history, because the write it was undoing had not finished taking its
 * snapshot.
 *
 * Concurrency is legal in JSON-RPC and harmless for the four reads, which is
 * why it went unnoticed through surface 9. It stops being harmless the moment
 * a tool has STATE behind it: these four share one project directory and one
 * snapshot history, and a pipe is an ordered channel, so honouring that order
 * is the only reading under which "write, then undo" means anything.
 *
 * A class, not a closure over a `let`, for the same reason
 * {@link DrainingStdioTransport} is one: `functional/immutable-data` exempts
 * classes precisely so a small piece of protocol bookkeeping can be written
 * plainly.
 */
/* eslint-disable functional/no-expression-statements -- advancing the queue's tail is a side effect by definition */
class ToolCallQueue {
  private tail: Promise<unknown> = Promise.resolve()

  async run<T>(work: () => Promise<T>): Promise<T> {
    // BOTH arms run `work`: a predecessor that rejected has still finished, and
    // dropping the rest of the queue because one call was refused would hang
    // every request behind it.
    const next = this.tail.then(work, work)
    this.tail = next.catch(() => undefined)
    return next
  }
}
/* eslint-enable functional/no-expression-statements */

/** JSON-RPC `Method not found` — what an unknown TOOL earns, as the SDK does for a method. */
const METHOD_NOT_FOUND = -32_601

interface StdioToolResult {
  readonly content: ReadonlyArray<{ readonly type: 'text'; readonly text: string }>
}

const dispatchToolCall = async (
  provider: ConfigToolsProvider,
  toolName: string,
  args: Readonly<Record<string, unknown>>
): Promise<StdioToolResult> => {
  if (
    !isConfigToolName(provider.appName, toolName, { writeEnabled: provider.write !== undefined })
  ) {
    // eslint-disable-next-line functional/no-throw-statements -- the SDK surfaces a JSON-RPC error member only via a thrown ProtocolError
    throw new ProtocolError(METHOD_NOT_FOUND, `Unknown tool: ${toolName}`)
  }
  const outcome = await handleConfigToolCall(provider, toolName, args)
  if (outcome.kind === 'refused') {
    // `data` rides along when there is any — bound 3's findings reach the client
    // in `sovrium validate --json`'s vocabulary rather than as prose it would
    // have to parse back apart.
    // eslint-disable-next-line functional/no-throw-statements -- same reason
    throw new ProtocolError(outcome.code, outcome.message, outcome.data)
  }
  return { content: [{ type: 'text', text: JSON.stringify(outcome.payload, undefined, 2) }] }
}

/**
 * Handle `sovrium mcp` — serve the config read tools over stdin/stdout until
 * the client closes the pipe.
 *
 * Resolves when stdin has ended and every request it delivered has been
 * answered; `src/cli/index.ts` then exits 0, because a client that stopped
 * writing is a client that quit, and quitting is not an error.
 */
export const handleMcpCommand = async (options: McpCommandOptions = {}): Promise<void> => {
  // CAPTURED FIRST. `anchorProjectDir` republishes the resolved directory —
  // including the cwd fallback — so asking this question afterwards would get a
  // permanent yes. See `wasProjectDirDeclared`.
  const declared = wasProjectDirDeclared(options.projectDir)
  const projectDir = resolveProjectDir(options.projectDir)
  anchorProjectDir(projectDir)
  const configPath = await discoverConfig(projectDir)
  const appName = await resolveAppName(configPath)
  const version = await getCurrentVersion()
  const provider = buildProvider({
    appName,
    configPath,
    projectDir,
    writeEnabled: resolveWriteGate(declared, configPath),
  })

  const transport = new DrainingStdioTransport()
  const handle = serveStdio(() => buildStdioServer(provider, version), {
    legacy: 'serve',
    transport,
    onerror: (error) => printStderr(`[mcp] ${error.message}`),
  })

  // The latch resolves when stdin has ended AND every request it delivered has
  // been answered; closing the handle then tears the connection down.
  return transport.whenDrained.then(async () => handle.close())
}
