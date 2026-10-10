/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A code page opened with no sign-in waiting for its code says one thing — the
 * sign-in has expired — and offers one way back. Everything else the page drew
 * for a live attempt goes, so the notice is not followed by a second "Back to
 * sign in", a recovery-code toggle that opens nothing, or a sentence asking for
 * a code nobody can check.
 *
 * The page is pruned in its CODE REGION: the deepest container whose children
 * hold every code form on the page (the auth card of the `auth-two-factor`
 * block; the page itself when the forms sit at its top level). In that region:
 *
 * - the first code form stays (it draws the notice and its link); every other
 *   code form goes, so two forms (the code, a recovery code) make one notice;
 * - a container left empty by that goes, and with it any control pointing at it
 *   (`aria-controls`, or an interaction naming `#its-id`) — the recovery toggle;
 * - a link to the sign-in page AFTER the first code form goes — the notice
 *   already carries that link;
 * - a paragraph in the sibling right BEFORE the first code form goes — the
 *   sentence introducing the field. Headings stay: the page keeps its title.
 *
 * Those last two look one level into a sibling and never into a landmark
 * (`header`, `nav`, `footer`, `aside`): the region is the page itself when the
 * code forms sit at its top level, and the page's own header or footer is not
 * the code step's. Nothing outside the region is touched.
 */

type Tree = Readonly<Record<string, unknown>>

const isNode = (value: unknown): value is Tree =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCodeForm = (node: Tree): boolean => {
  const { action } = node
  return (
    isNode(action) &&
    action['type'] === 'auth' &&
    (action['method'] ?? 'login') === 'verifyTwoFactor'
  )
}

/** How many code forms `tree` holds, at any depth. */
const countCodeForms = (tree: unknown): number => {
  if (Array.isArray(tree))
    return tree.reduce<number>((sum, child) => sum + countCodeForms(child), 0)
  if (!isNode(tree)) return 0
  return (
    (isCodeForm(tree) ? 1 : 0) +
    Object.entries(tree)
      .filter(([key]) => key !== 'action')
      .reduce((sum, [, value]) => sum + countCodeForms(value), 0)
  )
}

const propsOf = (node: Tree): Tree => (isNode(node['props']) ? node['props'] : {})

const idOf = (node: Tree): string | undefined => {
  const { id } = propsOf(node)
  return typeof id === 'string' ? id : undefined
}

/** Every element id in `tree`. */
const idsIn = (tree: unknown): readonly string[] => {
  if (Array.isArray(tree)) return tree.flatMap(idsIn)
  if (!isNode(tree)) return []
  const own = idOf(tree)
  return [...(own === undefined ? [] : [own]), ...Object.values(tree).flatMap(idsIn)]
}

/** Whether `node` is a control pointing at one of `ids`. */
const controlsAny = (node: Tree, ids: ReadonlySet<string>): boolean => {
  const controls = propsOf(node)['aria-controls']
  if (typeof controls === 'string' && ids.has(controls)) return true
  const interactions = JSON.stringify(node['interactions'] ?? {})
  return [...ids].some((id) => interactions.includes(`"#${id}"`))
}

const isLinkTo = (node: Tree, href: string): boolean =>
  node['type'] === 'link' && (propsOf(node)['href'] ?? node['href']) === href

const isParagraph = (node: Tree): boolean =>
  node['type'] === 'text' && (node['element'] === undefined || node['element'] === 'p')

/**
 * `children` without the nodes `drop` names, at any depth inside them; a node
 * whose children were all dropped goes too. A code form is never walked into.
 */
const prune = (children: readonly unknown[], drop: (node: Tree) => boolean): readonly unknown[] =>
  children.flatMap((child) => {
    if (!isNode(child)) return [child]
    if (drop(child)) return []
    if (isCodeForm(child) || !Array.isArray(child['children'])) return [child]
    const kept = prune(child['children'], drop)
    return child['children'].length > 0 && kept.length === 0 ? [] : [{ ...child, children: kept }]
  })

/** The first code form of `tree` in document order. */
const firstCodeForm = (tree: unknown): Tree | undefined => {
  if (Array.isArray(tree)) {
    return tree.reduce<Tree | undefined>((found, child) => found ?? firstCodeForm(child), undefined)
  }
  if (!isNode(tree)) return undefined
  if (isCodeForm(tree)) return tree
  return Object.entries(tree)
    .filter(([key]) => key !== 'action')
    .reduce<Tree | undefined>((found, [, value]) => found ?? firstCodeForm(value), undefined)
}

/** The elements a page frame is drawn with: never part of the code step. */
const LANDMARKS: ReadonlySet<string> = new Set(['header', 'nav', 'footer', 'aside'])

const isLandmark = (node: Tree): boolean =>
  typeof node['element'] === 'string' && LANDMARKS.has(node['element'])

/**
 * `children` without the nodes `drop` names, among them or one level inside
 * them — never inside a landmark or a code form. A sibling emptied by that goes.
 */
const pruneShallow = (
  children: readonly unknown[],
  drop: (node: Tree) => boolean
): readonly unknown[] =>
  children.flatMap((child) => {
    if (!isNode(child)) return [child]
    if (drop(child)) return []
    if (isLandmark(child) || isCodeForm(child) || !Array.isArray(child['children'])) return [child]
    const kept = child['children'].filter((grandchild) => !(isNode(grandchild) && drop(grandchild)))
    return child['children'].length > 0 && kept.length === 0 ? [] : [{ ...child, children: kept }]
  })

const holdsCodeForm = (child: unknown): boolean => countCodeForms(child) > 0

/** `children` with the sentence right before the first code form gone. */
const withoutIntro = (children: readonly unknown[]): readonly unknown[] => {
  const first = children.findIndex(holdsCodeForm)
  if (first < 1) return children
  return [
    ...children.slice(0, first - 1),
    ...pruneShallow(children.slice(first - 1, first), isParagraph),
    ...children.slice(first),
  ]
}

/** `children` with the links to the sign-in page after the first code form gone. */
const withoutBackLinks = (children: readonly unknown[], loginPage: string): readonly unknown[] => {
  const first = children.findIndex(holdsCodeForm)
  return [
    ...children.slice(0, first + 1),
    ...pruneShallow(children.slice(first + 1), (node) => isLinkTo(node, loginPage)),
  ]
}

/** The code region's children, pruned to the notice and its one way back. */
const collapseRegion = (children: readonly unknown[], loginPage: string): readonly unknown[] => {
  const firstForm = firstCodeForm(children)
  const introduced = withoutIntro(children)
  const withoutForms = prune(introduced, (node) => isCodeForm(node) && node !== firstForm)
  const kept = new Set(idsIn(withoutForms))
  const gone = new Set(idsIn(introduced).filter((id) => !kept.has(id)))
  return withoutBackLinks(
    prune(withoutForms, (node) => controlsAny(node, gone)),
    loginPage
  )
}

/** Descend to the code region — the deepest children list holding every code form. */
const collapse = (
  children: readonly unknown[],
  total: number,
  loginPage: string
): readonly unknown[] => {
  const holder = children.find(
    (child) =>
      isNode(child) &&
      !isCodeForm(child) &&
      Array.isArray(child['children']) &&
      countCodeForms(child['children']) === total
  )
  if (!isNode(holder)) return collapseRegion(children, loginPage)
  return children.map((child) =>
    child === holder
      ? {
          ...holder,
          children: collapse(holder['children'] as readonly unknown[], total, loginPage),
        }
      : child
  )
}

/** A page's components, collapsed to the expired notice and its one link back. */
export const collapseExpiredCodePage = (
  components: readonly unknown[],
  loginPage: string
): readonly unknown[] => {
  const total = countCodeForms(components)
  return total === 0 ? components : collapse(components, total, loginPage)
}
