/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every sentence the shell says, in one file.
 *
 * ## Why this file exists
 *
 * The shell ships **English only in v1**, and this is where the decision is
 * made reversible. The engine is bilingual and `sovrium.com` is EN+FR, so an FR
 * shell is a question of when rather than whether — and the cost of answering it
 * later is entirely a function of how scattered the strings were. They are not
 * scattered: they are here.
 *
 * What is NOT here, and would have to be found for a translation pass:
 *
 * - **Short control labels** — `Copy`, `Refresh`, `Pause`, `Start`, tab names.
 *   They sit at their point of use because a table of forty one-word entries is
 *   less readable than the buttons themselves, and they are the cheapest strings
 *   to find again (`grep` for the label).
 * - **The Rust side**, which owns four surfaces the webview cannot reach: the
 *   tray menu (`tray.rs`), the deep-link dialogs (`deeplink.rs`), the folder
 *   pickers (`main-view.ts` passes their titles to the OS), and the error
 *   sentences commands return on failure (`commands.rs`). A translation pass
 *   covers those four files and this one.
 *
 * ## The rule every sentence here obeys
 *
 * **Describe; do not argue.** The shell says what a control does, what just
 * happened, and what to do next. It does not say why any of it is good. That is
 * not modesty — the growth record (`[internal ref]`, queried 2026-09-22) holds no
 * offer covering Sovrium-the-product, so a benefit claim here would have no
 * record behind it and is refused at review. Three specific refusals came back
 * named, and each one had a plausible sentence attached to it that is not
 * written below: the product may not be sold on its AI toolchain (`GD-114`), a
 * grant of rights may not be described (`GD-082` — never « no licence », never
 * "free forever"), and a guarantee about where data goes is a legal-class
 * statement the founder writes, not this file.
 *
 * What survives that rule is the whole of what a person actually needs: a
 * label, an instruction, and — after a refusal — the path, the message and the
 * way back. D4: cut the adjective, keep the next action.
 */

// ---------------------------------------------------------------------------
// First run — the gallery
// ---------------------------------------------------------------------------

export const gallery = {
  title: 'Start a project',
  lead:
    'Every starting point below makes a folder on this machine, with one configuration file ' +
    'in it. Sovrium runs the app that file describes.',
  templatesHeading: 'Templates',
  otherWaysHeading: 'Other ways to start',
  openExistingNote: 'A folder that already holds an app.yaml.',
  fromUrlNote: 'A configuration published at an https address.',
  recentsHeading: 'Recent projects',
} as const

/** The create-from-template form. */
export const createForm = {
  folderLabel: 'Folder name',
  noFolderChosen: 'Choose where it should go.',
  locationPrefix: 'It will be created in',
  creating: 'Creating…',
} as const

/**
 * The create-from-address form.
 *
 * The three sentences under `safety` are the ones that matter, and they are
 * three because a person deciding whether to trust an address needs to know what
 * arrives, what does not, and what will refuse. Each is a fact about what
 * `sovrium init --from-url` does, checkable against `init-from-url.ts`.
 */
export const fromUrl = {
  title: 'Start from an address',
  lead: 'Sovrium downloads one configuration file and builds a new project around it.',
  urlLabel: 'Address of the configuration',
  urlPlaceholder: 'https://example.com/app.yaml',
  safety: [
    'The address must be https, and must end in .yaml, .yml or .json.',
    'One document is copied into your new project. Nothing is run, and a configuration ' +
      'written as TypeScript is refused outright.',
    'Sovrium records where the file came from, so you can check it later.',
  ],
  notHttps: 'That needs to be an https address.',
} as const

// ---------------------------------------------------------------------------
// Running, and not running
// ---------------------------------------------------------------------------

export const status = {
  starting: {
    title: 'Starting…',
    lead: 'Reading the configuration and opening the database. The first run takes longer.',
  },
  restarting: {
    title: 'Restarting',
    lead: (attempt: number): string =>
      `Sovrium stopped on its own and is starting again — attempt ${String(attempt)} of 3.`,
  },
  paused: {
    title: 'Paused',
    lead: 'Nothing is running. Your project folder is exactly as you left it.',
    action: 'Start again',
  },
  inBrowser: {
    title: 'Running in your browser',
    lead: (port: number): string =>
      `Your app is on port ${String(port)}. This window stays out of the way because ` +
      '“open in your browser instead” is switched on in settings.',
    action: 'Open the app',
  },
  failed: {
    title: 'Sovrium could not start',
    logHeading: 'The last thing it said',
  },
} as const

/**
 * The engine's own verdict on the last save, from `status.json`.
 *
 * This is the copy the whole status channel exists for. A refused save leaves a
 * perfectly healthy server answering a perfectly good page, so every signal the
 * user has says "fine" while the file they just edited sits on disk unread. The
 * sentences below are the only place that is said.
 *
 * `kept` is the important one and it is deliberately reassuring first and
 * corrective second: nothing broke, nothing stopped, and the change simply did
 * not take. `down` is the opposite — it leads with the outage, because that is
 * the fact that changes what the user should do next.
 */
export const verdict = {
  kept: {
    title: 'Your last change was not applied',
    lead:
      'Sovrium could not load the configuration as it now stands, so it kept running the ' +
      'version it already had. Nothing stopped, and nothing was lost — the file on disk is ' +
      'still yours to fix.',
  },
  rolledBack: {
    title: 'Sovrium went back to the previous configuration',
    lead:
      'The new configuration could not start, so Sovrium restarted the one that was working. ' +
      'Your app is answering again, running the version from before your last change.',
  },
  down: {
    title: 'Nothing is running',
    lead:
      'The new configuration could not start, and neither could the one before it. Your app ' +
      'is not answering until the configuration loads.',
  },
  findingsHeading: 'What it could not read',
  acceptedPrefix: 'Accepted here:',
  copyFindings: 'Copy these details',
  copyHint: 'Paste them to your AI and it can fix the file.',
  /** Shown when the engine reported a refusal but named nothing. */
  noFindings: 'The engine did not say which part of the file it stumbled on. The log has more.',
} as const

// ---------------------------------------------------------------------------
// Settings — Project
// ---------------------------------------------------------------------------

export const project = {
  noProject: 'No project',
  machineHeading: 'This machine',
  portNote:
    'Leave this blank and Sovrium takes whatever port is free. Set one to get the same ' +
    'address every time.',
  portSaved: 'Saved. The new port is used the next time this project starts.',
  portInvalid: 'A port has to be a whole number between 1024 and 65535.',
  browserToggle: 'Open in your browser instead of this window',
  updatesToggle: 'Check for Sovrium updates',
  /**
   * The phone-home disclosure [internal ref] D8 requires.
   *
   * Three facts, in the order a person asks them: what is contacted, what is
   * sent, and how to stop it. It describes requests this shell's own code makes
   * — `tauri.conf.json` names the endpoint — and claims nothing beyond them.
   */
  updatesNote:
    'This asks sovrium.com/desktop/latest.json for the current version number, and sends ' +
    'nothing about you, your project or your configuration. Switch it off and the app ' +
    'contacts nothing at all. The engine running your project makes no such request either ' +
    'way.',
} as const

// ---------------------------------------------------------------------------
// Settings — Connect your AI
// ---------------------------------------------------------------------------

/**
 * The most load-bearing copy in the app, and the most constrained.
 *
 * It has to get a non-technical person from "I have a folder" to "my assistant
 * can read my app" — and it has to do that without arguing that any of it is a
 * good idea, and without over-promising what the assistant can do. The four
 * tools are reads. An assistant that believes it can write will report an edit
 * it never made, which is the failure this whole design is built to avoid, so
 * `canDo` and `cannotDo` are a pair and neither ships without the other.
 *
 * The client syntax is NOT invented here: `apps/website/content/docs/en/mcp-config.md`
 * is the source of truth, and the snippets are built in Rust from one command
 * and one argument list so the two forms cannot drift apart.
 */
export const ai = {
  title: 'Connect your AI',
  lead:
    'Your project is a folder with a configuration file in it. Point the AI assistant you ' +
    'already use at that folder, and it can read the file, check it, and tell you what ' +
    'Sovrium made of it.',
  mechanism:
    'Your assistant runs the Sovrium command on this machine and talks to it over a pipe. ' +
    'There is no key to enter and no field here to enter one in.',
  folderStep: 'The folder to point it at',
  clientStep: 'Set up your assistant',
  clientHint: 'Every client reads the same two values: a command, and its arguments.',
  clients: {
    'claude-code': {
      label: 'Claude Code',
      instruction: 'Run this once in a terminal. The double dash is required.',
    },
    'claude-desktop': {
      label: 'Claude Desktop',
      instruction: 'Add this to claude_desktop_config.json, then restart the app.',
    },
    cursor: {
      label: 'Cursor',
      instruction:
        'Add this to .cursor/mcp.json in the project, or ~/.cursor/mcp.json for all of them.',
    },
  },
  canDoHeading: 'What it can do',
  canDo: [
    'Read your configuration, with any secret in it replaced by a placeholder.',
    'Check the configuration and get back exactly what Sovrium objected to.',
    'Look up what a setting accepts, so it writes something valid the first time.',
    'See whether your app is running, and whether the last save was applied.',
  ],
  cannotDoHeading: 'What it cannot do',
  cannotDo:
    'These four are reads. Your assistant changes your app by editing the file in the ' +
    'folder, the way it edits any other file — Sovrium reloads on its own when it does. ' +
    'Letting it write through this connection is a separate setting that does not exist ' +
    'yet; it will be off by default when it arrives.',
  /** Shown only when the bundled engine does not answer `sovrium mcp`. */
  unavailable:
    'The engine installed here does not answer this command, so the snippet will not work ' +
    'yet. That usually means an update reached the window but not the engine — reinstalling ' +
    'Sovrium puts the two back in step.',
  copied: 'Copied',
  copyFailed: 'Could not copy',
} as const

// ---------------------------------------------------------------------------
// Settings — Logs
// ---------------------------------------------------------------------------

export const logs = {
  title: 'What Sovrium said',
  lead: 'Everything the engine has written since it started. The first place to look when a change did not appear.',
  empty: 'Nothing logged yet.',
  checkAction: 'Check the configuration',
  checking: 'Checking…',
  valid: 'The configuration is valid.',
  refusedSilently: 'The configuration was refused, without saying why. The log above has more.',
  versionMatched: (version: string): string => `Sovrium ${version}.`,
  versionMismatch: (shell: string, engine: string): string =>
    `This window is ${shell} and the engine is ${engine}. They ship together, so a mismatch ` +
    'usually means an update reached one half only. Reinstalling puts them back in step.',
} as const

// ---------------------------------------------------------------------------
// Settings — Advanced
// ---------------------------------------------------------------------------

/**
 * Undo, and the reset.
 *
 * `undo.lead` has to explain a history the user never asked for and has never
 * seen, in one sentence, before they press a button that overwrites the file
 * they have been working on. `reset.kept` is the load-bearing half of the
 * destructive one: what a person needs before confirming is not a warning, it is
 * the list of what survives.
 */
export const advanced = {
  undo: {
    title: 'Undo a change',
    lead:
      'Sovrium keeps a copy of your configuration every time it loads one successfully. ' +
      'Going back replaces the file in your folder with the previous copy, and your app ' +
      'reloads.',
    action: 'Go back one version',
    /** When there is somewhere to go. */
    target: (when: string): string => `The version before your last change is from ${when}.`,
    /** One snapshot: the running one, and nothing behind it. */
    onlyCurrent:
      'There is nothing to go back to yet. Sovrium has recorded only the configuration it ' +
      'is running now; the next successful change gives you a version to return to.',
    none:
      'There is nothing to go back to yet. Sovrium records a version each time it loads ' +
      'your configuration successfully.',
    restored: (when: string): string =>
      `Put back the version from ${when}. Sovrium is reloading it now.`,
    kept: (count: number): string =>
      count === 1 ? '1 version kept.' : `${String(count)} versions kept.`,
  },
  reset: {
    title: 'Reset to the template',
    lead:
      'This replaces your configuration file with a fresh copy of the template this project ' +
      'started from.',
    kept:
      'Your data, your uploaded files and everything else in the folder are untouched. Only ' +
      'app.yaml is replaced — and every change you or your assistant made to it is lost.',
    noTemplate: 'This project did not start from a template, so there is nothing to reset it to.',
    action: 'Replace the configuration',
    confirmTitle: 'Reset to the template?',
    confirmBody:
      'app.yaml is replaced with a fresh copy of the template. Every change made to it is ' +
      'lost. Your data is not affected.',
    done: 'The configuration was reset. Sovrium is reloading it now.',
  },
} as const

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const common = {
  dismiss: 'Dismiss',
  revealFolder: 'Reveal folder',
  revealProject: 'Reveal project folder',
  openSettings: 'Open settings',
  tryAgain: 'Try again',
  back: 'Back',
  loading: 'Loading…',
  /** The last resort, when Rust threw something that is not a sentence. */
  unknownError: 'Something went wrong. The log in Settings has the detail.',
} as const
