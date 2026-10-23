/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HtmlElementNode } from '@/domain/kernel/sanitize/html-element-tree'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/**
 * The design system's own components, mounted on the Claude Design boards.
 *
 * The bundle's Claude Design project ships `components/bundle.js`, a script
 * assigning `window.<Namespace>` one export per kit component it draws. The
 * canvas installs a copy under `ds/<folder>/components/bundle.js`, and each
 * board loads it after `support.js`. A tree node of a type that is one control
 * of the kit (a button, a badge) whose component the bundle exports is drawn
 * as `<x-import component-from-global-scope="<Namespace>.<Component>">`, its
 * variant and size as props and its stamps on it, the drawn markup inside as
 * its children. Every other node stays markup: a text, a container or a data
 * island is the page's own layout, not a component a designer swaps.
 */

/** The design system's bundle, as the boards mount it. */
export interface CanvasBundle {
  /** The global the bundle assigns, `window.<namespace>`. */
  readonly namespace: string
  /** Every component it exports. */
  readonly components: readonly string[]
}

/** The kit types a board mounts from the bundle, by the export that draws each. */
const MOUNTED: Readonly<Record<string, string>> = { button: 'Button', badge: 'Badge' }

/** The attribute naming a mounted component's node on the markup inside it. */
export const MOUNTED_NODE = 'data-dc-node'

/** Where the bundle script is installed, relative to the canvas folder. */
export const canvasBundlePath = (folder: string): string => `ds/${folder}/components/bundle.js`

/** The component a tree node is drawn by, when the bundle exports one. */
const mountedComponentOf = (
  bundle: CanvasBundle | undefined,
  node: PageDesignTreeNode
): string | undefined => {
  const component = MOUNTED[node.type]
  return bundle !== undefined && component !== undefined && bundle.components.includes(component)
    ? `${bundle.namespace}.${component}`
    : undefined
}

/**
 * A drawn element as the board mounts it: inside its bundle component, the
 * stamps on the component, or as it was drawn, stamped, when the bundle
 * exports none for its type.
 *
 * @param bundle - the design system's bundle, when the canvas installs one.
 * @param node - the tree node the element draws.
 * @param element - the element as drawn, without its stamps.
 * @param stamps - the node's stamps.
 */
export const mountedElementOf = (
  bundle: CanvasBundle | undefined,
  node: PageDesignTreeNode,
  element: HtmlElementNode,
  stamps: Readonly<Record<string, string>>
): HtmlElementNode => {
  const component = mountedComponentOf(bundle, node)
  if (component === undefined) {
    return { ...element, attributes: { ...element.attributes, ...stamps } }
  }
  return {
    kind: 'element',
    tag: 'x-import',
    attributes: {
      'component-from-global-scope': component,
      ...(node.variant === undefined ? {} : { variant: node.variant }),
      ...(node.size === undefined ? {} : { size: node.size }),
      ...stamps,
    },
    // The markup inside names its node too, for the board's own script: a
    // canvas that draws the component in its place drops the wrapper.
    children: [{ ...element, attributes: { ...element.attributes, [MOUNTED_NODE]: node.id } }],
  }
}

/** The bundle a canvas index file names, read from its `@ds-bundle` header; `undefined` without one. */
export const canvasBundleOf = (script: string): CanvasBundle | undefined => {
  const header = /@ds-bundle: (\{[^\n]*?\}) \*\//.exec(script)?.[1]
  if (header === undefined) return undefined
  try {
    const parsed = JSON.parse(header) as {
      readonly namespace?: unknown
      readonly components?: readonly { readonly name?: unknown }[]
    }
    return typeof parsed.namespace === 'string'
      ? {
          namespace: parsed.namespace,
          components: (parsed.components ?? []).flatMap((entry) =>
            typeof entry.name === 'string' ? [entry.name] : []
          ),
        }
      : undefined
  } catch {
    return undefined
  }
}
