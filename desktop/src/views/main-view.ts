/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The main window's chrome: the first-run gallery, the splash, and the error
 * panel.
 *
 * This window shows one of these until the engine answers, and is then
 * navigated — from Rust — to the running instance's origin, where the page is the
 * user's own app. So everything here is what the user sees *instead of* their
 * app: before it exists, while it is starting, and when it has stopped.
 *
 * It offers no way to edit configuration, and must not gain one. The gallery
 * asks the engine to lay down a template it already ships, or to fork one
 * document from an address; it does not compose one, and it does not fetch one.
 * [internal ref] D2: the shell reveals a folder and copies an MCP snippet, and the
 * user's own AI edits the file.
 *
 * Every string a person reads here comes from `../copy`. See that file for why,
 * and for the EN-only decision it records.
 */

import { open } from '@tauri-apps/plugin-dialog'
import { templates, type TemplateEntry } from 'virtual:sovrium-templates'

import {
  createProject,
  createProjectFromUrl,
  errorText,
  openAppInBrowser,
  openProject,
  openSettingsWindow,
  restartEngine,
  revealProject,
  settingsRead,
  type ProjectRef,
  type StatePayload,
} from '../bridge'
import {
  common,
  createForm as createCopy,
  fromUrl as urlCopy,
  gallery as galleryCopy,
  status as statusCopy,
} from '../copy'
import { h, render } from '../dom'
import { engineIsDown, engineVerdict } from './engine-verdict'

/** Everything the view needs that is not in the state payload. */
interface ViewContext {
  readonly root: HTMLElement
  /** Re-render with the current state; used after a local-only change. */
  readonly refresh: () => void
  readonly recents: readonly ProjectRef[]
  /** A template the user arrived at through a confirmed deep link. */
  readonly pendingTemplate: string | null
  readonly setPendingTemplate: (slug: string | null) => void
  /** Set when the user is starting from an address rather than a template. */
  readonly pendingUrl: string | null
  readonly setPendingUrl: (url: string | null) => void
  /**
   * What the user has typed into the create form.
   *
   * Held here rather than in the DOM because a state change from the engine
   * re-renders this view, and a re-render that throws away a half-typed folder
   * name is a small betrayal the user cannot see coming.
   */
  readonly draftName: string
  readonly setDraftName: (name: string) => void
  readonly notice: string | null
  readonly setNotice: (message: string | null) => void
}

/**
 * The order the gallery shows categories in — simplest first.
 *
 * A category the engine adds later ranks last rather than breaking the sort, so
 * a new template appears at the bottom instead of not appearing. Read the real
 * set with `jq -r '.[].category' templates/catalog.json | sort -u`.
 */
const CATEGORY_ORDER = [
  'starter',
  'website',
  'blog',
  'docs',
  'business',
  'internal',
  'portal',
  'apiAi',
] as const

const categoryRank = (category: string): number => {
  const index = (CATEGORY_ORDER as readonly string[]).indexOf(category)
  return index === -1 ? CATEGORY_ORDER.length : index
}

/**
 * The catalogue in display order: simplest category first, then by name.
 *
 * ONE flat grid, deliberately. Grouping the tiles under category headings was
 * tried and reverted: a heading has to span the grid, which forces a row break,
 * and six of the eight categories hold one or two templates — so every one of
 * them stranded its tiles beside two empty columns and the gallery grew by half
 * a screen to say something the descriptions already say ("a WordPress
 * alternative", "an Airtable alternative"). The order carries the same signal
 * for free, and it puts the one a first-timer should pick at the top.
 */
const sortedTemplates = (): readonly (readonly [string, TemplateEntry])[] =>
  Object.entries(templates).sort(([, a], [, b]) => {
    const byCategory = categoryRank(a.category) - categoryRank(b.category)
    return byCategory === 0 ? a.name.localeCompare(b.name) : byCategory
  })

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const noticeBar = (context: ViewContext): HTMLElement | null =>
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
            onClick: () => context.setNotice(null),
          },
          common.dismiss
        )
      )

/** A folder picker plus the line that says where the project will land. */
const destination = (
  create: HTMLButtonElement
): {
  readonly choose: HTMLElement
  readonly location: HTMLElement
  readonly parent: () => string | null
} => {
  const location = h('p', { class: 'form__location' }, createCopy.noFolderChosen)
  let parentDir: string | null = null
  const choose = h(
    'button',
    {
      class: 'button',
      type: 'button',
      onClick: () => {
        void (async () => {
          const picked = await open({
            directory: true,
            multiple: false,
            title: 'Where should this project live?',
          })
          if (typeof picked !== 'string') return
          parentDir = picked
          location.textContent = `${createCopy.locationPrefix} ${picked}`
          create.removeAttribute('disabled')
        })()
      },
    },
    'Choose a folder…'
  )
  return { choose, location, parent: () => parentDir }
}

/** The shared header of both create forms: a way back, then the title. */
const formHeader = (context: ViewContext, title: string, lead: string): HTMLElement =>
  h(
    'div',
    { class: 'form__header' },
    h(
      'button',
      {
        class: 'button button--quiet button--back',
        type: 'button',
        onClick: () => {
          context.setPendingTemplate(null)
          context.setPendingUrl(null)
          context.setNotice(null)
          context.refresh()
        },
      },
      `← ${common.back}`
    ),
    h('h1', { class: 'view__title view__title--form' }, title),
    h('p', { class: 'view__lead' }, lead)
  )

const nameField = (context: ViewContext, suggestion: string): HTMLInputElement => {
  const input = h('input', {
    class: 'field__input',
    id: 'folder-name',
    type: 'text',
    value: context.draftName === '' ? suggestion : context.draftName,
    placeholder: createCopy.folderLabel,
    onInput: (event) => context.setDraftName((event.currentTarget as HTMLInputElement).value),
  })
  return input
}

const createFromTemplate = (
  context: ViewContext,
  slug: string,
  entry: TemplateEntry
): HTMLElement => {
  const nameInput = nameField(context, slug)
  const create = h(
    'button',
    { class: 'button button--primary', type: 'button', disabled: true },
    'Create project'
  )
  const { choose, location, parent } = destination(create)

  create.addEventListener('click', () => {
    const parentDir = parent()
    if (parentDir === null) return
    create.setAttribute('disabled', '')
    create.textContent = createCopy.creating
    void (async () => {
      try {
        await createProject(parentDir, nameInput.value.trim(), slug)
        context.setPendingTemplate(null)
        context.setDraftName('')
        context.setNotice(null)
      } catch (error) {
        context.setNotice(errorText(error))
        context.setPendingTemplate(slug)
        context.refresh()
      }
    })()
  })

  return h(
    'div',
    { class: 'view view--form' },
    noticeBar(context),
    formHeader(context, entry.name, entry.description),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'folder-name' }, createCopy.folderLabel),
        nameInput
      ),
      h('div', { class: 'form__actions' }, choose, create),
      location
    )
  )
}

/**
 * Start from a configuration published at an address.
 *
 * The three safety lines are shown BEFORE the button, not after, because they
 * are what the decision is made on: what arrives, what does not run, and what
 * is recorded. The shell fetches nothing itself — `sovrium init --from-url`
 * owns the retrieval and every guard around it.
 */
const createFromUrl = (context: ViewContext): HTMLElement => {
  const nameInput = nameField(context, 'my-app')
  const create = h(
    'button',
    { class: 'button button--primary', type: 'button', disabled: true },
    'Create project'
  )
  const { choose, location, parent } = destination(create)

  const urlInput = h('input', {
    class: 'field__input',
    id: 'config-url',
    type: 'url',
    value: context.pendingUrl ?? '',
    placeholder: urlCopy.urlPlaceholder,
    onInput: (event) => context.setPendingUrl((event.currentTarget as HTMLInputElement).value),
  })

  create.addEventListener('click', () => {
    const parentDir = parent()
    if (parentDir === null) return
    const url = urlInput.value.trim()
    // Checked here as well as in Rust so the message arrives before a round
    // trip: the commonest mistake is pasting an http address, and saying so
    // instantly reads as a form that understands what was typed.
    if (!url.toLowerCase().startsWith('https://')) {
      context.setNotice(urlCopy.notHttps)
      context.refresh()
      return
    }
    create.setAttribute('disabled', '')
    create.textContent = createCopy.creating
    void (async () => {
      try {
        await createProjectFromUrl(parentDir, nameInput.value.trim(), url)
        context.setPendingUrl(null)
        context.setDraftName('')
        context.setNotice(null)
      } catch (error) {
        context.setNotice(errorText(error))
        context.refresh()
      }
    })()
  })

  return h(
    'div',
    { class: 'view view--form' },
    noticeBar(context),
    formHeader(context, urlCopy.title, urlCopy.lead),
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'config-url' }, urlCopy.urlLabel),
        urlInput
      ),
      h('ul', { class: 'safety' }, ...urlCopy.safety.map((line) => h('li', {}, line))),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'folder-name' }, createCopy.folderLabel),
        nameInput
      ),
      h('div', { class: 'form__actions' }, choose, create),
      location
    )
  )
}

const templateTile = (context: ViewContext, slug: string, entry: TemplateEntry): HTMLElement =>
  h(
    'button',
    {
      class: 'tile',
      type: 'button',
      'data-testid': `template-${slug}`,
      onClick: () => {
        context.setDraftName('')
        context.setPendingTemplate(slug)
        context.refresh()
      },
    },
    h('span', { class: 'tile__name' }, entry.name),
    h('span', { class: 'tile__description' }, entry.description)
  )

const recentsList = (context: ViewContext): HTMLElement | null => {
  if (context.recents.length === 0) return null
  return h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'panel__title' }, galleryCopy.recentsHeading),
    h(
      'ul',
      { class: 'recents' },
      ...context.recents.map((project) =>
        h(
          'li',
          { class: 'recents__item' },
          h(
            'button',
            {
              class: 'recents__open',
              type: 'button',
              onClick: () => {
                void openProject(project.dir).catch((error: unknown) => {
                  context.setNotice(errorText(error))
                  context.refresh()
                })
              },
            },
            h('span', { class: 'recents__name' }, project.name),
            h('span', { class: 'recents__path' }, project.dir)
          )
        )
      )
    )
  )
}

/** The two ways in that are not a template. */
const otherWays = (context: ViewContext): HTMLElement =>
  h(
    'section',
    { class: 'panel' },
    h('h2', { class: 'panel__title' }, galleryCopy.otherWaysHeading),
    h(
      'div',
      { class: 'ways' },
      h(
        'div',
        { class: 'ways__item' },
        h(
          'button',
          {
            class: 'button',
            type: 'button',
            onClick: () => {
              void (async () => {
                const picked = await open({
                  directory: true,
                  multiple: false,
                  title: 'Open a Sovrium project',
                })
                if (typeof picked !== 'string') return
                try {
                  await openProject(picked)
                } catch (error) {
                  context.setNotice(errorText(error))
                  context.refresh()
                }
              })()
            },
          },
          'Open an existing folder…'
        ),
        h('p', { class: 'panel__note' }, galleryCopy.openExistingNote)
      ),
      h(
        'div',
        { class: 'ways__item' },
        h(
          'button',
          {
            class: 'button',
            type: 'button',
            onClick: () => {
              context.setDraftName('')
              context.setPendingUrl('')
              context.refresh()
            },
          },
          `${urlCopy.title}…`
        ),
        h('p', { class: 'panel__note' }, galleryCopy.fromUrlNote)
      )
    )
  )

const gallery = (context: ViewContext): HTMLElement =>
  h(
    'div',
    { class: 'view view--gallery' },
    noticeBar(context),
    h(
      'header',
      { class: 'view__header' },
      h('h1', { class: 'view__title' }, galleryCopy.title),
      h('p', { class: 'view__lead' }, galleryCopy.lead)
    ),
    // Recents first when there are any. This screen is the first thing a
    // returning user sees after closing a project, and making them scroll past
    // nineteen templates to reach the one they were working on yesterday gets
    // the priority exactly backwards. On a genuine first run there are none,
    // so the gallery is unchanged for the person it was designed for.
    recentsList(context),
    h('h2', { class: 'section__title' }, galleryCopy.templatesHeading),
    h(
      'div',
      { class: 'tiles' },
      ...sortedTemplates().map(([slug, entry]) => templateTile(context, slug, entry))
    ),
    otherWays(context)
  )

const logTail = (lines: readonly string[]): HTMLElement | null =>
  lines.length === 0
    ? null
    : h(
        'div',
        { class: 'log__block' },
        h('h3', { class: 'panel__subtitle' }, statusCopy.failed.logHeading),
        h('pre', { class: 'log log--tail' }, lines.join('\n'))
      )

/**
 * A centred one-message screen.
 *
 * The engine's verdict is composed ABOVE it rather than inside it: a refused
 * save and a paused engine are independent facts, and a user who paused a
 * project whose last save was refused needs to be told both.
 */
const statusView = (
  context: ViewContext,
  payload: StatePayload,
  title: string,
  lead: string,
  extra?: HTMLElement | null
): HTMLElement =>
  h(
    'div',
    { class: 'view view--status', 'data-state': payload.state.kind },
    noticeBar(context),
    engineVerdict(payload),
    h(
      'section',
      { class: 'panel panel--centred' },
      h('h1', { class: 'panel__title' }, title),
      h('p', { class: 'panel__lead' }, lead),
      payload.project === null ? null : h('p', { class: 'panel__meta' }, payload.project.dir),
      extra ?? null,
      h(
        'div',
        { class: 'form__actions form__actions--centred' },
        payload.project === null
          ? null
          : h(
              'button',
              {
                class: 'button button--quiet',
                type: 'button',
                onClick: () => void revealProject(),
              },
              common.revealProject
            ),
        h(
          'button',
          {
            class: 'button button--quiet',
            type: 'button',
            onClick: () => void openSettingsWindow(),
          },
          common.openSettings
        )
      )
    )
  )

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export const renderMainView = (context: ViewContext, payload: StatePayload): void => {
  // A create form outranks the engine's state: the user is mid-task, and
  // replacing their half-filled form with a splash because a background start
  // finished would lose what they typed.
  const pendingEntry =
    context.pendingTemplate === null ? undefined : templates[context.pendingTemplate]
  if (context.pendingTemplate !== null && pendingEntry !== undefined) {
    render(context.root, createFromTemplate(context, context.pendingTemplate, pendingEntry))
    return
  }
  if (context.pendingUrl !== null) {
    render(context.root, createFromUrl(context))
    return
  }

  const { state } = payload
  switch (state.kind) {
    case 'idle':
      render(context.root, gallery(context))
      return

    case 'starting':
      render(
        context.root,
        statusView(context, payload, statusCopy.starting.title, statusCopy.starting.lead)
      )
      return

    case 'restarting':
      render(
        context.root,
        statusView(
          context,
          payload,
          statusCopy.restarting.title,
          statusCopy.restarting.lead(state.attempt)
        )
      )
      return

    case 'paused':
      render(
        context.root,
        statusView(
          context,
          payload,
          statusCopy.paused.title,
          statusCopy.paused.lead,
          h(
            'button',
            {
              class: 'button button--primary',
              type: 'button',
              onClick: () => void restartEngine(),
            },
            statusCopy.paused.action
          )
        )
      )
      return

    case 'serving':
      // The shell says `serving` because the engine answered when it started,
      // and it is not re-probed afterwards. If the engine has since reported
      // that nothing is listening, offering "Open the app" beside a panel that
      // says "Nothing is running" would be two screens contradicting each other
      // — and the one with the button would be the one the user believes.
      if (engineIsDown(payload)) {
        render(
          context.root,
          h(
            'div',
            { class: 'view view--status', 'data-state': 'engine-down' },
            noticeBar(context),
            engineVerdict(payload),
            h(
              'div',
              { class: 'form__actions form__actions--centred' },
              h(
                'button',
                {
                  class: 'button button--primary',
                  type: 'button',
                  onClick: () => void restartEngine(),
                },
                common.tryAgain
              ),
              h(
                'button',
                { class: 'button', type: 'button', onClick: () => void revealProject() },
                common.revealProject
              ),
              h(
                'button',
                {
                  class: 'button button--quiet',
                  type: 'button',
                  onClick: () => void openSettingsWindow(),
                },
                common.openSettings
              )
            )
          )
        )
        return
      }
      // Rust navigates this window to the app. Reaching here means the user
      // asked for the browser instead, so say where the app went rather than
      // leaving a window that looks stuck.
      render(
        context.root,
        statusView(
          context,
          payload,
          statusCopy.inBrowser.title,
          statusCopy.inBrowser.lead(state.port),
          h(
            'button',
            {
              class: 'button button--primary',
              type: 'button',
              onClick: () => void openAppInBrowser(),
            },
            statusCopy.inBrowser.action
          )
        )
      )
      return

    case 'failed':
      render(
        context.root,
        h(
          'div',
          { class: 'view view--status', 'data-state': 'failed' },
          noticeBar(context),
          engineVerdict(payload),
          h(
            'section',
            { class: 'panel panel--error' },
            h('h1', { class: 'panel__title' }, statusCopy.failed.title),
            h('p', { class: 'panel__lead' }, state.message),
            payload.project === null ? null : h('p', { class: 'panel__meta' }, payload.project.dir),
            logTail(state.tail),
            h(
              'div',
              { class: 'form__actions' },
              h(
                'button',
                {
                  class: 'button button--primary',
                  type: 'button',
                  onClick: () => void restartEngine(),
                },
                common.tryAgain
              ),
              h(
                'button',
                {
                  class: 'button',
                  type: 'button',
                  onClick: () => void revealProject(),
                },
                common.revealProject
              ),
              h(
                'button',
                {
                  class: 'button button--quiet',
                  type: 'button',
                  onClick: () => void openSettingsWindow(),
                },
                common.openSettings
              )
            )
          )
        )
      )
      return

    default:
      render(context.root, gallery(context))
  }
}

/** Read the recents once, for the gallery. */
export const loadRecents = async (): Promise<readonly ProjectRef[]> => {
  try {
    return (await settingsRead()).recents
  } catch {
    return []
  }
}
