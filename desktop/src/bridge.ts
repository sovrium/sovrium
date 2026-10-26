/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every call this front end makes into Rust, typed once.
 *
 * The types here are the other half of `src-tauri/src/commands.rs` and
 * `sidecar.rs`. They are hand-written rather than generated, so a rename on one
 * side is a silent blank screen on the other — which is why the Rust side pins
 * the wire shape of `ShellState` in a unit test (`shell_states_round_trip_as_
 * tagged_json`) rather than trusting serde's rename rules to stay put.
 *
 * Nothing in this module is reachable from the page the engine serves. The
 * `main` window holds these permissions while it is showing the shell's own
 * chrome, and holds none of them the moment it is navigated to
 * `http://127.0.0.1:<port>` — a capability without a `remote` block applies to
 * local content only. That is why the settings window exists separately.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import { common } from './copy'

/** Mirrors `sidecar::ShellState`. The tag is `kind`. */
export type ShellState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  /**
   * `origin` carries the address family the engine actually bound, not a
   * composed `http://127.0.0.1:<port>`. Measured on macOS, `sovrium start`
   * listens on `[::1]` only, so an IPv4 URL is refused outright.
   */
  | { readonly kind: 'serving'; readonly port: number; readonly origin: string }
  | { readonly kind: 'restarting'; readonly attempt: number }
  | { readonly kind: 'paused' }
  | { readonly kind: 'failed'; readonly message: string; readonly tail: readonly string[] }

export interface ProjectRef {
  readonly dir: string
  readonly configFile: string
  readonly name: string
  readonly template: string | null
  /**
   * Whether this project's config is a format an AI may write (`.yaml`, `.yml`
   * or `.json`, [internal ref] D6). Derived by Rust from `configFile` on every read,
   * never stored, so it cannot disagree with the file. `false` for `app.ts`.
   */
  readonly aiWritesSupported: boolean
  /**
   * "Let my AI edit", as the user set it for this project. Off by default.
   * Read `McpSnippet.writesEnabled` for whether it is in effect: this stored
   * value can say "on" for a config an AI may not write.
   */
  readonly aiWrites: boolean
}

/**
 * One thing the engine could not read, in `sovrium validate --json`'s vocabulary.
 *
 * Mirrors `ConfigFinding` in `src/domain/models/app/app-excess-property-report.ts`.
 * `accepted` is the only field that says what to DO rather than what went wrong,
 * and the engine documents it as never elided — so the UI renders it whole. A
 * truncated list of accepted values reads as the complete set, and an assistant
 * handed a truncated one writes the wrong fix confidently.
 */
export interface ConfigFinding {
  /** Dotted path from the config root; `''` for the config as a whole. */
  readonly path: string
  readonly message: string
  readonly accepted?: readonly string[]
  /** The `$ref` partial the mistake lives in, when the config is split. */
  readonly sourceFile?: string
  readonly severity?: string
}

/**
 * What the engine's last save did, from `status.json`.
 *
 * `outcome` is the field the UI branches on, and its three failure values are
 * three different situations for the user, not three shades of one: `kept`
 * means nothing stopped, `rolled-back` means something stopped and recovered,
 * and `down` means nothing is answering. Mirrors `StatusReloadRecord` in
 * `src/infrastructure/server/status-file.ts`.
 */
export interface StatusReloadRecord {
  readonly at?: string
  readonly kind?: 'hot' | 'restart'
  readonly durationMs?: number
  readonly outcome?: 'success' | 'kept' | 'rolled-back' | 'down'
  readonly phase?: 'load' | 'preflight' | 'boot'
  readonly findings?: readonly ConfigFinding[]
}

/**
 * The engine's `status.json` ([internal ref] D5), as far as the shell reads it.
 *
 * Every field is optional, because this file is written by a binary that ships
 * on its own cadence: a newer engine has to be readable by an older shell, and
 * an engine old enough to write no such file at all must not break a newer one.
 * `null` therefore means "no information", never "nothing is wrong" — the shell
 * never takes the absence of this file as evidence of health.
 */
export interface EngineStatus {
  /** `serving` · `rejected` · `down`. */
  readonly state: string | null
  readonly port: number | null
  readonly configHash: string | null
  readonly lastReload: StatusReloadRecord | null
}

export interface StatePayload {
  readonly state: ShellState
  readonly project: ProjectRef | null
  readonly engine: EngineStatus | null
}

export interface Settings {
  readonly activeProject: ProjectRef | null
  readonly recents: readonly ProjectRef[]
  readonly port: number | null
  readonly openInBrowser: boolean
  readonly checkUpdates: boolean
}

export interface SettingsPatch {
  readonly port?: number | null
  readonly openInBrowser?: boolean
  readonly checkUpdates?: boolean
}

export interface Versions {
  readonly shell: string
  readonly engine: string | null
  readonly matched: boolean
}

export interface McpSnippet {
  readonly command: string
  readonly args: readonly string[]
  /** The `mcpServers` block, for a client configured by file. */
  readonly json: string
  /** The `claude mcp add …` one-liner, for a client configured by CLI. */
  readonly cli: string
  readonly projectDir: string | null
  /** Whether the bundled engine answers `sovrium mcp`. Probed, not assumed. */
  readonly available: boolean
  /** Environment the client sets on the server process; empty by default. */
  readonly env: Readonly<Record<string, string>>
  /** Whether "Let my AI edit" is on, so `env` carries `MCP_CONFIG_WRITE`. */
  readonly writesEnabled: boolean
  /** Whether the switch can be turned on: a project is open and its config is not `.ts`. */
  readonly writesSupported: boolean
  /** The server's name in both forms, `sovrium-<project>`, so two projects can coexist. */
  readonly entryName: string
  /**
   * Where Claude Desktop's configuration file is, when "Connect Claude Desktop"
   * is offered on this machine; `null` hides the button.
   */
  readonly claudeDesktopPath: string | null
  /** Whether the shell has written this project's Claude Desktop entry before. */
  readonly claudeDesktopConnected: boolean
}

/** Add or replace the open project's Claude Desktop entry, or take one out. */
export type ClientWriteAction = 'connect' | 'remove'

/**
 * What the consent dialog shows before a write to Claude Desktop's
 * configuration ([internal ref] A2), or why the shell will not write it.
 */
export type ClaudeDesktopPreview =
  | {
      readonly kind: 'ready'
      readonly path: string
      readonly entryName: string
      /** The entry exactly as it will be written. */
      readonly entry: string
      readonly writesEnabled: boolean
      readonly fileExists: boolean
      /** `null` when there is no file yet, so nothing to back up. */
      readonly backupPath: string | null
      readonly alreadyPresent: boolean
      /** Confirming would change nothing. */
      readonly unchanged: boolean
      readonly fingerprint: string
    }
  | {
      readonly kind: 'refused'
      /** One sentence; never quotes the file. */
      readonly reason: string
      /** The copy-snippet block to add by hand instead. */
      readonly fallback: string
    }

export type ClaudeDesktopApplied =
  | { readonly kind: 'written'; readonly backupPath: string | null }
  | { readonly kind: 'unchanged' }
  /** The file changed since the dialog was shown: preview again. */
  | { readonly kind: 'changed' }

export interface UndoAvailability {
  readonly available: boolean
  readonly snapshots: number
  /** ISO-8601 instant a restore would return to, or `null` if there is none. */
  readonly target: string | null
}

export interface ValidationReport {
  readonly ok: boolean
  readonly structured: boolean
  readonly output: string
}

/**
 * A deep link the user has already confirmed.
 *
 * Exactly one of the two is set — the link parser refuses a URL naming both.
 * They stay separate fields rather than becoming one `source` string because
 * the two take different paths into the engine (`--template` against
 * `--from-url`) and a single field would have to be re-classified here, where
 * the classification has already been done under a security review.
 */
export interface ConfirmedIntent {
  readonly template: string | null
  readonly url: string | null
}

/** The publisher verdict `sovrium init --from-bundle --inspect` reports. */
export type BundleVerdict = 'verified' | 'unverified' | 'refused'

/**
 * The bundle dialog's state, for a `sovrium://new?bundle=` link ([internal ref] A1).
 * Mirrors `bundle_import::BundleView`; the tag is `kind`.
 *
 * Held in Rust, not here: the shell may navigate this window back to its own
 * chrome to show the dialog, which reloads the page, so the window reads it
 * with `bundlePending()` on every boot as well as from the event.
 */
export type BundleView =
  | { readonly kind: 'fetching'; readonly host: string }
  | {
      readonly kind: 'ready'
      /** Where the archive was downloaded from, after redirects. */
      readonly host: string
      /** The host the link named, when it differs from `host`. */
      readonly linkHost: string | null
      readonly name: string
      /** Compressed size in bytes. */
      readonly size: number
      readonly verdict: Exclude<BundleVerdict, 'refused'>
      readonly containsDemoData: boolean
      readonly folderSuggestion: string
    }
  | { readonly kind: 'refused'; readonly host: string; readonly reason: string }

/** The admin a bundle import created. Shown once; never stored anywhere. */
export interface BundleCredentials {
  readonly email: string
  readonly password: string
}

export interface BundleImported {
  /** Recorded in the recents, not started yet: `openProject` starts it. */
  readonly project: ProjectRef
  /** `null` for an app without sign-in. */
  readonly credentials: BundleCredentials | null
  /** Set when the project was written but its demo data was not loaded. */
  readonly warning: string | null
}

export const STATE_EVENT = 'sovrium://state'
export const DEEP_LINK_EVENT = 'sovrium://deep-link'
export const BUNDLE_EVENT = 'sovrium://bundle'

export const shellSnapshot = (): Promise<StatePayload> => invoke('shell_snapshot')
export const shellLogs = (): Promise<string[]> => invoke('shell_logs')
export const shellVersions = (): Promise<Versions> => invoke('shell_versions')

export const settingsRead = (): Promise<Settings> => invoke('settings_read')
export const settingsWrite = (patch: SettingsPatch): Promise<Settings> =>
  invoke('settings_write', { patch })

export const createProject = (
  parentDir: string,
  folderName: string,
  template: string
): Promise<ProjectRef> => invoke('create_project', { parentDir, folderName, template })

export const createProjectFromUrl = (
  parentDir: string,
  folderName: string,
  url: string
): Promise<ProjectRef> => invoke('create_project_from_url', { parentDir, folderName, url })

/** The bundle dialog to show now, if a `bundle=` link is waiting. */
export const bundlePending = (): Promise<BundleView | null> => invoke('bundle_pending')
/**
 * Import the bundle the dialog shows. The archive and its sha256 are the ones
 * Rust holds from the inspection; the frontend only says where.
 */
export const bundleImport = (parentDir: string, folderName: string): Promise<BundleImported> =>
  invoke('bundle_import', { parentDir, folderName })
/** Decline the bundle: Rust deletes the download and closes the dialog. */
export const bundleDiscard = (): Promise<void> => invoke('bundle_discard')

export const openProject = (dir: string): Promise<ProjectRef> => invoke('open_project', { dir })
export const forgetProject = (dir: string): Promise<Settings> => invoke('forget_project', { dir })

export const restartEngine = (): Promise<void> => invoke('restart_engine')
export const pauseEngine = (): Promise<void> => invoke('pause_engine')
export const revealProject = (): Promise<void> => invoke('reveal_project')
export const revealSettingsFolder = (): Promise<void> => invoke('reveal_settings_folder')
export const openAppInBrowser = (): Promise<void> => invoke('open_app_in_browser')
export const openSettingsWindow = (): Promise<void> => invoke('open_settings_window')

export const mcpSnippet = (): Promise<McpSnippet> => invoke('mcp_snippet')
/** Turn "Let my AI edit" on or off for the open project. Refused for `app.ts`. */
export const setAiWrites = (enabled: boolean): Promise<Settings> =>
  invoke('set_ai_writes', { enabled })
/** Compute a write to Claude Desktop's configuration. Writes nothing. */
export const claudeDesktopPreview = (
  action: ClientWriteAction,
  dir: string | null = null
): Promise<ClaudeDesktopPreview> => invoke('claude_desktop_preview', { action, dir })
/** Apply the write the user confirmed, identified by its preview's fingerprint. */
export const claudeDesktopApply = (fingerprint: string): Promise<ClaudeDesktopApplied> =>
  invoke('claude_desktop_apply', { fingerprint })
export const undoAvailability = (): Promise<UndoAvailability> => invoke('undo_availability')
/** Put the previous accepted configuration back. Resolves to its ISO instant. */
export const undoRestore = (): Promise<string> => invoke('undo_restore')
export const resetToTemplate = (): Promise<void> => invoke('reset_to_template')
export const validateConfig = (): Promise<ValidationReport> => invoke('validate_config')

/** Subscribe to state changes. Returns the unsubscribe function. */
export const onStateChange = (handler: (payload: StatePayload) => void): Promise<UnlistenFn> =>
  listen<StatePayload>(STATE_EVENT, (event) => handler(event.payload))

/** Subscribe to confirmed deep links. */
export const onDeepLink = (handler: (intent: ConfirmedIntent) => void): Promise<UnlistenFn> =>
  listen<ConfirmedIntent>(DEEP_LINK_EVENT, (event) => handler(event.payload))

/** Subscribe to the bundle dialog's state. `null` closes it. */
export const onBundle = (handler: (view: BundleView | null) => void): Promise<UnlistenFn> =>
  listen<BundleView | null>(BUNDLE_EVENT, (event) => handler(event.payload))

/**
 * Turn whatever Rust threw into one sentence.
 *
 * A command's `Err(String)` arrives as a bare string; a panic or a permission
 * refusal arrives as something else. Both have to read as an explanation to a
 * person who is not debugging Tauri.
 */
export const errorText = (error: unknown): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return common.unknownError
}
