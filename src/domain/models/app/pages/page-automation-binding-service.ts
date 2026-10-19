/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isShownToSession } from '@/domain/models/app/pages/component-session-visibility-service'
import {
  placedTemplatesOf,
  someRenderedNode,
} from '@/domain/models/app/pages/component-tree-has-type'
import { checkPageAccess } from '@/domain/models/app/pages/page-access-check'
import { CONTROL_ID_KEY, stampControlIds } from '@/domain/models/app/pages/record-control-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

type Page = NonNullable<App['pages']>[number]
type Automation = NonNullable<App['automations']>[number]

/**
 * An automation with a `manual` trigger — the only kind a page press reaches.
 * The press starts its manual entry, under that entry's own role rule.
 */
export type ManualAutomation = Automation

const isManual = (automation: Automation): automation is ManualAutomation =>
  automation.triggers.some((trigger) => trigger.type === 'manual')

/**
 * Whether `value` — a component node, or anything nested in one — carries an
 * `{ type: 'automation', name }` action. Searched through every key rather than
 * a fixed list of places (`action`, `props.action`, a menu item's action), so a
 * component that grows a new place to hold an action is not silently missed.
 */
const carriesAutomationAction = (value: unknown, name: string): boolean => {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => carriesAutomationAction(item, name))
  const record = value as Readonly<Record<string, unknown>>
  if (record['type'] === 'automation' && record['name'] === name) return true
  return Object.entries(record).some(
    ([key, nested]) => key !== 'children' && carriesAutomationAction(nested, name)
  )
}

/**
 * {@link carriesAutomationAction}, less the actions the server judges on a
 * record: the `action` of a holder carrying a control id (`_controlId`, a row
 * action or a record-bound button {@link stampControlIds} gave one), whose
 * press names its record. Classified per action holder — a row action item,
 * not the table node around it — and keyed on the stamp, which survives the
 * caller-view rebuild where object identity does not.
 */
const carriesUnjudgedAutomationAction = (value: unknown, name: string): boolean => {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => carriesUnjudgedAutomationAction(item, name))
  const record = value as Readonly<Record<string, unknown>>
  if (record['type'] === 'automation' && record['name'] === name) return true
  const judged = typeof record[CONTROL_ID_KEY] === 'string'
  return Object.entries(record).some(
    ([key, nested]) =>
      key !== 'children' &&
      !(judged && key === 'action') &&
      carriesUnjudgedAutomationAction(nested, name)
  )
}

/** A node kept or dropped by the caller's view of the page. */
type ShownTest = (node: unknown) => boolean

/**
 * `items` as the caller is shown them: every node the session gates hide is
 * dropped WITH its subtree — its `children` and each `responsive.<bp>.children`,
 * the two lists the renderer draws — so a button inside a hidden container is
 * gone too. Every other field of a kept node is left as authored.
 */
const shownItems = (items: readonly unknown[], shown: ShownTest): readonly unknown[] =>
  items.filter(shown).map((item) => shownNode(item, shown))

const shownNode = (item: unknown, shown: ShownTest): unknown => {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
  const node = item as Readonly<Record<string, unknown>>
  const { children, responsive } = node
  return {
    ...node,
    ...(Array.isArray(children) ? { children: shownItems(children, shown) } : {}),
    ...(responsive !== null && typeof responsive === 'object'
      ? { responsive: shownBreakpoints(responsive as Readonly<Record<string, unknown>>, shown) }
      : {}),
  }
}

const shownBreakpoints = (
  responsive: Readonly<Record<string, unknown>>,
  shown: ShownTest
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(responsive).map(([breakpoint, variant]) => {
      const children = (variant as { readonly children?: unknown } | null)?.children
      return [
        breakpoint,
        Array.isArray(children)
          ? { ...(variant as object), children: shownItems(children, shown) }
          : variant,
      ]
    })
  )

/** The pages of `pages` whose drawn tree, filtered by `shown`, holds a node `binds` admits. */
const pagesBinding = (
  app: App,
  pages: readonly Page[],
  shown: ShownTest,
  binds: (node: unknown) => boolean
): readonly Page[] => {
  const templates = shownItems(app.components ?? [], shown)
  return pages.filter((page) => {
    const items = shownItems(page.components ?? [], shown)
    return someRenderedNode(items, placedTemplatesOf(items, templates), binds)
  })
}

/**
 * Per-`App` memo of its pages with their control ids stamped: which bindings
 * are judged is fixed by the config, so it is read once per page, the first
 * time a press asks; a config reload builds a new `App` and misses here.
 */
const stampedPagesByApp = new WeakMap<App, readonly Page[]>()

const stampedPagesOf = (app: App): readonly Page[] => {
  const cached = stampedPagesByApp.get(app)
  if (cached !== undefined) return cached
  const stamped = (app.pages ?? []).map((page, index) => stampControlIds(page, index))
  // eslint-disable-next-line functional/no-expression-statements -- memoization of a pure function over an immutable input is referentially transparent
  stampedPagesByApp.set(app, stamped)
  return stamped
}

/**
 * The pages that place a component — a button, an alert-dialog confirm, a data
 * form, at any depth and inside any placed component template — whose action
 * runs the automation `name`. Read from the config as authored: nothing is
 * declared on the automation for this.
 */
export const pagesBindingAutomation = (app: App, name: string): readonly Page[] =>
  pagesBinding(
    app,
    app.pages ?? [],
    () => true,
    (node) => carriesAutomationAction(node, name)
  )

/**
 * The automation `name` when a page press may run it for `session`, otherwise
 * `undefined`: it is a `manual` automation, some page binds it through a node
 * the page SHOWS this caller, and that page admits the caller under its
 * `access` rule, exactly as a visit to the page is judged.
 *
 * A node is shown when every session gate of its `visibility` — `when`,
 * `roles`, the `$user.*` `condition`, the caller `capability` — and of every
 * ancestor admits the caller ({@link isShownToSession}, the rule the renderer
 * prunes with). The `record`, `query`, `declares` and `runtime` gates are not
 * judged at press time: there is no bound row or URL state at a press, and URL
 * state is the caller's own to set, so they never were access controls.
 *
 * Every other trigger type has its own road that checks its own condition (a
 * webhook's signature, a schedule, a record event, a form submission), so a
 * page never reaches one — even when a page button names it. A `requiredRole`
 * the manual trigger declares is the caller's to check beside this: it needs
 * the caller's stored role.
 *
 * A binding is read off the config as authored, before a template's `vars`
 * are substituted: a press whose automation name only a substitution supplies
 * is refused rather than admitted. The walk fails closed.
 */
export const pressablePageAutomation = (
  app: App,
  name: string,
  session: SessionInfo | undefined
): ManualAutomation | undefined => {
  const automation = app.automations?.find((candidate) => candidate.name === name)
  if (automation === undefined || !isManual(automation)) return undefined
  const shown: ShownTest = (node) => isShownToSession(node, session, app)
  const binds = (node: unknown) => carriesAutomationAction(node, name)
  const admitted = pagesBinding(app, app.pages ?? [], shown, binds).some(
    (page) => checkPageAccess(page.access, app, session).allowed
  )
  return admitted ? automation : undefined
}

/**
 * Whether `session` can reach an UNJUDGED binding of the automation `name`: a
 * node starting it that the server gives no control id — a plain button, a
 * data form, an alert-dialog confirm, anything inside a placed template — on a
 * page that admits the caller under its `access` rule, through nodes the page
 * shows her (the view {@link pressablePageAutomation} reads).
 *
 * A press that names no record runs only when this holds. Without it, a
 * request that drops the record reference from the press of a judged control
 * (a row action, a record-bound button) would run what its `disabledWhen`
 * refuses. The judged bindings are read off the stamped pages, once per app;
 * per call only the caller's view and the page rule are applied.
 */
export const reachesUnjudgedBinding = (
  app: App,
  name: string,
  session: SessionInfo | undefined
): boolean => {
  const shown: ShownTest = (node) => isShownToSession(node, session, app)
  const binds = (node: unknown) => carriesUnjudgedAutomationAction(node, name)
  return pagesBinding(app, stampedPagesOf(app), shown, binds).some(
    (page) => checkPageAccess(page.access, app, session).allowed
  )
}
