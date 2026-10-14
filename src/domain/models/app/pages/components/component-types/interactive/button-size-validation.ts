/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A button at an icon size (`icon`, `icon-xs`, `icon-sm`, `icon-lg`) draws its
 * `icon` alone, so it needs one, and it is named by its `label`, so it needs
 * that too: without the icon it is an empty square, and without the label a
 * screen reader announces "button" and nothing else. The two keys are siblings
 * of `size`, and the component branch has no refinement hook, so the rule runs
 * here at the shared decode boundary. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ICON_SIZES: ReadonlySet<string> = new Set(['icon', 'icon-xs', 'icon-sm', 'icon-lg'])

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  }
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) =>
      collectNodes(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

const hasLabel = (node: RawRecord): boolean =>
  typeof node['label'] === 'string' ||
  (isRecord(node['props']) &&
    (typeof node['props']['label'] === 'string' || typeof node['props']['aria-label'] === 'string'))

/**
 * Every icon-size button missing its icon or its label.
 *
 * @returns one message per missing key
 */
export function validateIconButtons(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  return collectNodes(pages, 'pages')
    .filter(([node]) => node['type'] === 'button' && ICON_SIZES.has(String(node['size'])))
    .flatMap(([node, path]) => [
      ...(typeof node['icon'] === 'string'
        ? []
        : [
            `${path}: a button of \`size: ${String(node['size'])}\` draws its icon alone and declares no \`icon\`. Name a Lucide icon in \`icon\`, or choose a text size.`,
          ]),
      ...(hasLabel(node)
        ? []
        : [
            `${path}: a button of \`size: ${String(node['size'])}\` is named by its \`label\` and declares none, so a screen reader would announce only "button". Write the action in \`label\`.`,
          ]),
    ])
}
