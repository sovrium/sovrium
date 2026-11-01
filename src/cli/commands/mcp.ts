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
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import {
  asStatusDocument,
  type ConfigReadPayload,
  type ConfigToolsProvider,
  type ConfigValidatePayload,
} from '@/application/use-cases/config/config-mcp-tool-call'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { lazyImportSchema } from '@/cli/runtime/lazy-modules'
import { withFlagsAsync } from '@/cli/runtime/run-command'
import { messageAsConfigFinding } from '@/domain/kernel/config-parsing/decode-report-format'
import { formatDiscoveredConfigNotice } from '@/domain/kernel/config-parsing/default-config-files'
import { parseConfigFileName } from '@/domain/models/process-env/desktop'
import { parseMcpConfigWrite } from '@/domain/models/process-env/mcp'
import { printStderr } from '@/infrastructure/logging/cli-output'
import { readStatusDocument } from '@/infrastructure/server/status-file'
import { loadConfigGraph } from './mcp-config-graph'
import { buildConfigWriteOperations } from './mcp-config-write'
import { DrainingStdioTransport, buildStdioServer } from './mcp-transport'
import { getCurrentVersion } from './update'
import type { App } from '@/domain/models/app'

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
 * other stream here, which is the whole of a CLI commands MCP spec.
 */
const discoverConfig = async (projectDir: string): Promise<string | undefined> => {
  const { discoverDefaultConfigFile } = await lazyImportSchema()
  const named = parseConfigFileName(process.env)
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
      graph.parsed as App, // the authored config on disk: App-shaped, not decoded
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
 * The status document this lock directory holds, narrowed by `asStatusDocument`,
 * the shared reader, so the stdio verb and the HTTP mount cannot describe an
 * absent instance (`not-running`) differently.
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
  if (!parseMcpConfigWrite(process.env)) return false
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
  const handle = serveStdio(() => buildStdioServer(provider, version, projectDir), {
    legacy: 'serve',
    transport,
    onerror: (error) => printStderr(`[mcp] ${error.message}`),
  })

  // The latch resolves when stdin has ended AND every request it delivered has
  // been answered; closing the handle then tears the connection down.
  return transport.whenDrained.then(async () => handle.close())
}

/** The flags `sovrium mcp` reads. */
export const mcpFlags = defineFlags({ project: flag.value('--project') })

/** `sovrium mcp`, as the dispatcher runs it. */
export const mcpCommand = withFlagsAsync(mcpFlags, ({ flags }) =>
  handleMcpCommand({ projectDir: flags.project })
)
