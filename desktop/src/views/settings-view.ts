/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The settings window — four tabs, and an enumerated scope.
 *
 * [internal ref] D4 enumerates what this surface holds rather than describing it,
 * because a described scope drifts toward the next plausible field: the project
 * to open, the project folder, the port, the "connect your AI" instructions,
 * undo, reset-to-template, and the log view. That list is the whole of this
 * file, and adding to it is an ADR decision rather than a UI one.
 *
 * What it does NOT hold is anything from the app's own config — no table, no
 * page, no field, no automation, no theme control, no env value belonging to
 * the app. The test is mechanical: **a control here must never change the
 * config file.** Two controls come close and both pass. "Reset to template"
 * asks the engine to lay its own template down again rather than composing
 * anything. "Undo" copies a file the ENGINE wrote back over the project, which
 * is a restore of Sovrium's own record and not an edit — the bytes put back are
 * bytes Sovrium itself accepted and served. Neither composes configuration, and
 * neither takes configuration as an argument.
 *
 * It lives in the shell rather than at `/_admin` because `/_admin` is governed
 * by [internal ref], whose refusals are asserted by shipped specs. Putting machine-local
 * settings there would either breach those bounds or force them open.
 */

import { confirm } from '@tauri-apps/plugin-dialog'

import {
  claudeDesktopApply,
  claudeDesktopPreview,
  errorText,
  mcpSnippet,
  openAppInBrowser,
  pauseEngine,
  resetToTemplate,
  restartEngine,
  revealProject,
  revealSettingsFolder,
  setAiWrites,
  settingsRead,
  settingsWrite,
  shellLogs,
  shellVersions,
  undoAvailability,
  undoRestore,
  validateConfig,
  type ClaudeDesktopPreview,
  type McpSnippet,
  type Settings,
  type StatePayload,
} from '../bridge'
import {
  advanced as advancedCopy,
  ai as aiCopy,
  common,
  logs as logsCopy,
  project as projectCopy,
} from '../copy'
import { copyText, h, render } from '../dom'
import { engineIsDown, engineVerdict } from './engine-verdict'

type Tab = 'project' | 'ai' | 'logs' | 'advanced'

const TABS: readonly (readonly [Tab, string])[] = [
  ['project', 'Project'],
  ['ai', 'Connect your AI'],
  ['logs', 'Logs'],
  ['advanced', 'Advanced'],
]

/** The three clients the published docs give syntax for, in that order. */
type ClientId = keyof typeof aiCopy.clients
const CLIENT_IDS = [
  'claude-code',
  'claude-desktop',
  'cursor',
] as const satisfies readonly ClientId[]

interface SettingsContext {
  readonly root: HTMLElement
  readonly refresh: () => void
  readonly tab: Tab
  readonly setTab: (tab: Tab) => void
  readonly settings: Settings | null
  readonly setNotice: (message: string | null) => void
  readonly notice: string | null
}

const stateSentence = (payload: StatePayload): string => {
  // The engine's own answer outranks the shell's. `serving` here means the
  // engine answered when it started and has not been re-probed; if it has
  // since said nothing is listening, saying "Running on port 4123" directly
  // under a panel headed "Nothing is running" would make this window argue
  // with itself.
  if (engineIsDown(payload)) return 'Not answering. See above.'
  switch (payload.state.kind) {
    case 'idle':
      return 'No project is open.'
    case 'starting':
      return 'Starting…'
    case 'serving':
      return `Running on port ${String(payload.state.port)}.`
    case 'restarting':
      return `Restarting — attempt ${String(payload.state.attempt)} of 3.`
    case 'paused':
      return 'Paused.'
    case 'failed':
      return 'Stopped. See the Logs tab.'
    default:
      return 'Unknown.'
  }
}

const row = (label: string, ...controls: readonly (Node | string | null)[]): HTMLElement =>
  h(
    'div',
    { class: 'row' },
    h('span', { class: 'row__label' }, label),
    h('div', { class: 'row__controls' }, ...controls)
  )

/**
 * A row whose one control is a checkbox, with the label bound to it.
 *
 * A `<label for>` rather than a span, so the whole sentence is the hit target —
 * shadcn's Checkbox + Label pairing — and a screen reader announces the
 * checkbox by its sentence instead of as an unnamed box.
 */
const checkboxRow = (label: string, toggle: HTMLInputElement): HTMLElement =>
  h(
    'div',
    { class: 'row' },
    h('label', { class: 'row__label', for: toggle.id }, label),
    h('div', { class: 'row__controls' }, toggle)
  )

/**
 * A timestamp as the person in front of the screen would write it.
 *
 * The engine names its snapshots in UTC; only the webview knows the offset and
 * the locale, so the conversion happens here and nowhere earlier. An instant
 * that will not parse renders as nothing rather than as "Invalid Date".
 */
const whenText = (iso: string): string | null => {
  const at = new Date(iso)
  return Number.isNaN(at.getTime())
    ? null
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** A copy button bound to text that is known up front. */
const copyButton = (text: string, label = 'Copy'): HTMLElement => {
  const button = h('button', { class: 'button button--primary', type: 'button' }, label)
  button.addEventListener('click', () => {
    void copyText(text).then((ok) => {
      button.textContent = ok ? aiCopy.copied : aiCopy.copyFailed
      window.setTimeout(() => {
        button.textContent = label
      }, 2000)
    })
  })
  return button
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

const projectTab = (context: SettingsContext, payload: StatePayload): HTMLElement => {
  const settings = context.settings
  const portInput = h('input', {
    class: 'field__input field__input--short',
    id: 'port',
    type: 'number',
    min: '1024',
    max: '65535',
    placeholder: 'Any free port',
    value: settings?.port === null || settings?.port === undefined ? '' : String(settings.port),
  })

  const savePort = (): void => {
    const raw = portInput.value.trim()
    const port = raw === '' ? null : Number(raw)
    if (port !== null && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
      context.setNotice(projectCopy.portInvalid)
      context.refresh()
      return
    }
    void settingsWrite({ port })
      .then(() => {
        context.setNotice(projectCopy.portSaved)
        context.refresh()
      })
      .catch((error: unknown) => {
        context.setNotice(errorText(error))
        context.refresh()
      })
  }

  const browserToggle = h('input', {
    type: 'checkbox',
    id: 'open-in-browser',
    checked: settings?.openInBrowser === true,
    onChange: (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked
      void settingsWrite({ openInBrowser: checked }).then(() => context.refresh())
    },
  })

  const updatesToggle = h('input', {
    type: 'checkbox',
    id: 'check-updates',
    checked: settings?.checkUpdates !== false,
    onChange: (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked
      void settingsWrite({ checkUpdates: checked }).then(() => context.refresh())
    },
  })

  return h(
    'div',
    { class: 'tab' },
    // The verdict comes first: when a save was refused, it is the reason the
    // user opened this window, and it outranks the port field.
    engineVerdict(payload),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, payload.project?.name ?? projectCopy.noProject),
      h('p', { class: 'panel__meta' }, payload.project?.dir ?? '—'),
      h('p', { class: 'panel__lead' }, stateSentence(payload)),
      h(
        'div',
        { class: 'form__actions' },
        h(
          'button',
          { class: 'button', type: 'button', onClick: () => void revealProject() },
          common.revealFolder
        ),
        h(
          'button',
          { class: 'button', type: 'button', onClick: () => void openAppInBrowser() },
          'Open in browser'
        ),
        payload.state.kind === 'serving'
          ? h(
              'button',
              { class: 'button', type: 'button', onClick: () => void pauseEngine() },
              'Pause'
            )
          : h(
              'button',
              { class: 'button', type: 'button', onClick: () => void restartEngine() },
              'Start'
            )
      )
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, projectCopy.machineHeading),
      row(
        'Port',
        portInput,
        h('button', { class: 'button', type: 'button', onClick: savePort }, 'Save')
      ),
      h('p', { class: 'panel__note' }, projectCopy.portNote),
      checkboxRow(projectCopy.browserToggle, browserToggle),
      checkboxRow(projectCopy.updatesToggle, updatesToggle),
      h('p', { class: 'panel__note' }, projectCopy.updatesNote),
      h(
        'div',
        { class: 'form__actions' },
        // A plain button, not a quiet one. A quiet button has no border, so its
        // text starts one padding-width inside where a bordered sibling's edge
        // sits — and in a column of actions that reads as an accidental indent.
        h(
          'button',
          { class: 'button', type: 'button', onClick: () => void revealSettingsFolder() },
          'Reveal settings folder'
        )
      )
    )
  )
}

// ---------------------------------------------------------------------------
// Connect your AI
// ---------------------------------------------------------------------------

/**
 * The client picker and the snippet it shows.
 *
 * Three clients, one at a time. Showing all three at once would put two blocks
 * of configuration a person does not need on the screen next to the one they
 * do, and the commonest failure of a setup page is pasting the wrong block.
 *
 * The snippet itself is built in Rust from one command and one argument list,
 * so the CLI form and the JSON form cannot drift apart — and neither can drift
 * from what the bundled binary actually is, since the command is that binary's
 * real path.
 */
const clientPicker = (snippet: McpSnippet): HTMLElement => {
  const instruction = h('p', { class: 'panel__lead' }, '')
  const block = h('pre', { class: 'log log--snippet' }, '')
  const actions = h('div', { class: 'form__actions' })

  const show = (id: ClientId): void => {
    const client = aiCopy.clients[id]
    instruction.textContent = client.instruction
    const text = id === 'claude-code' ? snippet.cli : snippet.json
    block.textContent = text
    actions.replaceChildren(copyButton(text))
  }

  const tabs = CLIENT_IDS.map((id) =>
    h(
      'button',
      {
        class: 'chip',
        type: 'button',
        role: 'tab',
        'data-testid': `client-${id}`,
        'aria-pressed': id === CLIENT_IDS[0] ? 'true' : 'false',
        onClick: (event) => {
          for (const node of tabs) {
            node.setAttribute('aria-pressed', 'false')
            node.classList.remove('chip--active')
          }
          const current = event.currentTarget as HTMLElement
          current.setAttribute('aria-pressed', 'true')
          current.classList.add('chip--active')
          show(id)
        },
      },
      aiCopy.clients[id].label
    )
  )
  tabs[0]?.classList.add('chip--active')
  show(CLIENT_IDS[0])

  return h(
    'div',
    { class: 'clients' },
    h('div', { class: 'chips', role: 'tablist' }, ...tabs),
    instruction,
    block,
    actions
  )
}

/**
 * "Let my AI edit" — per project, off by default.
 *
 * It changes only what the snippet above tells a client to set in its own
 * environment (`MCP_CONFIG_WRITE=1`); the config file and the running engine
 * are untouched. Disabled when the config is `app.ts`, which the engine's write
 * tools refuse anyway ([internal ref] D6).
 */
const writeSwitch = (context: SettingsContext, snippet: McpSnippet): HTMLElement => {
  const toggle = h('input', {
    type: 'checkbox',
    id: 'ai-writes',
    'data-testid': 'ai-writes',
    checked: snippet.writesEnabled,
    disabled: !snippet.writesSupported,
    onChange: (event) => {
      const checked = (event.currentTarget as HTMLInputElement).checked
      void setAiWrites(checked)
        .then(() => {
          // A connected Claude Desktop still has the old entry: offer to
          // rewrite it, under the same consent as the first write (A2 rule 7).
          offerClaudeDesktopRewrite =
            snippet.claudeDesktopConnected && snippet.claudeDesktopPath !== null
          context.refresh()
        })
        .catch((error: unknown) => {
          context.setNotice(errorText(error))
          context.refresh()
        })
    },
  })
  // No gap of its own: the note sits under its row the way the Project tab's
  // notes do (`.row + .panel__note`), so the two read as one setting.
  return h(
    'div',
    { class: 'setting' },
    checkboxRow(aiCopy.writeToggle, toggle),
    h(
      'p',
      { class: 'panel__note' },
      snippet.writesSupported || snippet.projectDir === null
        ? aiCopy.writeToggleHint
        : aiCopy.writeUnsupported
    )
  )
}

/**
 * Set when "Let my AI edit" changes on a project whose Claude Desktop entry the
 * shell wrote, and read once by the next render of this tab, which re-runs the
 * whole view: the offer has to survive that refresh.
 */
let offerClaudeDesktopRewrite = false

type ReadyPreview = Extract<ClaudeDesktopPreview, { kind: 'ready' }>

/**
 * "Connect Claude Desktop" ([internal ref] A2): write this project's entry into
 * Claude Desktop's own configuration file, after a confirmation showing the
 * file, the exact entry, whether it lets the AI edit, and the backup.
 *
 * Absent where the shell knows no path for that file. Every write — first
 * connection, update, or a change of the switch — goes through the
 * confirmation; there is no "don't ask again". The copy-snippet path below
 * stays, and is where a refused file sends the user.
 */
const claudeDesktopConnect = (snippet: McpSnippet): HTMLElement | null => {
  if (snippet.claudeDesktopPath === null) return null
  const copy = aiCopy.desktopConnect
  const slot = h('div', { class: 'panel__slot' })
  const start = h(
    'button',
    {
      class: 'button button--primary',
      type: 'button',
      'data-testid': 'claude-desktop-connect',
      onClick: () => void preview(null),
    },
    snippet.claudeDesktopConnected ? copy.updateAction : copy.action
  )

  const say = (line: string): void => {
    slot.replaceChildren(h('p', { class: 'panel__note panel__note--strong', role: 'status' }, line))
  }

  // A refusal carries its own way out: the entry to add by hand, right here,
  // rather than "the snippet below" — whose tab may be on another client.
  const refuse = (reason: string, fallback: string): void => {
    slot.replaceChildren(
      h(
        'div',
        { class: 'consent', role: 'status', 'data-testid': 'claude-desktop-refused' },
        h('p', { class: 'panel__note panel__note--strong' }, copy.refused(reason)),
        h('pre', { class: 'log log--snippet' }, fallback),
        h('div', { class: 'form__actions' }, copyButton(fallback))
      )
    )
  }

  const preview = async (lead: string | null): Promise<void> => {
    start.disabled = true
    try {
      const result = await claudeDesktopPreview('connect')
      if (result.kind === 'refused') refuse(result.reason, result.fallback)
      else consent(result, lead)
    } catch (error: unknown) {
      say(errorText(error))
    } finally {
      start.disabled = false
    }
  }

  const apply = async (plan: ReadyPreview, button: HTMLButtonElement): Promise<void> => {
    button.disabled = true
    button.textContent = copy.working
    try {
      const outcome = await claudeDesktopApply(plan.fingerprint)
      if (outcome.kind === 'changed') {
        await preview(copy.changed)
        return
      }
      start.textContent = copy.updateAction
      say(outcome.kind === 'written' ? copy.written : copy.unchanged)
    } catch (error: unknown) {
      say(errorText(error))
    }
  }

  const consent = (plan: ReadyPreview, lead: string | null): void => {
    const confirmButton = h(
      'button',
      {
        class: 'button button--primary',
        type: 'button',
        'data-testid': 'claude-desktop-confirm',
        onClick: () => void apply(plan, confirmButton),
      },
      copy.confirm
    )
    const fact = (label: string, ...value: readonly HTMLElement[]): HTMLElement =>
      h('div', { class: 'consent__fact' }, h('dt', {}, label), h('dd', {}, ...value))
    const title = plan.alreadyPresent ? copy.updateTitle : copy.confirmTitle
    slot.replaceChildren(
      h(
        'div',
        {
          class: 'consent',
          role: 'group',
          'aria-label': title,
          'data-testid': 'claude-desktop-consent',
        },
        lead === null ? null : h('p', { class: 'panel__note panel__note--strong' }, lead),
        h('h3', { class: 'panel__subtitle' }, title),
        h(
          'dl',
          { class: 'consent__facts' },
          fact(copy.fileLabel, h('span', { class: 'panel__meta' }, plan.path)),
          fact(
            copy.entryLabel,
            h('span', { class: 'panel__meta' }, plan.entryName),
            h('pre', { class: 'log log--snippet' }, plan.entry)
          ),
          plan.backupPath === null
            ? null
            : fact(copy.backupLabel, h('span', { class: 'panel__meta' }, plan.backupPath))
        ),
        h(
          'ul',
          { class: 'bullets' },
          h('li', {}, plan.writesEnabled ? copy.writesOn : copy.writesOff),
          plan.backupPath === null ? h('li', {}, copy.noFileYet) : null,
          h('li', {}, copy.keepsOthers)
        ),
        h(
          'div',
          { class: 'form__actions' },
          confirmButton,
          h(
            'button',
            {
              class: 'button button--quiet',
              type: 'button',
              onClick: () => slot.replaceChildren(),
            },
            copy.cancel
          )
        )
      )
    )
  }

  if (offerClaudeDesktopRewrite) {
    offerClaudeDesktopRewrite = false
    void preview(copy.rewriteOffer)
  }

  return h(
    'div',
    { class: 'setting' },
    h('p', { class: 'panel__note' }, copy.hint),
    h('div', { class: 'form__actions' }, start),
    slot
  )
}

const aiTab = (context: SettingsContext, payload: StatePayload): HTMLElement => {
  const setup = h('div', { class: 'panel__slot' }, h('p', { class: 'panel__lead' }, common.loading))
  const availability = h('p', { class: 'panel__note panel__note--strong', hidden: true }, '')

  void mcpSnippet()
    .then((snippet) => {
      // The switch comes before the snippet because it changes the snippet:
      // decide, then copy. Below it, the switch reads as an afterthought to a
      // block the person has already pasted.
      const connect = claudeDesktopConnect(snippet)
      setup.replaceChildren(
        writeSwitch(context, snippet),
        ...(connect === null ? [] : [connect]),
        h('p', { class: 'panel__note' }, aiCopy.clientHint),
        clientPicker(snippet)
      )
      if (!snippet.available) {
        availability.textContent = aiCopy.unavailable
        availability.removeAttribute('hidden')
      }
    })
    .catch((error: unknown) => {
      setup.replaceChildren(h('p', { class: 'panel__lead' }, errorText(error)))
    })

  return h(
    'div',
    { class: 'tab' },
    // The explanation and the folder are one panel, not two. Split, the first
    // had no action and the second had no context — and the folder IS the
    // subject of the sentence above it.
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, aiCopy.title),
      h('p', { class: 'panel__lead' }, aiCopy.lead),
      h('h3', { class: 'panel__subtitle' }, aiCopy.folderStep),
      payload.project === null
        ? h('p', { class: 'panel__lead' }, 'No project is open.')
        : h('p', { class: 'panel__meta' }, payload.project.dir),
      h(
        'div',
        { class: 'form__actions' },
        h(
          'button',
          { class: 'button', type: 'button', onClick: () => void revealProject() },
          common.revealProject
        )
      ),
      h('p', { class: 'panel__note' }, aiCopy.mechanism)
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, aiCopy.clientStep),
      setup,
      availability
    ),
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, aiCopy.canDoHeading),
      h('ul', { class: 'bullets' }, ...aiCopy.canDo.map((line) => h('li', {}, line))),
      h('h3', { class: 'panel__subtitle' }, aiCopy.cannotDoHeading),
      h('p', { class: 'panel__note' }, aiCopy.cannotDo)
    )
  )
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

const logsTab = (context: SettingsContext, payload: StatePayload): HTMLElement => {
  const box = h('pre', { class: 'log log--full' }, common.loading)
  const validation = h('pre', { class: 'log', hidden: true }, '')

  const load = (): void => {
    void shellLogs()
      .then((lines) => {
        box.textContent = lines.length === 0 ? logsCopy.empty : lines.join('\n')
        box.scrollTop = box.scrollHeight
      })
      .catch((error: unknown) => {
        box.textContent = errorText(error)
      })
  }
  load()

  const versions = h('p', { class: 'panel__note' }, '')
  void shellVersions().then((v) => {
    versions.textContent = v.matched
      ? logsCopy.versionMatched(v.shell)
      : logsCopy.versionMismatch(v.shell, v.engine ?? 'unknown')
  })

  return h(
    'div',
    { class: 'tab' },
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, logsCopy.title),
      h('p', { class: 'panel__lead' }, logsCopy.lead),
      box,
      h(
        'div',
        { class: 'form__actions' },
        h('button', { class: 'button', type: 'button', onClick: load }, 'Refresh'),
        h(
          'button',
          {
            class: 'button',
            type: 'button',
            onClick: () => {
              validation.removeAttribute('hidden')
              validation.textContent = logsCopy.checking
              void validateConfig()
                .then((report) => {
                  validation.textContent =
                    report.output === ''
                      ? report.ok
                        ? logsCopy.valid
                        : logsCopy.refusedSilently
                      : report.output
                })
                .catch((error: unknown) => {
                  validation.textContent = errorText(error)
                })
            },
          },
          logsCopy.checkAction
        )
      ),
      validation,
      versions,
      payload.engine?.state === null || payload.engine === null
        ? null
        : h('p', { class: 'panel__note' }, `The engine reports: ${payload.engine.state ?? '—'}.`)
    )
  )
}

// ---------------------------------------------------------------------------
// Advanced
// ---------------------------------------------------------------------------

const advancedTab = (context: SettingsContext, payload: StatePayload): HTMLElement => {
  const undoNote = h('p', { class: 'panel__note' }, common.loading)
  const undoCount = h('p', { class: 'panel__note' }, '')
  const undoButton = h(
    'button',
    { class: 'button', type: 'button', disabled: true },
    advancedCopy.undo.action
  )

  undoButton.addEventListener('click', () => {
    undoButton.setAttribute('disabled', '')
    void undoRestore()
      .then((instant) => {
        context.setNotice(advancedCopy.undo.restored(whenText(instant) ?? instant))
      })
      .catch((error: unknown) => {
        context.setNotice(errorText(error))
      })
      .finally(() => context.refresh())
  })

  void undoAvailability()
    .then((undo) => {
      undoCount.textContent = undo.snapshots === 0 ? '' : advancedCopy.undo.kept(undo.snapshots)
      if (undo.available) {
        const when = undo.target === null ? null : whenText(undo.target)
        undoNote.textContent =
          when === null ? advancedCopy.undo.lead : advancedCopy.undo.target(when)
        undoButton.removeAttribute('disabled')
        return
      }
      undoNote.textContent =
        undo.snapshots === 1 ? advancedCopy.undo.onlyCurrent : advancedCopy.undo.none
    })
    .catch((error: unknown) => {
      undoNote.textContent = errorText(error)
    })

  const canReset = payload.project?.template !== null && payload.project?.template !== undefined

  return h(
    'div',
    { class: 'tab' },
    h(
      'section',
      { class: 'panel' },
      h('h2', { class: 'panel__title' }, advancedCopy.undo.title),
      h('p', { class: 'panel__lead' }, advancedCopy.undo.lead),
      undoNote,
      h('div', { class: 'form__actions form__actions--aligned' }, undoButton, undoCount)
    ),
    h(
      'section',
      { class: 'panel panel--danger' },
      h('h2', { class: 'panel__title' }, advancedCopy.reset.title),
      h(
        'p',
        { class: 'panel__lead' },
        canReset ? advancedCopy.reset.lead : advancedCopy.reset.noTemplate
      ),
      canReset ? h('p', { class: 'panel__note' }, advancedCopy.reset.kept) : null,
      h(
        'div',
        { class: 'form__actions' },
        h(
          'button',
          {
            class: 'button button--danger',
            type: 'button',
            disabled: !canReset,
            onClick: () => {
              void (async () => {
                const sure = await confirm(advancedCopy.reset.confirmBody, {
                  title: advancedCopy.reset.confirmTitle,
                  kind: 'warning',
                })
                if (!sure) return
                try {
                  await resetToTemplate()
                  context.setNotice(advancedCopy.reset.done)
                } catch (error) {
                  context.setNotice(errorText(error))
                }
                context.refresh()
              })()
            },
          },
          advancedCopy.reset.action
        )
      )
    )
  )
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export const renderSettingsView = (context: SettingsContext, payload: StatePayload): void => {
  const body = ((): HTMLElement => {
    switch (context.tab) {
      case 'ai':
        return aiTab(context, payload)
      case 'logs':
        return logsTab(context, payload)
      case 'advanced':
        return advancedTab(context, payload)
      default:
        return projectTab(context, payload)
    }
  })()

  render(
    context.root,
    h(
      'div',
      { class: 'view view--settings' },
      h(
        'nav',
        { class: 'tabs', role: 'tablist' },
        ...TABS.map(([id, label]) =>
          h(
            'button',
            {
              class: context.tab === id ? 'tabs__tab tabs__tab--active' : 'tabs__tab',
              type: 'button',
              role: 'tab',
              'aria-pressed': context.tab === id ? 'true' : 'false',
              onClick: () => context.setTab(id),
            },
            label
          )
        )
      ),
      context.notice === null
        ? null
        : h(
            'div',
            { class: 'notice', role: 'status', 'aria-live': 'polite' },
            h('p', { class: 'notice__text' }, context.notice),
            h(
              'button',
              {
                class: 'button button--quiet',
                type: 'button',
                'aria-label': common.dismiss,
                onClick: () => {
                  context.setNotice(null)
                  context.refresh()
                },
              },
              common.dismiss
            )
          ),
      body
    )
  )
}

export const loadSettings = async (): Promise<Settings | null> => {
  try {
    return await settingsRead()
  } catch {
    return null
  }
}

export type { Tab }
