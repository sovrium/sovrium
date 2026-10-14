/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `label`'s `for` names a control of its OWN page.
 *
 * `<label for>` resolves inside one document. A `for` naming an id that only
 * another page carries — or none at all — renders a label whose click focuses
 * nothing, and the page looks correct. So it is refused at the shared decode
 * boundary (`decodeAppConfigObject` → `runSemanticChecks`), naming the label by
 * its text and the id it could not find, the way a `formRef` naming no form is.
 *
 * Reads the RAW config: every `props.id` declared anywhere inside a page is a
 * candidate, at any depth. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object at any depth. */
function collectNodes(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectNodes)
  if (!isRecord(node)) return []
  return [node, ...Object.values(node).flatMap(collectNodes)]
}

/** Every `props.id` a page declares. */
const idsOf = (nodes: readonly RawRecord[]): ReadonlySet<string> =>
  new Set(
    nodes.flatMap((node) => {
      const { props } = node
      const id = isRecord(props) ? props['id'] : undefined
      return typeof id === 'string' ? [id] : []
    })
  )

/** The refusals of one page. */
function pageViolations(page: unknown, index: number): readonly string[] {
  const nodes = collectNodes(page)
  const ids = idsOf(nodes)
  const pageName = isRecord(page) && typeof page['name'] === 'string' ? page['name'] : String(index)
  return nodes
    .filter((node) => node['type'] === 'label' && typeof node['for'] === 'string')
    .filter((node) => !ids.has(node['for'] as string))
    .map(
      (node) =>
        `pages[${String(index)}] (${pageName}): the label "${String(node['text'])}" names \`for: ${String(node['for'])}\`, and no component of this page carries \`props.id: ${String(node['for'])}\`. A label focuses a control of its own page only: give the control that id, or point \`for\` at a control on this page.`
    )
}

/**
 * Refuse every `label` whose `for` names no component of its own page.
 *
 * @returns one message per such label; empty when every label names a control beside it
 */
export function validateLabelTargets(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  return pages.flatMap(pageViolations)
}
