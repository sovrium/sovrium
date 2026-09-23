/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The desktop shell's front end.
 *
 * One document, two entry points: `index.html` is the main window's chrome, and
 * `index.html#/settings` is the settings window. The hash is the whole router —
 * two states do not need more, and a router library would be a dependency whose
 * only job is an `if`.
 *
 * What this is NOT, and must never become: a configuration editor. No field, no
 * form, no picker and no canvas here writes configuration — the shell reveals a
 * folder and copies an MCP snippet, and the user's own AI edits the file. That
 * is the whole reason the local editing loop can be free, so the refusal is a
 * condition of the design rather than a preference about scope.
 *
 * Vanilla TypeScript, deliberately. The shell's UI is a handful of states with
 * no shared data model; a framework would add a bundle, a build step and a
 * second rendering idiom to a repository that already has one in `src/`.
 *
 * NOTHING here may import from the engine tree. The shell supervises the binary
 * as a separate process; sharing a module would couple two programs that ship
 * on different cadences and are compiled by different toolchains. The release
 * mirror's closure walker enforces the direction it can see (`src/` reaching
 * into `desktop/` aborts the release); this direction is a rule.
 */

import {
  onDeepLink,
  onStateChange,
  shellSnapshot,
  type ProjectRef,
  type Settings,
  type StatePayload,
} from './bridge'
import { mustFind } from './dom'
import { loadRecents, renderMainView } from './views/main-view'
import { loadSettings, renderSettingsView, type Tab } from './views/settings-view'

const isSettingsWindow = (): boolean => window.location.hash.startsWith('#/settings')

/**
 * The state the front end holds, which is deliberately almost none.
 *
 * Everything that matters — whether the engine is up, on what port, with what
 * project — lives in Rust and arrives as a payload. What is kept here is only
 * what Rust has no opinion about: which tab is showing, which template tile was
 * clicked, and the last thing that went wrong.
 */
interface UiState {
  payload: StatePayload
  recents: readonly ProjectRef[]
  settings: Settings | null
  tab: Tab
  pendingTemplate: string | null
  pendingUrl: string | null
  draftName: string
  notice: string | null
}

const FALLBACK: StatePayload = {
  state: { kind: 'idle' },
  project: null,
  engine: null,
}

/**
 * How often the shell re-reads the engine's `status.json`.
 *
 * A refused save changes nothing the shell can be told about: the engine keeps
 * serving, the process keeps running, no event fires. The only way the window
 * learns that the file on disk is not the file being served is by looking, so
 * it looks — and two seconds is fast enough that the answer arrives while the
 * user is still watching for it, and slow enough to cost nothing.
 */
const STATUS_POLL_MS = 2000

/**
 * Everything about a payload that should make the screen change.
 *
 * Polling and re-rendering unconditionally would rebuild the DOM every two
 * seconds — throwing away what is typed in the create form, the client tab
 * chosen on the AI screen, and the scroll position of the log. Comparing a
 * cheap signature first means the redraw happens on the reload that matters and
 * on no other tick.
 */
const signature = (payload: StatePayload): string =>
  JSON.stringify([
    payload.state,
    payload.project?.dir ?? null,
    payload.engine?.state ?? null,
    payload.engine?.lastReload?.at ?? null,
    payload.engine?.lastReload?.outcome ?? null,
  ])

const boot = async (): Promise<void> => {
  const root = mustFind<HTMLElement>('#shell')
  const settingsWindow = isSettingsWindow()

  const ui: UiState = {
    payload: FALLBACK,
    recents: [],
    settings: null,
    tab: 'project',
    pendingTemplate: null,
    pendingUrl: null,
    draftName: '',
    notice: null,
  }

  const draw = (): void => {
    if (settingsWindow) {
      renderSettingsView(
        {
          root,
          refresh: () => {
            void reload()
          },
          tab: ui.tab,
          setTab: (tab) => {
            ui.tab = tab
            draw()
          },
          settings: ui.settings,
          notice: ui.notice,
          setNotice: (message) => {
            ui.notice = message
          },
        },
        ui.payload
      )
      return
    }
    renderMainView(
      {
        root,
        refresh: draw,
        recents: ui.recents,
        pendingTemplate: ui.pendingTemplate,
        setPendingTemplate: (slug) => {
          ui.pendingTemplate = slug
        },
        pendingUrl: ui.pendingUrl,
        setPendingUrl: (url) => {
          ui.pendingUrl = url
        },
        draftName: ui.draftName,
        setDraftName: (name) => {
          ui.draftName = name
        },
        notice: ui.notice,
        setNotice: (message) => {
          ui.notice = message
          draw()
        },
      },
      ui.payload
    )
  }

  const reload = async (): Promise<void> => {
    const [payload, recents, settings] = await Promise.all([
      shellSnapshot().catch(() => FALLBACK),
      settingsWindow ? Promise.resolve([] as readonly ProjectRef[]) : loadRecents(),
      settingsWindow ? loadSettings() : Promise.resolve(null),
    ])
    ui.payload = payload
    ui.recents = recents
    ui.settings = settings
    draw()
  }

  // Draw before awaiting anything. The alternative is a blank window for as
  // long as the first IPC round trip takes, which on a cold start is exactly
  // when the user is wondering whether they double-clicked.
  draw()
  await reload()

  await onStateChange((payload) => {
    ui.payload = payload
    // A state change can mean a project was just created, so the recents the
    // gallery shows are stale. Cheap to re-read, and wrong if we do not.
    if (!settingsWindow) {
      void loadRecents().then((recents) => {
        ui.recents = recents
        draw()
      })
      return
    }
    draw()
  })

  // The engine's verdict on a save arrives in a file, not an event — see
  // STATUS_POLL_MS. Both windows watch it: the main window because it is what
  // the user is looking at when "open in browser" is on, and the settings
  // window because it is where they come to find out what went wrong.
  window.setInterval(() => {
    void shellSnapshot()
      .then((payload) => {
        if (signature(payload) === signature(ui.payload)) return
        ui.payload = payload
        draw()
      })
      .catch(() => {
        // A failed snapshot means the IPC call did not land, which says nothing
        // about the engine. Keep showing the last thing that was true.
      })
  }, STATUS_POLL_MS)

  if (!settingsWindow) {
    // A confirmed deep link: Rust has already shown the dialog and the user
    // said yes to the LINK. They have not yet said where, so this only opens
    // the create form — the folder picker and the write are still ahead.
    await onDeepLink((intent) => {
      ui.pendingTemplate = intent.template
      ui.pendingUrl = intent.url
      ui.draftName = ''
      ui.notice = null
      draw()
    })
  }
}

void boot().catch((error: unknown) => {
  const root = document.querySelector<HTMLElement>('#shell')
  if (root === null) return
  const message = error instanceof Error ? error.message : String(error)
  root.textContent = `Sovrium's window could not start: ${message}`
})
