/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An `attachment` drawn as a thumbnail (`media: image`) needs the image: a
 * thumbnail chip with no `src` would draw an empty tile beside the name, with
 * nothing on the page saying why. Refused at the shared decode boundary,
 * naming the chip and the missing key. Pure: no I/O.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every object at any depth, with its location. */
function collectNodes(node: unknown, path: string): readonly (readonly [RawRecord, string])[] {
  if (Array.isArray(node))
    return node.flatMap((item, index) => collectNodes(item, `${path}[${String(index)}]`))
  if (!isRecord(node)) return []
  return [
    [node, path],
    ...Object.entries(node).flatMap(([key, child]) =>
      collectNodes(child, path === '' ? key : `${path}.${key}`)
    ),
  ]
}

/**
 * Every `attachment` with `media: image` and no `src`.
 *
 * @returns one message per such chip
 */
export function validateAttachmentMedia(config: unknown): readonly string[] {
  return collectNodes(config, '')
    .filter(
      ([node]) =>
        node['type'] === 'attachment' && node['media'] === 'image' && node['src'] === undefined
    )
    .map(
      ([node, path]) =>
        `${path}: the attachment "${String(node['name'])}" is drawn as an image (\`media: image\`) and declares no \`src\`. Give it the thumbnail's address in \`src\`, or drop \`media\` to draw an icon instead.`
    )
}
