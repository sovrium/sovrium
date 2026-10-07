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
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

type Page = NonNullable<App['pages']>[number]
type Automation = NonNullable<App['automations']>[number]

/** An automation whose trigger is `manual` — the only kind a page press reaches. */
export type ManualAutomation = Automation & {
  readonly trigger: Extract<Automation['trigger'], { readonly type: 'manual' }>
}

const isManual = (automation: Automation): automation is ManualAutomation =>
  automation.trigger.type === 'manual'

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

/** The pages whose drawn tree, filtered by `shown`, binds the automation `name`. */
const pagesBinding = (app: App, name: string, shown: ShownTest): readonly Page[] => {
  const templates = shownItems(app.components ?? [], shown)
  return (app.pages ?? []).filter((page) => {
    const items = shownItems(page.components ?? [], shown)
    return someRenderedNode(items, placedTemplatesOf(items, templates), (node) =>
      carriesAutomationAction(node, name)
    )
  })
}

/**
 * The pages that place a component — a button, an alert-dialog confirm, a data
 * form, at any depth and inside any placed component template — whose action
 * runs the automation `name`. Read from the config as authored: nothing is
 * declared on the automation for this.
 */
export const pagesBindingAutomation = (app: App, name: string): readonly Page[] =>
  pagesBinding(app, name, () => true)

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
  const admitted = pagesBinding(app, name, shown).some(
    (page) => checkPageAccess(page.access, app, session).allowed
  )
  return admitted ? automation : undefined
}
