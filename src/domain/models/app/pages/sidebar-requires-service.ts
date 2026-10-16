/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Drop the sidebar entries that lead to a page `requires` pruned.
 *
 * ─── ONE DECLARATION DECIDES THE ROUTE AND THE WAY TO IT ───────────────────
 *
 * A page whose `requires` the host does not meet is not registered, so it 404s.
 * A sidebar entry pointing at it would then be a link into that 404 — the
 * navigation offering a page the app refuses to serve. Gating the entry by a
 * second declaration (`showWhen` on the row) would be a copy of the page's own
 * gate in another place, free to drift from it. So the entry follows the page:
 * when its destination was pruned, it is dropped with it.
 *
 * ─── ONLY A PRUNED PAGE DROPS ITS ENTRY ────────────────────────────────────
 *
 * An entry whose path is no page of the app at all — a handbook hosted
 * elsewhere, a static file, a route the engine answers itself — keeps its link
 * exactly as before. The test is "matches a pruned page and no kept one", so a
 * path served by a kept page (a static `/records` beside a pruned `/:section`)
 * is never lost to a pattern that also happens to match it.
 *
 * ─── WHAT EMPTIES WITH IT ──────────────────────────────────────────────────
 *
 * - A disclosure with no `href` whose every child was dropped is dropped too:
 *   a toggle that opens nothing is not a row.
 * - A group whose every authored entry was dropped, and which fetches none,
 *   is dropped: a heading over nothing is not a section.
 *
 * Every walk returns the SAME object when nothing under it changed, so an app
 * whose pages all survive pays a walk and no copy.
 */

type Rec = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The path part of a root-relative href, or `undefined` for anything else. */
const hrefPath = (href: unknown): string | undefined => {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return undefined
  const [path = ''] = href.split(/[?#]/, 1)
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  return trimmed === '' ? '/' : trimmed
}

const segmentsOf = (path: string): readonly string[] => path.split('/').filter(Boolean)

/** Whether a concrete path is served by a page path pattern (`:name` = one segment). */
export const pathMatchesPagePattern = (path: string, pattern: string): boolean => {
  const actual = segmentsOf(path)
  const expected = segmentsOf(pattern)
  return (
    actual.length === expected.length &&
    expected.every((segment, index) => segment.startsWith(':') || segment === actual[index])
  )
}

/** The paths an entry leads to that the app no longer serves. */
interface PrunedPaths {
  readonly dropped: readonly string[]
  readonly kept: readonly string[]
}

const leadsToPrunedPage = (href: unknown, paths: PrunedPaths): boolean => {
  const path = hrefPath(href)
  if (path === undefined) return false
  return (
    paths.dropped.some((pattern) => pathMatchesPagePattern(path, pattern)) &&
    !paths.kept.some((pattern) => pathMatchesPagePattern(path, pattern))
  )
}

/** An entry with its dropped children removed, or `undefined` when it goes too. */
const pruneEntry = (entry: unknown, paths: PrunedPaths): unknown => {
  if (!isRecord(entry)) return entry
  if (leadsToPrunedPage(entry['href'], paths)) return undefined
  const { children } = entry
  if (!Array.isArray(children) || children.length === 0) return entry
  const keptChildren = pruneEntries(children, paths)
  if (keptChildren === children) return entry
  if (keptChildren.length > 0) return { ...entry, children: keptChildren }
  // A toggle that opens nothing is not a row; a link keeps its destination.
  if (typeof entry['href'] !== 'string') return undefined
  const { children: _children, childrenProps: _childrenProps, ...rest } = entry
  return rest
}

const pruneEntries = (entries: readonly unknown[], paths: PrunedPaths): readonly unknown[] => {
  const next = entries.map((entry) => pruneEntry(entry, paths))
  const changed = next.some((entry, index) => entry !== entries[index])
  return changed ? next.filter((entry) => entry !== undefined) : entries
}

const pruneGroup = (group: unknown, paths: PrunedPaths): unknown => {
  if (!isRecord(group) || !Array.isArray(group['items'])) return group
  const { items } = group
  const keptItems = pruneEntries(items, paths)
  if (keptItems === items) return group
  if (keptItems.length > 0) return { ...group, items: keptItems }
  if (group['source'] === undefined) return undefined
  const { items: _items, ...rest } = group
  return rest
}

/** Walk any config subtree, pruning every `sidebar` node's groups. */
const pruneTree = (node: unknown, paths: PrunedPaths): unknown => {
  if (Array.isArray(node)) {
    const next = node.map((child) => pruneTree(child, paths))
    return next.some((child, index) => child !== node[index]) ? next : node
  }
  if (!isRecord(node)) return node
  const entries = Object.entries(node)
  const nextEntries = entries.map(([key, value]): readonly [string, unknown] => {
    if (key === 'groups' && node['type'] === 'sidebar' && Array.isArray(value)) {
      const groups = value.map((group) => pruneGroup(pruneTree(group, paths), paths))
      const changed = groups.some((group, index) => group !== value[index])
      return [key, changed ? groups.filter((group) => group !== undefined) : value]
    }
    return [key, pruneTree(value, paths)]
  })
  const changed = nextEntries.some(([, value], index) => value !== entries[index]?.[1])
  return changed ? Object.fromEntries(nextEntries) : node
}

/** The two halves of an app this service rewrites: its pages and its templates. */
interface PrunableApp {
  readonly pages?: readonly { readonly path: string }[]
  readonly components?: readonly unknown[]
}

/**
 * Drop, from every sidebar of the KEPT pages and templates, the entries whose
 * destination is one of the DROPPED pages.
 *
 * @param app - the app with its unmet pages already pruned.
 * @param droppedPaths - the `path` of every pruned page.
 * @returns the same object when no sidebar changed.
 */
export const pruneSidebarEntriesToDroppedPages = <T extends PrunableApp>(
  app: T,
  droppedPaths: readonly string[]
): T => {
  if (droppedPaths.length === 0) return app
  const paths: PrunedPaths = {
    dropped: droppedPaths,
    kept: (app.pages ?? []).map((page) => page.path),
  }
  const pages = app.pages === undefined ? undefined : pruneTree(app.pages, paths)
  const components = app.components === undefined ? undefined : pruneTree(app.components, paths)
  if (pages === app.pages && components === app.components) return app
  return {
    ...app,
    ...(pages === undefined ? {} : { pages }),
    ...(components === undefined ? {} : { components }),
  } as T
}
